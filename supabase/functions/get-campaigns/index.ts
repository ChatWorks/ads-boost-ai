import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';
import { 
  getCachedData, 
  setCachedData, 
  generateCacheKey, 
  generateQueryHash,
  cleanupExpiredCache 
} from '../shared/metricsCache.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string, accountId: string, supabaseAdmin: any) {
  console.log('🔐 Attempting to refresh token...');
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
  }
  const tokenData = await response.json();
  return tokenData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { accountId, filters, useCache = true } = await req.json();
    if (!accountId) throw new Error('Account ID is required');

    // Clean up expired cache entries periodically
    await cleanupExpiredCache();

    // Generate cache key for this request
    const dateRange = filters?.dateRange || 'LAST_30_DAYS';
    const metrics = filters?.metrics || [];
    const cacheKey = generateCacheKey('campaigns', dateRange, metrics);
    const queryHash = await generateQueryHash({ accountId, filters });

    // Try to get cached data first (if useCache is true)
    if (useCache) {
      const cachedData = await getCachedData({
        accountId,
        cacheKey,
        ttlHours: 1 // 1 hour cache for campaign data
      });

      if (cachedData) {
        console.log('Returning cached campaign data');
        return new Response(
          JSON.stringify({
            ...cachedData.data,
            cached: true,
            cached_at: cachedData.created_at,
            expires_at: cachedData.expires_at
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: account, error } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId)
      .single();
    if (error || !account) throw new Error('Google Ads account not found.');
    if (account.needs_reconnection) throw new Error('Account requires reconnection.');

    // refresh token
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const { access_token } = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);

    // metrics: accept full field paths and plain metric names
    const defaultMetrics = [
      'impressions', 
      'clicks', 
      'cost_micros', 
      'ctr', 
      'conversions',
      'conversion_value',
      'value_per_conversion',
      'search_impression_share',
      'absolute_top_impression_share',
      'top_impression_share'
    ];
    const incoming = filters?.metrics?.slice() || defaultMetrics;
    const normalized = incoming.map((f: string) => {
      if (!f) return '';
      const t = f.trim();
      if (t.startsWith('metrics.') || t.includes('.')) return t; // already a full path or non-metric field
      return `metrics.${t}`;
    }).filter(Boolean);
    const metricsQuery = normalized.join(', ');

    // datum
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

    // status
    const statuses = filters?.campaignStatus || ['ENABLED'];
    const statusCondition = `campaign.status IN (${statuses.map(s => `'${s}'`).join(',')})`;

    const limit = filters?.limit || 50;
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        ${metricsQuery}
      FROM campaign
      WHERE ${dateCondition}
        AND ${statusCondition}
      ORDER BY metrics.impressions DESC
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
        body: JSON.stringify({ query }),
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
          body: JSON.stringify({ query }),
        }
      );
    }
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Ads API error (${response.status}): ${err}`);
    }
    const data = await response.json();
    const campaigns = data[0]?.results?.map((row: any) => ({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status,
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1e6,
        average_cpc: (row.metrics.average_cpc || 0) / 1e6,
        cost_per_conversion: (row.metrics.cost_per_conversion || 0) / 1e6,
        conversion_value_dollars: (row.metrics.conversion_value || 0) / 1e6,
        value_per_conversion_dollars: (row.metrics.value_per_conversion || 0) / 1e6,
        conversion_rate:
          row.metrics.clicks > 0 && row.metrics.conversions > 0
            ? row.metrics.conversions / row.metrics.clicks
            : 0,
        // Calculated ROAS (Return on Ad Spend)
        roas: row.metrics.conversion_value > 0 && row.metrics.cost_micros > 0
          ? (row.metrics.conversion_value / row.metrics.cost_micros)
          : 0,
        // Calculated ROMI (Return on Marketing Investment) - percentage
        romi: row.metrics.conversion_value > 0 && row.metrics.cost_micros > 0
          ? ((row.metrics.conversion_value - row.metrics.cost_micros) / row.metrics.cost_micros) * 100
          : 0,
        // CPM (Cost per 1000 impressions)
        cpm: row.metrics.impressions > 0 && row.metrics.cost_micros > 0
          ? (row.metrics.cost_micros / row.metrics.impressions) * 1000 / 1e6
          : 0,
      },
    })) || [];

    // update fetch timestamp
    await supabaseAdmin
      .from('google_ads_accounts')
      .update({ last_successful_fetch: new Date().toISOString() })
      .eq('id', accountId);

    const result = { campaigns };

    // Cache the result for future requests
    if (useCache && campaigns?.length > 0) {
      await setCachedData(
        { accountId, cacheKey, ttlHours: 1 },
        result,
        queryHash
      );
    }

    return new Response(
      JSON.stringify({
        ...result,
        cached: false,
        fetched_at: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
