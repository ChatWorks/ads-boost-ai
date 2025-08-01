import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string, accountId: string, supabaseAdmin: any) {
  console.log('🔐 Attempting to refresh token...');
  
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  
  console.log('🔑 Client ID available:', !!clientId);
  console.log('🔑 Client Secret available:', !!clientSecret);
  console.log('🔑 Refresh token length:', refreshToken?.length || 0);
  
  try {
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
      
      // Update account with error status
      await supabaseAdmin
        .from('google_ads_accounts')
        .update({
          connection_status: 'ERROR',
          needs_reconnection: true,
          last_error_message: `Token refresh failed: ${errorText}`,
          last_error_at: new Date().toISOString()
        })
        .eq('id', accountId);
      
      throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('✅ Token refresh successful');
    
    // Update token expiration time (tokens typically expire in 1 hour)
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    await supabaseAdmin
      .from('google_ads_accounts')
      .update({
        token_expires_at: expiresAt.toISOString(),
        connection_status: 'CONNECTED',
        needs_reconnection: false,
        last_error_message: null,
        last_error_at: null
      })
      .eq('id', accountId);
    
    return tokenData;
  } catch (error) {
    // Update account with error status
    await supabaseAdmin
      .from('google_ads_accounts')
      .update({
        connection_status: 'ERROR',
        needs_reconnection: true,
        last_error_message: error.message,
        last_error_at: new Date().toISOString()
      })
      .eq('id', accountId);
    
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    console.log('🚀 get-campaigns function called');
    
    const { accountId, filters } = await req.json();
    console.log('📝 Account ID:', accountId);
    console.log('📝 Filters:', JSON.stringify(filters, null, 2));
    
    if (!accountId) throw new Error('Account ID is required');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    console.log('🔍 Fetching account from database...');
    const { data: account, error: accountError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection, connection_status')
      .eq('id', accountId).single();

    if (accountError) {
      console.error('❌ Database error:', accountError);
      throw new Error(`Database error: ${accountError.message}`);
    }
    
    if (!account) {
      console.error('❌ Account not found');
      throw new Error('Google Ads account not found.');
    }
    
    // Check if account needs reconnection
    if (account.needs_reconnection) {
      console.error('❌ Account needs reconnection');
      throw new Error('Account requires reconnection. Please reconnect your Google Ads account in the integrations page.');
    }
    
    console.log('✅ Account found:', account.customer_id);

    // Get a fresh access token using the refresh token
    console.log('🔄 Getting fresh access token...');
    console.log('🔐 Encrypted refresh token length:', account.refresh_token?.length || 0);
    
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    console.log('🔓 Decrypted refresh token length:', refreshToken?.length || 0);
    console.log('🔓 Decrypted refresh token starts with:', refreshToken?.substring(0, 10) + '...');
    
    const tokenResponse = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);
    const accessToken = tokenResponse.access_token;
    console.log('✅ Got fresh access token');

    // Build dynamic query based on filters
    const selectedMetrics = filters?.metrics || ['impressions', 'clicks', 'cost_micros', 'ctr', 'conversions'];
    const metricsQuery = selectedMetrics.map(metric => `metrics.${metric}`).join(', ');
    
    // Build date condition
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
            const startDate = new Date(filters.startDate).toISOString().split('T')[0].replace(/-/g, '');
            const endDate = new Date(filters.endDate).toISOString().split('T')[0].replace(/-/g, '');
            dateCondition = `segments.date BETWEEN '${startDate}' AND '${endDate}'`;
          }
          break;
        default:
          dateCondition = 'segments.date DURING LAST_30_DAYS';
      }
    }

    // Build status condition
    const allowedStatuses = filters?.campaignStatus || ['ENABLED'];
    let statusCondition = allowedStatuses.map(status => `'${status}'`).join(', ');
    if (!allowedStatuses.includes('REMOVED')) {
      statusCondition = `campaign.status IN (${statusCondition})`;
    } else {
      statusCondition = `campaign.status IN (${statusCondition})`;
    }

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

    console.log('📊 Generated query:', query);

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
      const newTokens = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);
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
        // Calculate conversion rate manually if we have conversions and clicks
        conversion_rate: (row.metrics.clicks > 0 && row.metrics.conversions > 0) 
          ? (row.metrics.conversions / row.metrics.clicks) 
          : 0,
      }
    })) || [];

    console.log(`✅ Processed ${campaigns.length} campaigns`);

    // Update successful fetch timestamp
    await supabaseAdmin
      .from('google_ads_accounts')
      .update({ last_successful_fetch: new Date().toISOString() })
      .eq('id', accountId);

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