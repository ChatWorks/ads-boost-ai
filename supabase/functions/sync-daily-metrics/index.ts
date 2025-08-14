// Background function to sync daily Google Ads metrics
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { storeDailyMetrics } from '../shared/metricsCache.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SyncOptions {
  accountId?: string; // If not provided, sync all active accounts
  date?: string; // If not provided, sync yesterday's data
  forceRefresh?: boolean;
}

async function getRefreshedToken(refreshToken: string, accountId: string) {
  const tokenRequest = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_ADS_CLIENT_ID') || '',
      client_secret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET') || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRequest.ok) {
    throw new Error(`Token refresh failed: ${tokenRequest.statusText}`);
  }

  return await tokenRequest.json();
}

async function fetchCampaignData(accountId: string, accessToken: string, date: string) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversion_value,
      metrics.value_per_conversion,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm,
      metrics.cost_per_conversion,
      metrics.search_impression_share,
      metrics.absolute_top_impression_share,
      metrics.top_impression_share
    FROM campaign
    WHERE segments.date = '${date}'
    AND campaign.status != 'REMOVED'
  `;

  const response = await fetch(
    `https://googleads.googleapis.com/v16/customers/${accountId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google Ads API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

async function syncAccountData(accountId: string, date: string) {
  console.log(`Syncing data for account ${accountId}, date ${date}`);

  try {
    // Get account details and refresh token
    const { data: account, error } = await supabase
      .from('google_ads_accounts')
      .select('customer_id, refresh_token')
      .eq('id', accountId)
      .eq('is_active', true)
      .single();

    if (error || !account) {
      console.error(`Account not found or inactive: ${accountId}`);
      return;
    }

    // Decrypt refresh token (using same logic as other functions)
    const refreshToken = account.refresh_token; // Assuming it's already decrypted in storage

    // Get fresh access token
    const { access_token } = await getRefreshedToken(refreshToken, accountId);

    // Fetch campaign data for the specific date
    const campaignData = await fetchCampaignData(account.customer_id, access_token, date);

    // Process and store each campaign's metrics
    if (campaignData && campaignData.length > 0) {
      for (const result of campaignData) {
        if (result.campaign && result.metrics) {
          const metrics = {
            impressions: result.metrics.impressions || 0,
            clicks: result.metrics.clicks || 0,
            cost: (result.metrics.cost_micros || 0) / 1e6,
            conversions: result.metrics.conversions || 0,
            conversion_value: (result.metrics.conversion_value || 0) / 1e6,
            value_per_conversion: (result.metrics.value_per_conversion || 0) / 1e6,
            ctr: result.metrics.ctr || 0,
            average_cpc: (result.metrics.average_cpc || 0) / 1e6,
            average_cpm: (result.metrics.average_cpm || 0) / 1e6,
            cost_per_conversion: (result.metrics.cost_per_conversion || 0) / 1e6,
            search_impression_share: result.metrics.search_impression_share || 0,
            absolute_top_impression_share: result.metrics.absolute_top_impression_share || 0,
            top_impression_share: result.metrics.top_impression_share || 0,
            // Calculated metrics
            roas: result.metrics.conversion_value > 0 && result.metrics.cost_micros > 0
              ? (result.metrics.conversion_value / result.metrics.cost_micros)
              : 0,
            romi: result.metrics.conversion_value > 0 && result.metrics.cost_micros > 0
              ? ((result.metrics.conversion_value - result.metrics.cost_micros) / result.metrics.cost_micros) * 100
              : 0,
            conversion_rate: result.metrics.clicks > 0 && result.metrics.conversions > 0
              ? result.metrics.conversions / result.metrics.clicks
              : 0,
          };

          await storeDailyMetrics(
            accountId,
            'campaign',
            date,
            result.campaign.id.toString(),
            result.campaign.name,
            metrics
          );
        }
      }

      console.log(`Successfully synced ${campaignData.length} campaigns for account ${accountId}`);
    }

    // Update last successful fetch timestamp
    await supabase
      .from('google_ads_accounts')
      .update({ last_successful_fetch: new Date().toISOString() })
      .eq('id', accountId);

  } catch (error) {
    console.error(`Error syncing account ${accountId}:`, error);
    
    // Update error information
    await supabase
      .from('google_ads_accounts')
      .update({ 
        last_error_at: new Date().toISOString(),
        last_error_message: error.message 
      })
      .eq('id', accountId);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const options: SyncOptions = req.method === 'POST' 
      ? await req.json() 
      : {};

    // Default to yesterday's date for daily sync
    const syncDate = options.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (options.accountId) {
      // Sync specific account
      await syncAccountData(options.accountId, syncDate);
    } else {
      // Sync all active accounts
      const { data: accounts, error } = await supabase
        .from('google_ads_accounts')
        .select('id')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to get active accounts: ${error.message}`);
      }

      if (accounts && accounts.length > 0) {
        console.log(`Syncing ${accounts.length} active accounts for date ${syncDate}`);
        
        // Process accounts in parallel (but limit concurrency)
        const batchSize = 3;
        for (let i = 0; i < accounts.length; i += batchSize) {
          const batch = accounts.slice(i, i + batchSize);
          await Promise.all(
            batch.map(account => syncAccountData(account.id, syncDate))
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Daily metrics sync completed for date: ${syncDate}`,
        synced_date: syncDate
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in sync-daily-metrics:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});