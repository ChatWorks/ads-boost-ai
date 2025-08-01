import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_ADS_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error('Failed to refresh token');
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { accountId } = await req.json();
    if (!accountId) throw new Error('Account ID is required');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: account, error: accountError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, access_token, refresh_token')
      .eq('id', accountId).single();

    if (accountError || !account) throw new Error('Google Ads account not found.');

    let accessToken = await decrypt(account.access_token, Deno.env.get('ENCRYPTION_KEY')!);

    const query = `
      SELECT 
        campaign.id, campaign.name, campaign.status,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, 
        metrics.average_cpc, metrics.conversions, metrics.cost_per_conversion
      FROM campaign 
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.impressions DESC`;

    const makeApiCall = async (token: string) => {
      const customerId = account.customer_id.replace(/-/g, '');
      return await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      });
    };

    let response = await makeApiCall(accessToken);

    if (response.status === 401) {
      console.log('Access token expired, refreshing...');
      const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
      const newTokens = await getRefreshedToken(refreshToken);
      accessToken = newTokens.access_token;
      response = await makeApiCall(accessToken);
    }

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.error.message || 'Failed to fetch campaigns from Google Ads API.');
    }

    const data = await response.json();
    const campaigns = data[0]?.results.map((row: any) => ({
      ...row.campaign,
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1000000,
        average_cpc: (row.metrics.average_cpc || 0) / 1000000,
        cost_per_conversion: (row.metrics.cost_per_conversion || 0) / 1000000,
      }
    })) || [];

    return new Response(JSON.stringify({ campaigns }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});