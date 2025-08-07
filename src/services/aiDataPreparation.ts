import { 
  ConsolidatedAccountData, 
  CampaignData, 
  AdGroupData, 
  KeywordData,
  AccountInsights,
  DataFilters 
} from './dataConsolidation';
import { dataConsolidationService } from './dataConsolidation';

// AI-specific data interfaces
export interface AIContextData {
  account_summary: AccountSummary;
  performance_snapshot: PerformanceSnapshot;
  insights_summary: InsightsSummary;
  actionable_recommendations: ActionableRecommendation[];
  context_metadata: ContextMetadata;
}

export interface AccountSummary {
  account_name: string;
  customer_id: string;
  currency: string;
  total_campaigns: number;
  active_campaigns: number;
  connection_status: string;
  data_freshness: string;
}

export interface PerformanceSnapshot {
  period: string;
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  overall_ctr: number;
  overall_cpc: number;
  total_conversions: number;
  conversion_rate: number;
  top_campaigns: SimplifiedCampaign[];
  performance_distribution: PerformanceDistribution;
}

export interface SimplifiedCampaign {
  name: string;
  status: string;
  spend: number;
  conversions: number;
  ctr: number;
  performance_tier: 'high' | 'medium' | 'low';
}

export interface PerformanceDistribution {
  high_performing_campaigns: number;
  medium_performing_campaigns: number;
  low_performing_campaigns: number;
  spend_distribution: {
    top_20_percent: number;
    middle_60_percent: number;
    bottom_20_percent: number;
  };
}

export interface InsightsSummary {
  key_opportunities: string[];
  main_concerns: string[];
  budget_efficiency: string;
  performance_trends: string[];
  competitive_position: string;
}

export interface ActionableRecommendation {
  type: 'budget' | 'keyword' | 'campaign' | 'optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potential_impact: string;
  confidence_score: number;
  affected_entity: string;
  quick_action?: string;
}

export interface ContextMetadata {
  data_timestamp: string;
  account_health_score: number;
  data_completeness: number;
  analysis_scope: string;
  available_actions: string[];
  user_preferences?: UserPreferences;
}

export interface UserPreferences {
  preferred_metrics: string[];
  focus_areas: string[];
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  notification_preferences: string[];
}

// Natural language data summaries for AI
export interface NaturalLanguageContext {
  executive_summary: string;
  performance_narrative: string;
  insights_narrative: string;
  recommendation_narrative: string;
  data_quality_note: string;
}

class AIDataPreparationService {
  /**
   * Main method to prepare comprehensive AI context data
   */
  async prepareAIContext(
    accountId: string, 
    filters: DataFilters = {},
    userQuery?: string
  ): Promise<{
    structured_data: AIContextData;
    natural_language: NaturalLanguageContext;
    query_specific_data?: any;
  }> {
    // Get consolidated data
    const consolidatedData = await dataConsolidationService.getConsolidatedAccountData(accountId, filters);
    
    // Prepare structured context
    const structured_data = await this.buildStructuredContext(consolidatedData);
    
    // Generate natural language summaries
    const natural_language = this.generateNaturalLanguageContext(consolidatedData, structured_data);
    
    // Add query-specific data if needed
    let query_specific_data = undefined;
    if (userQuery) {
      query_specific_data = await this.prepareQuerySpecificData(consolidatedData, userQuery);
    }

    return {
      structured_data,
      natural_language,
      query_specific_data
    };
  }

  /**
   * Build structured context data for AI consumption
   */
  private async buildStructuredContext(data: ConsolidatedAccountData): Promise<AIContextData> {
    const { account, campaigns, adGroups, keywords, insights } = data;

    // Account summary
    const account_summary: AccountSummary = {
      account_name: account.account_name,
      customer_id: account.customer_id,
      currency: account.currency_code,
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter(c => c.status === 'ENABLED').length,
      connection_status: account.connection_status,
      data_freshness: this.getDataFreshness(account.last_successful_fetch)
    };

    // Performance snapshot
    const performance_snapshot = this.buildPerformanceSnapshot(campaigns, account.currency_code);

    // Insights summary
    const insights_summary = this.buildInsightsSummary(insights, campaigns);

    // Actionable recommendations
    const actionable_recommendations = this.buildActionableRecommendations(insights, campaigns, keywords);

    // Context metadata
    const context_metadata = this.buildContextMetadata(data);

    return {
      account_summary,
      performance_snapshot,
      insights_summary,
      actionable_recommendations,
      context_metadata
    };
  }

