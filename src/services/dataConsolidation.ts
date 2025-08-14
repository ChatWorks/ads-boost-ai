import { supabase } from '@/integrations/supabase/client';

// Core data interfaces
export interface ConsolidatedAccount {
  id: string;
  customer_id: string;
  account_name: string;
  currency_code: string;
  time_zone: string;
  connection_status: string;
  last_successful_fetch: string | null;
  metrics: AccountMetrics;
}

export interface AccountMetrics {
  total_campaigns: number;
  active_campaigns: number;
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_cpc: number;
  conversion_rate: number;
  last_updated: string;
}

export interface CampaignData {
  id: string;
  name: string;
  status: string;
  type: string;
  budget_amount: number;
  daily_spend: number;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  quality_score?: number;
}

export interface AdGroupData {
  id: string;
  name: string;
  campaign_name: string;
  status: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  avg_position?: number;
}

export interface KeywordData {
  id: string;
  keyword_text: string;
  match_type: string;
  campaign_name: string;
  ad_group_name: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  quality_score?: number;
  search_volume?: number;
}

export interface ConsolidatedAccountData {
  account: ConsolidatedAccount;
  campaigns: CampaignData[];
  adGroups: AdGroupData[];
  keywords: KeywordData[];
  insights: AccountInsights;
}

export interface AccountInsights {
  top_performing_campaigns: CampaignData[];
  underperforming_campaigns: CampaignData[];
  budget_recommendations: BudgetRecommendation[];
  keyword_opportunities: KeywordOpportunity[];
  performance_trends: PerformanceTrend[];
}

export interface BudgetRecommendation {
  campaign_id: string;
  campaign_name: string;
  current_budget: number;
  recommended_budget: number;
  reason: string;
  potential_impact: string;
}

export interface KeywordOpportunity {
  keyword_text: string;
  match_type: string;
  opportunity_type: 'bid_increase' | 'bid_decrease' | 'add_negative' | 'expand_match';
  current_performance: Partial<KeywordData>;
  potential_impact: string;
  recommended_action: string;
}

export interface PerformanceTrend {
  metric: string;
  period: '7d' | '30d' | '90d';
  trend: 'increasing' | 'decreasing' | 'stable';
  change_percentage: number;
  significance: 'high' | 'medium' | 'low';
}

// Data consolidation filters
export interface DataFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  metrics?: string[];
  campaignStatuses?: string[];
  minSpend?: number;
  performanceThreshold?: number;
}

class DataConsolidationService {
  // Remove in-memory cache - now using database cache
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes (legacy)
  private readonly EXTENDED_TTL = 30 * 60 * 1000; // 30 minutes (legacy)

  /**
   * Main method to get consolidated account data
   */
  async getConsolidatedAccountData(
    accountId: string, 
    filters: DataFilters = {}
  ): Promise<ConsolidatedAccountData> {
    // Use database cache via Edge Functions (no local caching needed)

    // Fetch all data in parallel for efficiency
    const [account, campaigns, adGroups, keywords] = await Promise.all([
      this.getAccountMetrics(accountId),
      this.getCampaignData(accountId, filters),
      this.getAdGroupData(accountId, filters),
      this.getKeywordData(accountId, filters)
    ]);

    // Generate insights based on the data
    const insights = await this.generateAccountInsights(campaigns, adGroups, keywords);

    const consolidatedData: ConsolidatedAccountData = {
      account,
      campaigns,
      adGroups,
      keywords,
      insights
    };

    return consolidatedData;
  }

