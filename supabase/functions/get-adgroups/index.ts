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
    const { accountId, filters } = await req.json();
    if (!accountId) throw new Error('Account ID is required');

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

    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const { access_token } = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);

    const selectedMetrics = filters?.metrics || ['impressions', 'clicks', 'cost_micros'];
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

    const limit = filters?.limit || 50;
    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.name,
        segments.device,
        ${metricsQuery}
      FROM ad_group
      WHERE ${dateCondition}
      ORDER BY metrics.impressions DESC
      LIMIT ${limit}`;

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
        body: JSON.stringify({
          query,
          includeDrafts: true,
          omitUnselectedResourceNames: false,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Ads API error (${response.status}): ${err}`);
    }
    const data = await response.json();
    const adGroups = data[0]?.results?.map((row: any) => ({
      id: row.ad_group?.id,
      name: row.ad_group?.name,
      status: row.ad_group?.status,
      campaign_name: row.campaign?.name,
      device: row.segments?.device,
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1e6,
      },
    })) || [];

    return new Response(JSON.stringify({ adGroups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