  /**
   * Build performance snapshot with key metrics
   */
  private buildPerformanceSnapshot(campaigns: CampaignData[], currency: string): PerformanceSnapshot {
    const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED');
    
    const totals = activeCampaigns.reduce((acc, campaign) => ({
      spend: acc.spend + campaign.cost,
      clicks: acc.clicks + campaign.clicks,
      impressions: acc.impressions + campaign.impressions,
      conversions: acc.conversions + campaign.conversions
    }), { spend: 0, clicks: 0, impressions: 0, conversions: 0 });

    // Categorize campaigns by performance
    const topCampaigns = activeCampaigns
      .sort((a, b) => (b.conversions / Math.max(b.clicks, 1)) - (a.conversions / Math.max(a.clicks, 1)))
      .slice(0, 5)
      .map(campaign => ({
        name: campaign.name,
        status: campaign.status,
        spend: campaign.cost,
        conversions: campaign.conversions,
        ctr: campaign.ctr,
        performance_tier: this.getPerformanceTier(campaign) as 'high' | 'medium' | 'low'
      }));

    // Performance distribution
    const performanceTiers = activeCampaigns.map(c => this.getPerformanceTier(c));
    const performance_distribution: PerformanceDistribution = {
      high_performing_campaigns: performanceTiers.filter(t => t === 'high').length,
      medium_performing_campaigns: performanceTiers.filter(t => t === 'medium').length,
      low_performing_campaigns: performanceTiers.filter(t => t === 'low').length,
      spend_distribution: this.calculateSpendDistribution(activeCampaigns)
    };

    return {
      period: 'Last 30 days', // Would be dynamic based on filters
      total_spend: totals.spend,
      total_clicks: totals.clicks,
      total_impressions: totals.impressions,
      overall_ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      overall_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      total_conversions: totals.conversions,
      conversion_rate: totals.clicks > 0 ? totals.conversions / totals.clicks : 0,
      top_campaigns: topCampaigns,
      performance_distribution
    };
  }

