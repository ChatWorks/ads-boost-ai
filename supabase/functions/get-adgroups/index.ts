// file: get-adgroups.ts
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

    // Supabase init
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Haal account op
    const { data: account, error: accountError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      console.error('❌ Database error or account missing:', accountError);
      throw new Error('Google Ads account not found.');
    }
    if (account.needs_reconnection) {
      console.error('❌ Account needs reconnection');
      throw new Error('Account requires reconnection.');
    }

    // Refresh token
    const refreshToken = await decrypt(
      account.refresh_token,
      Deno.env.get('ENCRYPTION_KEY')!
    );
    const { access_token } = await getRefreshedToken(
      refreshToken,
      accountId,
      supabaseAdmin
    );
    console.log('✅ Got fresh access token');

    // Metrics (zorg dat cost_micros altijd mee komt)
    const defaultMetrics = ['impressions', 'clicks', 'cost_micros'];
    const selectedMetrics = filters?.metrics?.slice() || defaultMetrics;
    if (!selectedMetrics.includes('cost_micros')) {
      selectedMetrics.push('cost_micros');
    }
    const metricsQuery = selectedMetrics.map(m => `metrics.${m}`).join(', ');

    // Datumfilter
    let dateCondition = 'segments.date DURING LAST_30_DAYS';
    if (filters?.dateRange) {
      const dr = filters.dateRange;
      if (dr === 'LAST_7_DAYS') dateCondition = 'segments.date DURING LAST_7_DAYS';
      else if (dr === 'LAST_14_DAYS')
        dateCondition = 'segments.date DURING LAST_14_DAYS';
      else if (dr === 'LAST_90_DAYS')
        dateCondition = 'segments.date DURING LAST_90_DAYS';
      else if (
        dr === 'CUSTOM' &&
        filters.startDate &&
        filters.endDate
      ) {
        const sd = new Date(filters.startDate)
          .toISOString()
          .split('T')[0]
          .replace(/-/g, '');
        const ed = new Date(filters.endDate)
          .toISOString()
          .split('T')[0]
          .replace(/-/g, '');
        dateCondition = `segments.date BETWEEN '${sd}' AND '${ed}'`;
      }
    }

    const limit = filters?.limit || 50;

    // GAQL-query
    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.name AS campaign_name,
        segments.device,
        ${metricsQuery}
      FROM ad_group
      WHERE ${dateCondition}
      ORDER BY metrics.impressions DESC
      LIMIT ${limit}`;

    console.log('📊 Generated AdGroup query:', query.trim());

    // API-call (zonder extra parameters in de payload)
    const customerId = account.customer_id.replace(/-/g, '');
    let response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
          'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      }
    );

    // Token-refresh fallback
    if (response.status === 401) {
      const newTokens = await getRefreshedToken(
        refreshToken,
        accountId,
        supabaseAdmin
      );
      response = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newTokens.access_token}`,
            'developer-token': Deno.env.get(
              'GOOGLE_ADS_DEVELOPER_TOKEN'
            )!,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query }),
        }
      );
    }

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ API Error:', err);
      throw new Error(`Google Ads API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    console.log('✅ Raw API response received');

    // Mappen en kosten omrekenen
    const adGroups =
      data[0]?.results?.map((row: any) => ({
        id: row.ad_group?.id,
        name: row.ad_group?.name,
        status: row.ad_group?.status,
        campaign_name: row.campaign_name,
        device: row.segments?.device,
        metrics: {
          ...row.metrics,
          cost: (row.metrics.cost_micros || 0) / 1e6,
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
