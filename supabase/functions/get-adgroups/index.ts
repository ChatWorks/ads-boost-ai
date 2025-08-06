import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../_shared/encryption.ts';

const GOOGLE_ADS_API_VERSION = 'v20';

async function getRefreshedToken(refreshToken: string, accountId: string, supabaseAdmin: any) {
  console.log('🔐 Attempting to refresh token...');
  
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('✅ Token refresh successful');
    
    return tokenData;
  } catch (error) {
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    console.log('🚀 get-adgroups function called');
    
    const { accountId, filters } = await req.json();
    console.log('📝 Account ID:', accountId);
    console.log('📝 Filters:', JSON.stringify(filters, null, 2));
    
    if (!accountId) throw new Error('Account ID is required');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    console.log('🔍 Fetching account from database...');
    const { data: account, error: accountError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId).single();

    if (accountError || !account) {
      throw new Error('Google Ads account not found.');
    }
    
    if (account.needs_reconnection) {
      throw new Error('Account requires reconnection.');
    }
    
    console.log('✅ Account found:', account.customer_id);

    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);
    const tokenResponse = await getRefreshedToken(refreshToken, accountId, supabaseAdmin);
    const accessToken = tokenResponse.access_token;
    console.log('✅ Got fresh access token');

    // Build dynamic query based on filters
    const selectedMetrics = filters?.metrics || ['impressions', 'clicks', 'cost_micros'];
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
      }
    }

    const limit = filters?.limit || 50;

    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.name as campaign_name,
        segments.device,
        ${metricsQuery}
      FROM ad_group
      WHERE ${dateCondition}
      ORDER BY metrics.impressions DESC
      LIMIT ${limit}`;

    console.log('📊 Generated AdGroup query:', query);

    const customerId = account.customer_id.replace(/-/g, '');
    console.log('📡 Making API call to Google Ads for customer:', customerId);
    
    const response = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
        'login-customer-id': customerId,
      },
      body: JSON.stringify({ 
        query,
        parameters: {
          include_drafts: true,
          omit_unselected_resource_names: false
        }
      }),
    });

    console.log('📊 API Response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ API Error:', errorBody);
      throw new Error(`Google Ads API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    console.log('✅ Raw API response:', JSON.stringify(data).substring(0, 200) + '...');
    
    const adGroups = data[0]?.results?.map((row: any) => ({
      id: row.ad_group?.id,
      name: row.ad_group?.name,
      status: row.ad_group?.status,
      campaign_name: row.campaign?.name,
      device: row.segments?.device,
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1000000,
      }
    })) || [];

    console.log(`✅ Processed ${adGroups.length} ad groups`);

    return new Response(JSON.stringify({ adGroups }), {
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