  /**
   * Build insights summary from account insights
   */
  private buildInsightsSummary(insights: AccountInsights, campaigns: CampaignData[]): InsightsSummary {
    const key_opportunities = [];
    const main_concerns = [];

    // Extract opportunities
    if (insights.budget_recommendations.length > 0) {
      key_opportunities.push(`${insights.budget_recommendations.length} budget optimization opportunities identified`);
    }
    
    if (insights.keyword_opportunities.length > 0) {
      key_opportunities.push(`${insights.keyword_opportunities.length} keyword optimization opportunities`);
    }

    // Extract concerns
    if (insights.underperforming_campaigns.length > 0) {
      main_concerns.push(`${insights.underperforming_campaigns.length} campaigns underperforming`);
    }

    const negativePerformanceTrends = insights.performance_trends.filter(t => t.trend === 'decreasing');
    if (negativePerformanceTrends.length > 0) {
      main_concerns.push(`Performance declining in ${negativePerformanceTrends.length} key metrics`);
    }

    // Budget efficiency assessment
    const totalSpend = campaigns.reduce((sum, c) => sum + c.cost, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const avgCostPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;
    
    let budget_efficiency = 'Good';
    if (avgCostPerConversion > 100) budget_efficiency = 'Needs improvement';
    if (avgCostPerConversion < 25) budget_efficiency = 'Excellent';

    // Performance trends summary
    const performance_trends = insights.performance_trends.map(trend => 
      `${trend.metric} ${trend.trend} by ${Math.abs(trend.change_percentage)}% (${trend.period})`
    );

    return {
      key_opportunities,
      main_concerns,
      budget_efficiency,
      performance_trends,
      competitive_position: 'Analysis available' // Would be enhanced with competitive data
    };
  }

  /**
   * Build actionable recommendations with priority and impact
   */
  private buildActionableRecommendations(
    insights: AccountInsights, 
    campaigns: CampaignData[], 
    keywords: KeywordData[]
  ): ActionableRecommendation[] {
    const recommendations: ActionableRecommendation[] = [];

    // Budget recommendations
    insights.budget_recommendations.slice(0, 3).forEach(budgetRec => {
      recommendations.push({
        type: 'budget',
        priority: Math.abs(budgetRec.recommended_budget - budgetRec.current_budget) > 50 ? 'high' : 'medium',
        title: `Optimize budget for ${budgetRec.campaign_name}`,
        description: budgetRec.reason,
        potential_impact: budgetRec.potential_impact,
        confidence_score: 0.85,
        affected_entity: budgetRec.campaign_name,
        quick_action: `Adjust budget from $${budgetRec.current_budget} to $${budgetRec.recommended_budget}`
      });
    });

    // Campaign recommendations
    insights.underperforming_campaigns.slice(0, 2).forEach(campaign => {
      recommendations.push({
        type: 'campaign',
        priority: 'high',
        title: `Review underperforming campaign: ${campaign.name}`,
        description: `High spend (${campaign.cost}) with low conversions (${campaign.conversions})`,
        potential_impact: `Potential to reduce wasted spend by $${Math.round(campaign.cost * 0.3)}`,
        confidence_score: 0.75,
        affected_entity: campaign.name,
        quick_action: 'Pause or optimize targeting'
      });
    });

    // Keyword recommendations
    insights.keyword_opportunities.slice(0, 3).forEach(keywordOpp => {
      recommendations.push({
        type: 'keyword',
        priority: keywordOpp.opportunity_type === 'add_negative' ? 'high' : 'medium',
        title: `Optimize keyword: ${keywordOpp.keyword_text}`,
        description: keywordOpp.recommended_action,
        potential_impact: keywordOpp.potential_impact,
        confidence_score: 0.70,
        affected_entity: keywordOpp.keyword_text
      });
    });

    // Sort by priority and confidence
    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return (priorityWeight[b.priority] * b.confidence_score) - (priorityWeight[a.priority] * a.confidence_score);
    });
  }

  /**
   * Build context metadata
   */
  private buildContextMetadata(data: ConsolidatedAccountData): ContextMetadata {
    const dataCompleteness = this.calculateDataCompleteness(data);
    const accountHealthScore = this.calculateAccountHealthScore(data);

    return {
      data_timestamp: new Date().toISOString(),
      account_health_score: accountHealthScore,
      data_completeness: dataCompleteness,
      analysis_scope: `${data.campaigns.length} campaigns, ${data.adGroups.length} ad groups, ${data.keywords.length} keywords`,
      available_actions: [
        'Budget optimization',
        'Campaign analysis',
        'Keyword research',
        'Performance forecasting',
        'Competitive analysis'
      ]
    };
  }

  /**
   * Generate natural language context for AI
   */
  private generateNaturalLanguageContext(
    data: ConsolidatedAccountData, 
    structured: AIContextData
  ): NaturalLanguageContext {
    const { account, campaigns } = data;
    const { performance_snapshot, insights_summary } = structured;

    const executive_summary = `Account "${account.account_name}" (${account.customer_id}) has ${campaigns.length} total campaigns with ${performance_snapshot.top_campaigns.length} actively monitored. Total spend of $${performance_snapshot.total_spend.toFixed(2)} has generated ${performance_snapshot.total_conversions} conversions at an average cost of $${(performance_snapshot.total_spend / Math.max(performance_snapshot.total_conversions, 1)).toFixed(2)} per conversion.`;

    const performance_narrative = `Performance shows an overall CTR of ${(performance_snapshot.overall_ctr * 100).toFixed(2)}% and CPC of $${performance_snapshot.overall_cpc.toFixed(2)}. ${performance_snapshot.performance_distribution.high_performing_campaigns} campaigns are performing well, while ${performance_snapshot.performance_distribution.low_performing_campaigns} need attention. Budget efficiency is rated as ${insights_summary.budget_efficiency}.`;

    const insights_narrative = insights_summary.key_opportunities.length > 0 
      ? `Key opportunities include: ${insights_summary.key_opportunities.join(', ')}. ` 
      : 'No major optimization opportunities identified at this time. ';
    
    const concerns_narrative = insights_summary.main_concerns.length > 0 
      ? `Main concerns are: ${insights_summary.main_concerns.join(', ')}.`
      : 'Account performance is stable with no major concerns.';

    const recommendation_narrative = structured.actionable_recommendations.length > 0
      ? `Top recommendation: ${structured.actionable_recommendations[0].title} - ${structured.actionable_recommendations[0].description}`
      : 'Account is performing well with no immediate actions required.';

    const data_quality_note = structured.context_metadata.data_completeness > 0.8 
      ? 'Data quality is good with comprehensive coverage across all account areas.'
      : 'Data quality is limited - some metrics may be incomplete or unavailable.';

    return {
      executive_summary,
      performance_narrative: performance_narrative + ' ' + insights_narrative + ' ' + concerns_narrative,
      insights_narrative,
      recommendation_narrative,
      data_quality_note
    };
  }

  /**
   * Prepare query-specific data based on user intent
   */
  private async prepareQuerySpecificData(data: ConsolidatedAccountData, query: string): Promise<any> {
    const queryLower = query.toLowerCase();
    
    // Detect query intent and prepare relevant data
    if (queryLower.includes('budget') || queryLower.includes('spend')) {
      return this.prepareBudgetSpecificData(data);
    } else if (queryLower.includes('keyword')) {
      return this.prepareKeywordSpecificData(data);
    } else if (queryLower.includes('campaign')) {
      return this.prepareCampaignSpecificData(data);
    } else if (queryLower.includes('performance') || queryLower.includes('metric')) {
      return this.preparePerformanceSpecificData(data);
    }
    
    return null;
  }

  // Helper methods
  private prepareBudgetSpecificData(data: ConsolidatedAccountData) {
    return {
      type: 'budget_analysis',
      total_budget: data.campaigns.reduce((sum, c) => sum + c.budget_amount, 0),
      actual_spend: data.campaigns.reduce((sum, c) => sum + c.cost, 0),
      budget_utilization: data.campaigns.map(c => ({
        campaign: c.name,
        budget: c.budget_amount,
        spend: c.cost,
        utilization_rate: c.budget_amount > 0 ? c.cost / c.budget_amount : 0
      })),
      recommendations: data.insights.budget_recommendations
    };
  }

  private prepareKeywordSpecificData(data: ConsolidatedAccountData) {
    return {
      type: 'keyword_analysis',
      total_keywords: data.keywords.length,
      top_keywords: data.keywords
        .filter(k => k.conversions > 0)
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 10),
      keyword_opportunities: data.insights.keyword_opportunities
    };
  }

  private prepareCampaignSpecificData(data: ConsolidatedAccountData) {
    return {
      type: 'campaign_analysis',
      total_campaigns: data.campaigns.length,
      active_campaigns: data.campaigns.filter(c => c.status === 'ENABLED').length,
      top_performing: data.insights.top_performing_campaigns,
      underperforming: data.insights.underperforming_campaigns
    };
  }

  private preparePerformanceSpecificData(data: ConsolidatedAccountData) {
    return {
      type: 'performance_analysis',
      overall_metrics: {
        total_spend: data.campaigns.reduce((sum, c) => sum + c.cost, 0),
        total_clicks: data.campaigns.reduce((sum, c) => sum + c.clicks, 0),
        total_conversions: data.campaigns.reduce((sum, c) => sum + c.conversions, 0)
      },
      trends: data.insights.performance_trends,
      benchmarks: this.generatePerformanceBenchmarks(data.campaigns)
    };
  }

  private getDataFreshness(lastFetch: string | null): string {
    if (!lastFetch) return 'Never updated';
    
    const now = new Date();
    const fetchDate = new Date(lastFetch);
    const hoursDiff = (now.getTime() - fetchDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 1) return 'Just updated';
    if (hoursDiff < 24) return `${Math.round(hoursDiff)} hours ago`;
    return `${Math.round(hoursDiff / 24)} days ago`;
  }

  private getPerformanceTier(campaign: CampaignData): string {
    if (campaign.clicks === 0) return 'low';
    
    const conversionRate = campaign.conversions / campaign.clicks;
    const costPerConversion = campaign.conversions > 0 ? campaign.cost / campaign.conversions : Infinity;
    
    if (conversionRate > 0.05 && costPerConversion < 50) return 'high';
    if (conversionRate > 0.02 && costPerConversion < 100) return 'medium';
    return 'low';
  }

  private calculateSpendDistribution(campaigns: CampaignData[]) {
    const sortedBySpend = campaigns.sort((a, b) => b.cost - a.cost);
    const totalSpend = sortedBySpend.reduce((sum, c) => sum + c.cost, 0);
    
    const top20Count = Math.ceil(campaigns.length * 0.2);
    const bottom20Count = Math.floor(campaigns.length * 0.2);
    
    const top20Spend = sortedBySpend.slice(0, top20Count).reduce((sum, c) => sum + c.cost, 0);
    const bottom20Spend = sortedBySpend.slice(-bottom20Count).reduce((sum, c) => sum + c.cost, 0);
    const middle60Spend = totalSpend - top20Spend - bottom20Spend;
    
    return {
      top_20_percent: totalSpend > 0 ? top20Spend / totalSpend : 0,
      middle_60_percent: totalSpend > 0 ? middle60Spend / totalSpend : 0,
      bottom_20_percent: totalSpend > 0 ? bottom20Spend / totalSpend : 0
    };
  }

  private calculateDataCompleteness(data: ConsolidatedAccountData): number {
    let score = 0;
    let maxScore = 0;

    // Account data completeness
    maxScore += 5;
    if (data.account.account_name) score += 1;
    if (data.account.currency_code) score += 1;
    if (data.account.last_successful_fetch) score += 1;
    if (data.campaigns.length > 0) score += 1;
    if (data.account.connection_status === 'CONNECTED') score += 1;

    // Data richness
    maxScore += 3;
    if (data.campaigns.length > 0) score += 1;
    if (data.adGroups.length > 0) score += 1;
    if (data.keywords.length > 0) score += 1;

    return score / maxScore;
  }

  private calculateAccountHealthScore(data: ConsolidatedAccountData): number {
    let score = 0;
    let factors = 0;

    // Connection health
    factors += 1;
    if (data.account.connection_status === 'CONNECTED') score += 20;

    // Data freshness
    factors += 1;
    if (data.account.last_successful_fetch) {
      const hoursSinceUpdate = (new Date().getTime() - new Date(data.account.last_successful_fetch).getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) score += 20;
      else if (hoursSinceUpdate < 72) score += 10;
    }

    // Performance indicators
    factors += 3;
    const activeCampaigns = data.campaigns.filter(c => c.status === 'ENABLED');
    const totalConversions = activeCampaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalSpend = activeCampaigns.reduce((sum, c) => sum + c.cost, 0);

    if (activeCampaigns.length > 0) score += 20;
    if (totalConversions > 0) score += 20;
    if (totalSpend > 0 && totalConversions > 0) {
      const costPerConversion = totalSpend / totalConversions;
      if (costPerConversion < 50) score += 20;
      else if (costPerConversion < 100) score += 10;
    }

    return Math.min(100, score);
  }

  private generatePerformanceBenchmarks(campaigns: CampaignData[]) {
    const activeCampaigns = campaigns.filter(c => c.status === 'ENABLED' && c.clicks > 0);
    
    if (activeCampaigns.length === 0) return null;

    const ctrs = activeCampaigns.map(c => c.ctr).sort((a, b) => a - b);
    const cpcs = activeCampaigns.map(c => c.cpc).sort((a, b) => a - b);
    const conversionRates = activeCampaigns.map(c => c.conversions / c.clicks).sort((a, b) => a - b);

    return {
      ctr_percentiles: {
        p25: ctrs[Math.floor(ctrs.length * 0.25)],
        p50: ctrs[Math.floor(ctrs.length * 0.5)],
        p75: ctrs[Math.floor(ctrs.length * 0.75)]
      },
      cpc_percentiles: {
        p25: cpcs[Math.floor(cpcs.length * 0.25)],
        p50: cpcs[Math.floor(cpcs.length * 0.5)],
        p75: cpcs[Math.floor(cpcs.length * 0.75)]
      },
      conversion_rate_percentiles: {
        p25: conversionRates[Math.floor(conversionRates.length * 0.25)],
        p50: conversionRates[Math.floor(conversionRates.length * 0.5)],
        p75: conversionRates[Math.floor(conversionRates.length * 0.75)]
      }
    };
  }
}

// Export singleton instance
export const aiDataPreparationService = new AIDataPreparationService();