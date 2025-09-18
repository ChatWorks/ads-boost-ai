import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, TrendingUp, MousePointer, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import CampaignFilters, { CampaignFilters as CampaignFiltersType } from './CampaignFilters';

interface Campaign {
  id: string;
  name: string;
  status: string;
  metrics: Record<string, number>;
}

interface CampaignListProps {
  accountId: string;
  filters?: CampaignFiltersType;
}

export default function CampaignList({ accountId, filters: externalFilters }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CampaignFiltersType>({
    dateRange: 'LAST_30_DAYS',
    metrics: ['impressions', 'clicks', 'cost_micros', 'ctr', 'conversions'],
    campaignStatus: ['ENABLED'],
    limit: 50
  });

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const filtersToUse = externalFilters || filters;
      const { googleAdsService } = await import('@/services/api');
      const data = await googleAdsService.getCampaigns(accountId, filtersToUse);

      if (data?.error) {
        throw new Error(data.error);
      }

      setCampaigns(data?.campaigns || []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      const errorMessage = err.message || 'Failed to fetch campaign data';
      setError(errorMessage);
      
      // Show different messages based on error type
      if (errorMessage.includes('reconnection required')) {
        toast({
          title: "Reconnection Required",
          description: "Your Google Ads account needs to be reconnected. Please go to the integrations page.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('Token has been expired')) {
        toast({
          title: "Token Expired",
          description: "Your Google Ads access has expired. Please reconnect your account.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch campaign data",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [accountId, externalFilters]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ENABLED':
        return 'default';
      case 'PAUSED':
        return 'secondary';
      case 'REMOVED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatMetricValue = (metricKey: string, value: number) => {
    if (metricKey.includes('cost') || metricKey.includes('cpc')) {
      return formatCurrency(value);
    }
    if (metricKey.includes('rate') || metricKey === 'ctr' || metricKey.includes('share')) {
      return `${(value * 100).toFixed(2)}%`;
    }
    return formatNumber(value);
  };

  const getMetricLabel = (metricKey: string) => {
    const labels: Record<string, string> = {
      impressions: 'Impressions',
      clicks: 'Clicks',
      cost: 'Cost',
      ctr: 'CTR',
      average_cpc: 'Avg. CPC',
      conversions: 'Conversions',
      cost_per_conversion: 'Cost/Conv.',
      conversion_rate: 'Conv. Rate',
      search_impression_share: 'Search IS',
      search_budget_lost_impression_share: 'Budget Lost IS',
      search_rank_lost_impression_share: 'Rank Lost IS',
      video_views: 'Video Views',
      view_through_conversions: 'View-through Conv.'
    };
    return labels[metricKey] || metricKey;
  };

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Loading campaign data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive text-sm font-medium">Error loading campaigns</p>
          <p className="text-destructive/80 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Only show filters if no external filters provided */}
      {!externalFilters && (
        <CampaignFilters
          filters={filters}
          onFiltersChange={setFilters}
          onApplyFilters={fetchCampaigns}
          isLoading={isLoading}
        />
      )}

      {/* Results */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Loading campaign data...</span>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive text-sm font-medium">Error loading campaigns</p>
          <p className="text-destructive/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No campaign data available with current filters</p>
        </div>
      )}

      {!isLoading && !error && campaigns.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Campaign Results ({campaigns.length} campaigns)
          </h4>
          
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-sm truncate mb-1">{campaign.name}</h5>
                      <Badge variant={getStatusVariant(campaign.status)} className="text-xs">
                        {campaign.status}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Dynamic metrics display */}
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                     {Object.entries(campaign.metrics)
                       .filter(([key]) => (externalFilters || filters).metrics.includes(key) || key === 'cost' || key === 'conversion_rate')
                       .slice(0, 8) // Limit display to prevent overflow
                      .map(([metricKey, value]) => (
                        <div key={metricKey} className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            {metricKey === 'impressions' && <TrendingUp className="h-3 w-3 text-muted-foreground" />}
                            {metricKey === 'clicks' && <MousePointer className="h-3 w-3 text-muted-foreground" />}
                            {(metricKey.includes('cost') || metricKey.includes('cpc')) && <DollarSign className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-muted-foreground text-xs">
                              {getMetricLabel(metricKey)}
                            </span>
                          </div>
                          <p className="font-semibold">{formatMetricValue(metricKey, value || 0)}</p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}