// file: get-keywords.ts
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
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  
  console.log('🔍 Secret validation:');
  console.log(`  - Client ID available: ${!!clientId} (length: ${clientId?.length || 0})`);
  console.log(`  - Client Secret available: ${!!clientSecret} (length: ${clientSecret?.length || 0})`);
  
  if (!clientId) {
    throw new Error('GOOGLE_ADS_CLIENT_ID is missing or empty');
  }
  if (!clientSecret) {
    throw new Error('GOOGLE_ADS_CLIENT_SECRET is missing or empty');
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('❌ Token refresh failed:', txt);
    throw new Error(`Refresh failed: ${resp.status} – ${txt}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 get-keywords function called (v2)');
    const { accountId, filters } = await req.json();
    if (!accountId) throw new Error('Account ID is required');

    // Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Haal account uit DB
    const { data: account, error: accErr } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId)
      .single();

    if (accErr || !account) throw new Error('Google Ads account niet gevonden.');
    if (account.needs_reconnection) throw new Error('Account moet opnieuw verbonden worden.');

    // Nieuwe access token
    const decrypted = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const { access_token } = await getRefreshedToken(decrypted, accountId, supabaseAdmin);

    // Metrics: allow full field paths; only prefix plain metric names
    const baseMetrics = ['clicks', 'impressions', 'cost_micros'];
    const incoming = (filters?.metrics?.slice() || baseMetrics);
    const normalizedFields = incoming.map((f: string) => {
      if (!f) return '';
      const trimmed = f.trim();
      if (trimmed.startsWith('metrics.') || trimmed.includes('.')) return trimmed;
      return `metrics.${trimmed}`;
    }).filter(Boolean);
    const metricsQuery = normalizedFields.join(', ');

    // Datumfilter
    let dateCond = 'segments.date DURING LAST_30_DAYS';
    if (filters?.dateRange) {
      switch (filters.dateRange) {
        case 'LAST_7_DAYS':
          dateCond = 'segments.date DURING LAST_7_DAYS';
          break;
        case 'LAST_14_DAYS':
          dateCond = 'segments.date DURING LAST_14_DAYS';
          break;
        case 'LAST_90_DAYS':
          dateCond = 'segments.date DURING LAST_90_DAYS';
          break;
        case 'CUSTOM':
          if (filters.startDate && filters.endDate) {
            const sd = filters.startDate.replace(/-/g, '');
            const ed = filters.endDate.replace(/-/g, '');
            dateCond = `segments.date BETWEEN '${sd}' AND '${ed}'`;
          }
          break;
      }
    }

    const limit = filters?.limit || 200;

    // GAQL-query
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ${metricsQuery}
      FROM keyword_view
      WHERE ${dateCond}
      ORDER BY metrics.clicks DESC
      LIMIT ${limit}
    `;

    console.log('📊 Query:', query.trim());

    // API-call
    const customerId = account.customer_id.replace(/-/g, '');
    let resp = await fetch(
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

    // Fallback bij verlopen token
    if (resp.status === 401) {
      const tokens = await getRefreshedToken(decrypted, accountId, supabaseAdmin);
      resp = await fetch(
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

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error('❌ API error:', errTxt);
      throw new Error(`Google Ads API error (${resp.status}): ${errTxt}`);
    }

    const payload = await resp.json();
    console.log('✅ API response binnen');

    // Mappen en type-conversies
    const keywords =
      payload[0]?.results?.map((row: any) => ({
        campaign_id:   row.campaign?.id,
        campaign_name: row.campaign?.name,
        ad_group_id:   row.adGroup?.id,
        ad_group_name: row.adGroup?.name,
        keyword_text:  row.adGroupCriterion?.keyword?.text,
        match_type:    row.adGroupCriterion?.keyword?.matchType,
        metrics: {
          clicks:      parseInt(row.metrics.clicks as string, 10),
          impressions: parseInt(row.metrics.impressions as string, 10),
          cost_micros: parseInt(row.metrics.costMicros as string, 10),
          cost:        parseInt(row.metrics.costMicros as string, 10) / 1e6,
          ctr:         row.metrics.ctr,
          conversions: row.metrics.conversions,
        },
      })) || [];

    console.log(`✅ ${keywords.length} keywords verwerkt`);
    return new Response(JSON.stringify({ keywords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('💥 Error in get-keywords:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
