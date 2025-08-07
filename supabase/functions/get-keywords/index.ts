// file: get-keywords.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string, accountId: string, supabaseAdmin: any) {
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

  const tokenData = await resp.json();
  console.log('✅ Token refresh successful');
  return tokenData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 get-keywords function called');
    const { accountId, filters } = await req.json();
    console.log('📝 Account ID:', accountId);
    console.log('📝 Filters:', JSON.stringify(filters, null, 2));

    if (!accountId) throw new Error('Account ID is required');

    // Initialize Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch account record
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

    // Decrypt and refresh token
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const { access_token } = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);
    console.log('✅ Got fresh access token');

    // Build metrics list, ensuring cost_micros is included
    const defaultMetrics = ['clicks', 'cost_micros', 'impressions'];
    const selectedMetrics = filters?.metrics?.slice() || defaultMetrics;
    if (!selectedMetrics.includes('cost_micros')) selectedMetrics.push('cost_micros');
    const metricsQuery = selectedMetrics.map(m => `metrics.${m}`).join(', ');

    // Build date filter
    let dateCondition = 'segments.date DURING LAST_30_DAYS';
    if (filters?.dateRange) {
      const dr = filters.dateRange;
      if (dr === 'LAST_7_DAYS') dateCondition = 'segments.date DURING LAST_7_DAYS';
      else if (dr === 'LAST_14_DAYS') dateCondition = 'segments.date DURING LAST_14_DAYS';
      else if (dr === 'LAST_90_DAYS') dateCondition = 'segments.date DURING LAST_90_DAYS';
      else if (dr === 'CUSTOM' && filters.startDate && filters.endDate) {
        const sd = new Date(filters.startDate).toISOString().split('T')[0].replace(/-/g, '');
        const ed = new Date(filters.endDate).toISOString().split('T')[0].replace(/-/g, '');
        dateCondition = `segments.date BETWEEN '${sd}' AND '${ed}'`;
      }
    }

    // Limit
    const limit = filters?.limit || 200;

    // Build GAQL query
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

    console.log('📊 Generated Keywords query:', query.trim());

    // Make API call
    const customerId = account.customer_id.replace(/-/g, '');
    const response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
          'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),  // only the query in the payload
      }
    );

    console.log('📊 API Response status:', response.status);
    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ API Error:', errText);
      throw new Error(`Google Ads API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log('✅ Raw API response received');

    // Map results
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

    console.log(`✅ Processed ${keywords.length} keywords`);

    return new Response(JSON.stringify({ keywords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('💥 Function error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
