import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, TrendingUp, MousePointer, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  status: string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    ctr: number;
    average_cpc: number;
    conversions: number;
    cost_per_conversion: number;
  };
}

interface CampaignListProps {
  accountId: string;
}

export default function CampaignList({ accountId }: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error } = await supabase.functions.invoke('get-campaigns', {
          body: { accountId }
        });

        if (error) throw error;

        if (data?.error) {
          throw new Error(data.error);
        }

        setCampaigns(data?.campaigns?.slice(0, 5) || []);
      } catch (err: any) {
        console.error('Error fetching campaigns:', err);
        setError(err.message || 'Failed to fetch campaign data');
        toast({
          title: "Error",
          description: "Failed to fetch campaign data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [accountId]);

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

  if (campaigns.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No campaign data available for the last 30 days</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Top Campaigns (Last 30 Days)
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
              
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Impressions</span>
                  </div>
                  <p className="font-semibold">{formatNumber(campaign.metrics.impressions || 0)}</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <MousePointer className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Clicks</span>
                  </div>
                  <p className="font-semibold">{formatNumber(campaign.metrics.clicks || 0)}</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Cost</span>
                  </div>
                  <p className="font-semibold">{formatCurrency(campaign.metrics.cost || 0)}</p>
                </div>
              </div>
              
              {campaign.metrics.ctr > 0 && (
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  CTR: {(campaign.metrics.ctr * 100).toFixed(2)}%
                  {campaign.metrics.conversions > 0 && (
                    <span className="ml-4">Conversions: {formatNumber(campaign.metrics.conversions)}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}