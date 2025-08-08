import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(
  refreshToken: string,
  accountId: string,
  supabaseAdmin: any
) {
  console.log('🔐 Attempting to refresh token...');
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('❌ Token refresh error:', txt);
    throw new Error(`Failed to refresh token: ${resp.status} - ${txt}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 get-adgroups function called');
    const { accountId, filters } = await req.json();
    if (!accountId) throw new Error('Account ID is required');

    // Initialiseer Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Haal accountgegevens op
    const { data: account, error: accountError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      console.error('❌ Database error of account niet gevonden:', accountError);
      throw new Error('Google Ads account niet gevonden.');
    }
    if (account.needs_reconnection) {
      console.error('❌ Account moet opnieuw verbonden worden');
      throw new Error('Account vereist reconnection.');
    }

    // Verfris access token
    const decryptedRefreshToken = await decrypt(
      account.refresh_token,
      Deno.env.get('ENCRYPTION_KEY')!
    );
    const { access_token } = await getRefreshedToken(
      decryptedRefreshToken,
      accountId,
      supabaseAdmin
    );
    console.log('✅ Got fresh access token');

    // Metrics: allow full field paths; only prefix plain metric names
    const baseMetrics = ['impressions', 'clicks', 'cost_micros'];
    const incoming = (filters?.metrics?.slice() || baseMetrics);
    const normalizedFields = incoming.map((f: string) => {
      if (!f) return '';
      const trimmed = f.trim();
      if (trimmed.startsWith('metrics.') || trimmed.includes('.')) return trimmed; // already full path
      return `metrics.${trimmed}`;
    }).filter(Boolean);
    const metricsQuery = normalizedFields.join(', ');

    // Datumfilter
    let dateCondition = 'segments.date DURING LAST_30_DAYS';
    if (filters?.dateRange) {
      switch (filters.dateRange) {
        case 'LAST_7_DAYS':
          dateCondition = 'segments.date DURING LAST_7_DAYS';
          break;
        case 'LAST_14_DAYS':
          dateCondition = 'segments.date DURING LAST_14_DAYS';
          break;
        case 'LAST_90_DAYS':
          dateCondition = 'segments.date DURING LAST_90_DAYS';
          break;
        case 'CUSTOM':
          if (filters.startDate && filters.endDate) {
            const sd = new Date(filters.startDate).toISOString().slice(0,10).replace(/-/g,'');
            const ed = new Date(filters.endDate).toISOString().slice(0,10).replace(/-/g,'');
            dateCondition = `segments.date BETWEEN '${sd}' AND '${ed}'`;
          }
          break;
      }
    }

    const limit = filters?.limit || 50;

    // GAQL-query zonder AS
    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.id,
        campaign.name,
        segments.device,
        ${metricsQuery}
      FROM ad_group
      WHERE ${dateCondition}
      ORDER BY metrics.impressions DESC
      LIMIT ${limit}
    `.trim();

    console.log('📊 Generated AdGroup query:', query);

    // API-call (alleen query in payload)
    const customerId = account.customer_id.replace(/-/g, '');
    let response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
          'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      }
    );

    // Token-refresh fallback
    if (response.status === 401) {
      const tokens = await getRefreshedToken(
        decryptedRefreshToken,
        accountId,
        supabaseAdmin
      );
      response = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.access_token}`,
            'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query }),
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ API Error:', errText);
      throw new Error(`Google Ads API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log('✅ Raw API response received');

    // Mapping en kosten omrekenen
    const adGroups = data[0]?.results?.map((row: any) => ({
      id:               row.adGroup?.id,
      name:             row.adGroup?.name,
      status:           row.adGroup?.status,
      campaign_id:      row.campaign?.id,
      campaign_name:    row.campaign?.name,
      device:           row.segments?.device,
      metrics: {
        impressions: parseInt(row.metrics.impressions as string, 10),
        clicks:      parseInt(row.metrics.clicks as string, 10),
        cost_micros: parseInt(row.metrics.costMicros as string, 10),
        cost:        parseInt(row.metrics.costMicros as string, 10) / 1e6,
      },
    })) || [];

    console.log(`✅ Processed ${adGroups.length} ad groups`);

    return new Response(JSON.stringify({ adGroups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('💥 Function error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
