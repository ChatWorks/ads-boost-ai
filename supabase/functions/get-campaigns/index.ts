import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string) {
  console.log('🔐 Attempting to refresh token...');
  
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  
  console.log('🔑 Client ID available:', !!clientId);
  console.log('🔑 Client Secret available:', !!clientSecret);
  console.log('🔑 Refresh token length:', refreshToken?.length || 0);
  
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
  
  console.log('🔄 Refresh response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Refresh token error:', errorText);
    throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
  }
  
  const tokenData = await response.json();
  console.log('✅ Token refresh successful');
  return tokenData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    console.log('🚀 get-campaigns function called');
    
    const { accountId } = await req.json();
    console.log('📝 Account ID:', accountId);
    
    if (!accountId) throw new Error('Account ID is required');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    console.log('🔍 Fetching account from database...');
    const { data: account, error: accountError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token')
      .eq('id', accountId).single();

    if (accountError) {
      console.error('❌ Database error:', accountError);
      throw new Error(`Database error: ${accountError.message}`);
    }
    
    if (!account) {
      console.error('❌ Account not found');
      throw new Error('Google Ads account not found.');
    }
    
    console.log('✅ Account found:', account.customer_id);

    // Get a fresh access token using the refresh token
    console.log('🔄 Getting fresh access token...');
    console.log('🔐 Encrypted refresh token length:', account.refresh_token?.length || 0);
    
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    console.log('🔓 Decrypted refresh token length:', refreshToken?.length || 0);
    console.log('🔓 Decrypted refresh token starts with:', refreshToken?.substring(0, 10) + '...');
    
    const tokenResponse = await getRefreshedToken(refreshToken);
    const accessToken = tokenResponse.access_token;
    console.log('✅ Got fresh access token');

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
      console.log('📡 Making API call to Google Ads for customer:', customerId);
      
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

    console.log('📊 API Response status:', response.status);

    if (response.status === 401) {
      console.log('🔄 Access token expired, refreshing...');
      const newTokens = await getRefreshedToken(refreshToken);
      const newAccessToken = newTokens.access_token;
      response = await makeApiCall(newAccessToken);
      console.log('📊 API Response status after refresh:', response.status);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ API Error:', errorBody);
      throw new Error(`Google Ads API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    console.log('✅ Raw API response:', JSON.stringify(data).substring(0, 200) + '...');
    
    const campaigns = data[0]?.results?.map((row: any) => ({
      ...row.campaign,
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1000000,
        average_cpc: (row.metrics.average_cpc || 0) / 1000000,
        cost_per_conversion: (row.metrics.cost_per_conversion || 0) / 1000000,
      }
    })) || [];

    console.log(`✅ Processed ${campaigns.length} campaigns`);

    return new Response(JSON.stringify({ campaigns }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('💥 Function error:', err.message);
    console.error('💥 Full error:', err);
    
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});