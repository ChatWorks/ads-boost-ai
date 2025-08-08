import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ContextRequest {
  account_id: string;
  user_query?: string;
  filters?: any;
  debug?: 'full' | 'summary' | number | boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { account_id, user_query, filters = {}, debug }: ContextRequest = await req.json();
    
    if (!account_id) {
      throw new Error('account_id is required');
    }

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    console.log('Fetching account context for account:', account_id, 'user:', user.id);

    // Verify user has access to this account
    const { data: accountAccess, error: accessError } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('id, account_name, customer_id, connection_status, last_successful_fetch')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single();

    if (accessError || !accountAccess) {
      return new Response(JSON.stringify({
        error: 'Account not found or access denied',
        code: 'account_access_denied'
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (accountAccess.connection_status !== 'CONNECTED') {
      return new Response(JSON.stringify({
        error: 'Account is not connected',
        code: 'account_not_connected'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch consolidated data in parallel
    const [campaignsResult, adGroupsResult, keywordsResult] = await Promise.allSettled([
      supabaseAdmin.functions.invoke('get-campaigns', {
        body: { 
          accountId: account_id,
           filters: {
             ...filters,
             metrics: [
               'metrics.clicks',
               'metrics.impressions',
               'metrics.cost_micros',
               'metrics.conversions',
               'metrics.ctr',
               'metrics.average_cpc'
             ]
           }
        }
      }),
      supabaseAdmin.functions.invoke('get-adgroups', {
        body: { 
          accountId: account_id,
           filters: { 
             ...filters,
             metrics: [
               'metrics.clicks',
               'metrics.impressions',
               'metrics.cost_micros',
               'metrics.conversions',
               'metrics.ctr',
               'metrics.average_cpc'
             ]
           }
        }
      }),
      supabaseAdmin.functions.invoke('get-keywords', {
        body: { 
          accountId: account_id,
           filters: { 
             ...filters,
             metrics: [
               'metrics.clicks',
               'metrics.impressions',
               'metrics.cost_micros',
               'metrics.conversions',
               'metrics.ctr',
               'metrics.average_cpc'
             ]
           }
        }
      })
    ]);

    // Process results
    const campaigns = campaignsResult.status === 'fulfilled' && campaignsResult.value.data?.campaigns ? 
      campaignsResult.value.data.campaigns : [];
    const adGroups = adGroupsResult.status === 'fulfilled' && adGroupsResult.value.data?.adGroups ? 
      adGroupsResult.value.data.adGroups : [];
    const keywords = keywordsResult.status === 'fulfilled' && keywordsResult.value.data?.keywords ? 
      keywordsResult.value.data.keywords : [];

    console.log('Data fetched - Campaigns:', campaigns.length, 'AdGroups:', adGroups.length, 'Keywords:', keywords.length);

    // Summary log for observability
    console.log('Context summary', JSON.stringify({
      user_id: user.id,
      account_id,
      date_range: (filters as any)?.dateRange ?? 'LAST_30_DAYS',
      counts: { campaigns: campaigns.length, ad_groups: adGroups.length, keywords: keywords.length }
    }));

    // Optional verbose logging per dataset
    const __debugFlag = (filters as any)?.debug ?? debug ?? false;
    if (__debugFlag) {
      const mode = __debugFlag === 'full' || __debugFlag === true
        ? 'full'
        : (__debugFlag === 'summary' ? 'summary' : (typeof __debugFlag === 'number' ? __debugFlag : 'summary'));

      console.log('🟡 Debug mode enabled for account context', JSON.stringify({ user_id: user.id, account_id, mode }));

      const logChunks = (name: string, arr: any[], chunkSize = 50) => {
        if (mode === 'summary') {
          console.log(`🔹 ${name} sample (up to 5)`, JSON.stringify(arr.slice(0, 5)));
          return;
        }
        const items = typeof mode === 'number' ? arr.slice(0, mode) : arr;
        for (let i = 0; i < items.length; i += chunkSize) {
          const end = Math.min(i + chunkSize - 1, items.length - 1);
          console.log(`🔹 ${name} [${i}-${end}]`, JSON.stringify(items.slice(i, i + chunkSize)));
        }
      };

      logChunks('Campaigns payload', campaigns);
      logChunks('AdGroups payload', adGroups);
      logChunks('Keywords payload', keywords);
    }

    // Build account summary
    const account_summary = {
      account_name: accountAccess.account_name,
      customer_id: accountAccess.customer_id,
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter((c: any) => c.campaign?.status === 'ENABLED').length,
      connection_status: accountAccess.connection_status,
      data_freshness: getDataFreshness(accountAccess.last_successful_fetch)
    };

    // Build performance snapshot
    const performance_snapshot = buildPerformanceSnapshot(campaigns);
    
    // Generate insights
    const insights_summary = generateInsights(campaigns, adGroups, keywords);
    
    // Generate actionable recommendations
    const actionable_recommendations = generateRecommendations(campaigns, adGroups, keywords, user_query);
    
    // Generate natural language summaries
    const natural_language = generateNaturalLanguage(account_summary, performance_snapshot, insights_summary);

    // Prepare query-specific data
    let query_specific_data = null;
    if (user_query) {
      query_specific_data = prepareQuerySpecificData(campaigns, adGroups, keywords, user_query);
    }

    const contextData = {
      account_summary,
      performance_snapshot,
      insights_summary,
      actionable_recommendations,
      natural_language,
      query_specific_data,
      data_timestamp: new Date().toISOString(),
      data_completeness: calculateDataCompleteness(campaigns, adGroups, keywords)
    };

    console.log('Context prepared successfully');

    return new Response(JSON.stringify(contextData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-account-context function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      type: 'context_error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildPerformanceSnapshot(campaigns: any[]) {
  const activeCampaigns = campaigns.filter((c: any) => c.campaign?.status === 'ENABLED');
  
  if (activeCampaigns.length === 0) {
    return {
      total_spend: 0,
      total_clicks: 0,
      total_impressions: 0,
      total_conversions: 0,
      overall_ctr: 0,
      overall_cpc: 0,
      conversion_rate: 0,
      top_campaigns: []
    };
  }

  const totals = activeCampaigns.reduce((acc: any, campaign: any) => ({
    spend: acc.spend + (campaign.metrics?.cost || 0),
    clicks: acc.clicks + (campaign.metrics?.clicks || 0),
    impressions: acc.impressions + (campaign.metrics?.impressions || 0),
    conversions: acc.conversions + (campaign.metrics?.conversions || 0)
  }), { spend: 0, clicks: 0, impressions: 0, conversions: 0 });

  const topCampaigns = activeCampaigns
    .sort((a: any, b: any) => (b.metrics?.conversions || 0) - (a.metrics?.conversions || 0))
    .slice(0, 5)
    .map((campaign: any) => ({
      name: campaign.campaign?.name || '',
      spend: campaign.metrics?.cost || 0,
      conversions: campaign.metrics?.conversions || 0,
      ctr: campaign.metrics?.ctr || 0,
      status: campaign.campaign?.status || ''
    }));

  return {
    total_spend: totals.spend,
    total_clicks: totals.clicks,
    total_impressions: totals.impressions,
    total_conversions: totals.conversions,
    overall_ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    overall_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    conversion_rate: totals.clicks > 0 ? totals.conversions / totals.clicks : 0,
    top_campaigns: topCampaigns
  };
}

function generateInsights(campaigns: any[], adGroups: any[], keywords: any[]) {
  const key_opportunities = [];
  const main_concerns = [];

  // Analyze campaigns for opportunities and concerns
  const activeCampaigns = campaigns.filter((c: any) => c.campaign?.status === 'ENABLED');
  const lowPerformingCampaigns = activeCampaigns.filter((c: any) => {
    const cost = c.metrics?.cost || 0;
    const conversions = c.metrics?.conversions || 0;
    return cost > 100 && conversions === 0;
  });

  const highPerformingCampaigns = activeCampaigns.filter((c: any) => {
    const clicks = c.metrics?.clicks || 0;
    const conversions = c.metrics?.conversions || 0;
    return clicks > 0 && conversions / clicks > 0.05;
  });

  if (lowPerformingCampaigns.length > 0) {
    main_concerns.push(`${lowPerformingCampaigns.length} campaigns spending without conversions`);
  }

  if (highPerformingCampaigns.length > 0) {
    key_opportunities.push(`${highPerformingCampaigns.length} high-performing campaigns could benefit from increased budget`);
  }

  // Keyword analysis
  const highVolumeKeywords = keywords.filter((k: any) => (k.metrics?.clicks || 0) > 100);
  if (highVolumeKeywords.length > 0) {
    key_opportunities.push(`${highVolumeKeywords.length} high-volume keywords identified for optimization`);
  }

  return {
    key_opportunities,
    main_concerns,
    performance_trends: ['CTR trending stable', 'CPC within normal ranges'], // Would be calculated from historical data
    budget_efficiency: activeCampaigns.length > 0 ? 'Moderate' : 'No active campaigns'
  };
}

function generateRecommendations(campaigns: any[], adGroups: any[], keywords: any[], userQuery?: string) {
  const recommendations = [];

  // Budget recommendations
  const activeCampaigns = campaigns.filter((c: any) => c.campaign?.status === 'ENABLED');
  
  activeCampaigns.forEach((campaign: any) => {
    const cost = campaign.metrics?.cost || 0;
    const conversions = campaign.metrics?.conversions || 0;
    const clicks = campaign.metrics?.clicks || 0;
    
    if (cost > 0 && conversions > 0) {
      const conversionRate = conversions / clicks;
      const costPerConversion = cost / conversions;
      
      if (conversionRate > 0.05 && costPerConversion < 50) {
        recommendations.push({
          type: 'budget',
          priority: 'high',
          title: `Increase budget for ${campaign.campaign?.name}`,
          description: `High conversion rate (${(conversionRate * 100).toFixed(1)}%) with low cost per conversion ($${costPerConversion.toFixed(2)})`,
          potential_impact: `Could increase conversions by 20-30%`,
          confidence_score: 0.85,
          affected_entity: campaign.campaign?.name
        });
      }
    } else if (cost > 100 && conversions === 0) {
      recommendations.push({
        type: 'campaign',
        priority: 'high',
        title: `Review underperforming campaign: ${campaign.campaign?.name}`,
        description: `High spend ($${cost.toFixed(2)}) with no conversions`,
        potential_impact: `Could save $${(cost * 0.5).toFixed(2)} in wasted spend`,
        confidence_score: 0.75,
        affected_entity: campaign.campaign?.name
      });
    }
  });

  // Keyword recommendations
  const topKeywords = keywords
    .filter((k: any) => (k.metrics?.clicks || 0) > 10)
    .sort((a: any, b: any) => (b.metrics?.clicks || 0) - (a.metrics?.clicks || 0))
    .slice(0, 5);

  topKeywords.forEach((keyword: any) => {
    const clicks = keyword.metrics?.clicks || 0;
    const conversions = keyword.metrics?.conversions || 0;
    const cost = keyword.metrics?.cost || 0;
    
    if (clicks > 0) {
      const conversionRate = conversions / clicks;
      if (conversionRate < 0.01 && cost > 50) {
        recommendations.push({
          type: 'keyword',
          priority: 'medium',
          title: `Optimize keyword: ${keyword.ad_group_criterion?.keyword?.text}`,
          description: `Low conversion rate (${(conversionRate * 100).toFixed(2)}%) with high cost ($${cost.toFixed(2)})`,
          potential_impact: `Could reduce costs by optimizing bid or match type`,
          confidence_score: 0.70,
          affected_entity: keyword.ad_group_criterion?.keyword?.text
        });
      }
    }
  });

  return recommendations.slice(0, 10); // Return top 10 recommendations
}

function generateNaturalLanguage(accountSummary: any, performanceSnapshot: any, insights: any) {
  const executive_summary = `Account "${accountSummary.account_name}" has ${accountSummary.total_campaigns} total campaigns with ${accountSummary.active_campaigns} currently active. Total spend of $${performanceSnapshot.total_spend.toFixed(2)} has generated ${performanceSnapshot.total_conversions} conversions.`;

  const performance_narrative = `Performance shows an overall CTR of ${(performanceSnapshot.overall_ctr * 100).toFixed(2)}% and CPC of $${performanceSnapshot.overall_cpc.toFixed(2)}. Conversion rate is ${(performanceSnapshot.conversion_rate * 100).toFixed(2)}%.`;

  const insights_narrative = insights.key_opportunities.length > 0 
    ? `Key opportunities: ${insights.key_opportunities.join(', ')}`
    : 'No major optimization opportunities identified at this time.';

  return {
    executive_summary,
    performance_narrative,
    insights_narrative
  };
}

function prepareQuerySpecificData(campaigns: any[], adGroups: any[], keywords: any[], query: string) {
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes('budget') || queryLower.includes('spend')) {
    const totalSpend = campaigns.reduce((sum: number, c: any) => sum + (c.metrics?.cost || 0), 0);
    return {
      type: 'budget_analysis',
      total_spend: totalSpend,
      campaign_spend: campaigns.map((c: any) => ({
        name: c.campaign?.name,
        spend: c.metrics?.cost || 0,
        status: c.campaign?.status
      })).filter((c: any) => c.spend > 0)
    };
  }
  
  if (queryLower.includes('keyword')) {
    return {
      type: 'keyword_analysis',
      total_keywords: keywords.length,
      top_keywords: keywords
        .filter((k: any) => (k.metrics?.clicks || 0) > 0)
        .sort((a: any, b: any) => (b.metrics?.clicks || 0) - (a.metrics?.clicks || 0))
        .slice(0, 10)
        .map((k: any) => ({
          text: k.ad_group_criterion?.keyword?.text,
          clicks: k.metrics?.clicks,
          conversions: k.metrics?.conversions,
          cost: k.metrics?.cost
        }))
    };
  }
  
  return null;
}

function getDataFreshness(lastFetch: string | null): string {
  if (!lastFetch) return 'never';
  
  const now = new Date();
  const fetchDate = new Date(lastFetch);
  const hoursDiff = (now.getTime() - fetchDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff < 1) return 'fresh';
  if (hoursDiff < 24) return 'recent';
  return 'stale';
}

function calculateDataCompleteness(campaigns: any[], adGroups: any[], keywords: any[]): number {
  let score = 0;
  
  if (campaigns.length > 0) score += 0.4;
  if (adGroups.length > 0) score += 0.3;
  if (keywords.length > 0) score += 0.3;
  
  return score;
}