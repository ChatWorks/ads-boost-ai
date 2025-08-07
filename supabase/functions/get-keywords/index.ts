import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string, accountId: string, supabaseAdmin: any) {
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
    throw new Error(`Failed to refresh token: ${resp.status} - ${txt}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    console.log('🔍 get-keywords function called');
    const { accountId, filters } = await req.json();
    console.log('📝 Request data:', { accountId, filters });
    if (!accountId) throw new Error('Account ID is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    console.log('🔑 Fetching account data for ID:', accountId);
    const { data: account, error } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId)
      .single();
    if (error || !account) {
      console.error('❌ Account fetch error:', error);
      throw new Error('Google Ads account not found.');
    }
    if (account.needs_reconnection) {
      console.error('🔄 Account needs reconnection');
      throw new Error('Account requires reconnection.');
    }

    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const { access_token } = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);

    const selectedMetrics = filters?.metrics || ['clicks', 'cost_micros', 'impressions'];
    const metricsQuery = selectedMetrics.map(m => `metrics.${m}`).join(', ');

    let dateCondition = 'segments.date DURING LAST_30_DAYS';
    if (filters?.dateRange) {
      const dr = filters.dateRange;
      if (dr === 'LAST_7_DAYS') dateCondition = 'segments.date DURING LAST_7_DAYS';
      else if (dr === 'LAST_14_DAYS') dateCondition = 'segments.date DURING LAST_14_DAYS';
      else if (dr === 'LAST_90_DAYS') dateCondition = 'segments.date DURING LAST_90_DAYS';
      else if (dr === 'CUSTOM' && filters.startDate && filters.endDate) {
        const sd = filters.startDate.replace(/-/g, '');
        const ed = filters.endDate.replace(/-/g, '');
        dateCondition = `segments.date BETWEEN '${sd}' AND '${ed}'`;
      }
    }

    const limit = filters?.limit || 200;
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
      WHERE ${dateCondition}
      ORDER BY metrics.clicks DESC
      LIMIT ${limit}`;

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
        body: JSON.stringify({
          query,
          includeDrafts: true,
          omitUnselectedResourceNames: false,
        }),
      }
    );
    
    // token refresh fallback
    if (response.status === 401) {
      const newTokens = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);
      response = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newTokens.access_token}`,
            'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({
            query,
            includeDrafts: true,
            omitUnselectedResourceNames: false,
          }),
        }
      );
    }
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Ads API error (${response.status}): ${err}`);
    }
    const data = await response.json();
    const keywords = data[0]?.results?.map((row: any) => ({
      campaign_id: row.campaign?.id,
      campaign_name: row.campaign?.name,
      ad_group_id: row.ad_group?.id,
      ad_group_name: row.ad_group?.name,
      keyword_text: row.ad_group_criterion?.keyword?.text,
      match_type: row.ad_group_criterion?.keyword?.match_type,
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1e6,
      },
    })) || [];

    console.log('✅ Successfully fetched keywords:', keywords.length);
    return new Response(JSON.stringify({ keywords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('❌ Error in get-keywords:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