  /**
   * Get account-level metrics and information
   */
  async getAccountMetrics(accountId: string): Promise<ConsolidatedAccount> {
    // Use database cache via Edge Functions (no local caching needed)

    // Get account basic info
    const { data: accountInfo, error } = await supabase
      .from('google_ads_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error) throw error;

    // Calculate aggregate metrics (this would typically come from your analytics)
    const metrics: AccountMetrics = {
      total_campaigns: 0,
      active_campaigns: 0,
      total_spend: 0,
      total_clicks: 0,
      total_impressions: 0,
      avg_ctr: 0,
      avg_cpc: 0,
      conversion_rate: 0,
      last_updated: new Date().toISOString()
    };

    const consolidatedAccount: ConsolidatedAccount = {
      id: accountInfo.id,
      customer_id: accountInfo.customer_id,
      account_name: accountInfo.account_name,
      currency_code: accountInfo.currency_code || 'USD',
      time_zone: accountInfo.time_zone || 'UTC',
      connection_status: accountInfo.connection_status,
      last_successful_fetch: accountInfo.last_successful_fetch,
      metrics
    };

    return consolidatedAccount;
  }

  /**
   * Get campaign data with performance metrics
   */
  async getCampaignData(accountId: string, filters: DataFilters): Promise<CampaignData[]> {
    // Use database cache via Edge Function (no local caching needed)

    try {
      const { data, error } = await supabase.functions.invoke('get-campaigns', {
        body: { 
          accountId,
          filters: {
            ...filters,
            metrics: filters.metrics || [
              'campaign.id',
              'campaign.name', 
              'campaign.status',
              'metrics.clicks',
              'metrics.impressions',
              'metrics.cost_micros',
              'metrics.conversions',
              'metrics.ctr',
              'metrics.average_cpc'
            ]
          }
        }
      });

      if (error) throw error;

      const campaigns: CampaignData[] = (data.campaigns || []).map((campaign: any) => ({
        id: campaign.campaign?.id || '',
        name: campaign.campaign?.name || '',
        status: campaign.campaign?.status || '',
        type: campaign.campaign?.advertising_channel_type || '',
        budget_amount: campaign.campaign_budget?.amount_micros ? 
          campaign.campaign_budget.amount_micros / 1000000 : 0,
        daily_spend: campaign.metrics?.cost || 0,
        clicks: campaign.metrics?.clicks || 0,
        impressions: campaign.metrics?.impressions || 0,
        cost: campaign.metrics?.cost || 0,
        conversions: campaign.metrics?.conversions || 0,
        ctr: campaign.metrics?.ctr || 0,
        cpc: campaign.metrics?.average_cpc || 0
      }));

      return campaigns;
    } catch (error) {
      console.error('Error fetching campaign data:', error);
      return [];
    }
  }

  /**
   * Get ad group data with performance metrics
   */
  async getAdGroupData(accountId: string, filters: DataFilters): Promise<AdGroupData[]> {
    // Use database cache via Edge Function (no local caching needed)

    try {
      const { data, error } = await supabase.functions.invoke('get-adgroups', {
        body: { 
          accountId,
          filters: {
            ...filters,
            metrics: filters.metrics || [
              'ad_group.id',
              'ad_group.name',
              'campaign.name',
              'ad_group.status',
              'metrics.clicks',
              'metrics.impressions',
              'metrics.cost_micros',
              'metrics.conversions',
              'metrics.ctr',
              'metrics.average_cpc'
            ]
          }
        }
      });

      if (error) throw error;

      const adGroups: AdGroupData[] = (data.adGroups || []).map((adGroup: any) => ({
        id: adGroup.ad_group?.id || '',
        name: adGroup.ad_group?.name || '',
        campaign_name: adGroup.campaign?.name || '',
        status: adGroup.ad_group?.status || '',
        clicks: adGroup.metrics?.clicks || 0,
        impressions: adGroup.metrics?.impressions || 0,
        cost: adGroup.metrics?.cost || 0,
        conversions: adGroup.metrics?.conversions || 0,
        ctr: adGroup.metrics?.ctr || 0,
        cpc: adGroup.metrics?.average_cpc || 0
      }));

      return adGroups;
    } catch (error) {
      console.error('Error fetching ad group data:', error);
      return [];
    }
  }

  /**
   * Get keyword data with performance metrics
   */
  async getKeywordData(accountId: string, filters: DataFilters): Promise<KeywordData[]> {
    // Use database cache via Edge Function (no local caching needed)

    try {
      const { data, error } = await supabase.functions.invoke('get-keywords', {
        body: { 
          accountId,
          filters: {
            ...filters,
            metrics: filters.metrics || [
              'ad_group_criterion.keyword.text',
              'ad_group_criterion.keyword.match_type',
              'campaign.name',
              'ad_group.name',
              'metrics.clicks',
              'metrics.impressions',
              'metrics.cost_micros',
              'metrics.conversions',
              'metrics.ctr',
              'metrics.average_cpc'
            ]
          }
        }
      });

      if (error) throw error;

      const keywords: KeywordData[] = (data.keywords || []).map((keyword: any) => ({
        id: keyword.ad_group_criterion?.criterion_id || '',
        keyword_text: keyword.ad_group_criterion?.keyword?.text || '',
        match_type: keyword.ad_group_criterion?.keyword?.match_type || '',
        campaign_name: keyword.campaign?.name || '',
        ad_group_name: keyword.ad_group?.name || '',
        clicks: keyword.metrics?.clicks || 0,
        impressions: keyword.metrics?.impressions || 0,
        cost: keyword.metrics?.cost || 0,
        conversions: keyword.metrics?.conversions || 0,
        ctr: keyword.metrics?.ctr || 0,
        cpc: keyword.metrics?.average_cpc || 0
      }));

      return keywords;
    } catch (error) {
      console.error('Error fetching keyword data:', error);
      return [];
    }
  }

  /**
   * Generate actionable insights from the data
   */
  async generateAccountInsights(
    campaigns: CampaignData[], 
    adGroups: AdGroupData[], 
    keywords: KeywordData[]
  ): Promise<AccountInsights> {
    // Top performing campaigns (by conversion rate and ROI)
    const topPerforming = campaigns
      .filter(c => c.clicks > 0 && c.cost > 0)
      .sort((a, b) => (b.conversions / b.clicks) - (a.conversions / a.clicks))
      .slice(0, 5);

    // Underperforming campaigns (high spend, low conversions)
    const underperforming = campaigns
      .filter(c => c.cost > 100 && c.conversions < 1)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Budget recommendations based on performance
    const budgetRecommendations: BudgetRecommendation[] = campaigns
      .filter(c => c.conversions > 0)
      .map(campaign => {
        const conversionRate = campaign.conversions / campaign.clicks;
        const costPerConversion = campaign.cost / campaign.conversions;
        
        let recommendedBudget = campaign.budget_amount;
        let reason = 'No change recommended';
        
        if (conversionRate > 0.05 && costPerConversion < 50) {
          recommendedBudget = campaign.budget_amount * 1.2;
          reason = 'High conversion rate with low cost per conversion';
        } else if (conversionRate < 0.01 && costPerConversion > 100) {
          recommendedBudget = campaign.budget_amount * 0.8;
          reason = 'Low conversion rate with high cost per conversion';
        }

        return {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          current_budget: campaign.budget_amount,
          recommended_budget: Math.round(recommendedBudget),
          reason,
          potential_impact: `Estimated ${Math.round(Math.abs(recommendedBudget - campaign.budget_amount))} change in daily spend`
        };
      })
      .filter(rec => rec.recommended_budget !== rec.current_budget)
      .slice(0, 10);

    // Keyword opportunities
    const keywordOpportunities: KeywordOpportunity[] = keywords
      .filter(k => k.clicks > 10)
      .map(keyword => {
        const conversionRate = keyword.conversions / keyword.clicks;
        let opportunityType: KeywordOpportunity['opportunity_type'] = 'bid_increase';
        let recommendedAction = '';

        if (conversionRate > 0.05 && keyword.cpc < 2) {
          opportunityType = 'bid_increase';
          recommendedAction = 'Consider increasing bid to gain more volume';
        } else if (conversionRate < 0.01 && keyword.cpc > 5) {
          opportunityType = 'bid_decrease';
          recommendedAction = 'Consider decreasing bid or adding as negative keyword';
        }

        return {
          keyword_text: keyword.keyword_text,
          match_type: keyword.match_type,
          opportunity_type: opportunityType,
          current_performance: {
            clicks: keyword.clicks,
            cost: keyword.cost,
            conversions: keyword.conversions,
            ctr: keyword.ctr
          },
          potential_impact: `Potential to improve performance for ${keyword.campaign_name}`,
          recommended_action: recommendedAction
        };
      })
      .slice(0, 20);

    // Performance trends (simulated - in real implementation, you'd compare with historical data)
    const performanceTrends: PerformanceTrend[] = [
      {
        metric: 'CTR',
        period: '7d',
        trend: 'increasing',
        change_percentage: 5.2,
        significance: 'medium'
      },
      {
        metric: 'CPC',
        period: '30d',
        trend: 'stable',
        change_percentage: 1.1,
        significance: 'low'
      },
      {
        metric: 'Conversions',
        period: '7d',
        trend: 'decreasing',
        change_percentage: -8.3,
        significance: 'high'
      }
    ];

    return {
      top_performing_campaigns: topPerforming,
      underperforming_campaigns: underperforming,
      budget_recommendations: budgetRecommendations,
      keyword_opportunities: keywordOpportunities,
      performance_trends: performanceTrends
    };
  }

  /**
   * Get historical data for trends and comparisons
   */
  private async getHistoricalData(
    accountId: string, 
    entityType: string, 
    days: number = 30
  ): Promise<any[]> {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('google_ads_metrics_daily')
        .select('date, entity_id, entity_name, metrics')
        .eq('account_id', accountId)
        .eq('entity_type', entityType)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching historical data:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getHistoricalData:', error);
      return [];
    }
  }

  /**
   * Clear cached data for specific account (now in database)
   */
  async clearAccountCache(accountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('google_ads_metrics_cache')
        .delete()
        .eq('account_id', accountId);

      if (error) {
        console.error('Error clearing account cache:', error);
      }
    } catch (error) {
      console.error('Error in clearAccountCache:', error);
    }
  }
}

// Export singleton instance
export const dataConsolidationService = new DataConsolidationService();