import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdGroup {
  id: string;
  name: string;
  status: string;
  campaign_name: string;
  device: string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    [key: string]: any;
  };
}

interface AdGroupsListProps {
  accountId: string;
  filters: any;
}

const AdGroupsList: React.FC<AdGroupsListProps> = ({ accountId, filters }) => {
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAdGroups = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('get-adgroups', {
        body: { accountId, filters }
      });

      if (functionError) {
        throw functionError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAdGroups(data.adGroups || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch ad groups';
      setError(errorMessage);
      
      if (errorMessage.includes('reconnection')) {
        toast({
          title: "Connection Required",
          description: "Please reconnect your Google Ads account to fetch ad groups.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchAdGroups();
    }
  }, [accountId, filters]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ENABLED': return 'default';
      case 'PAUSED': return 'secondary';
      case 'REMOVED': return 'destructive';
      default: return 'outline';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading ad groups...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-destructive font-medium">Error loading ad groups</p>
            <p className="text-muted-foreground text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (adGroups.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground">No ad groups found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Ad Groups</h3>
      <div className="grid gap-4">
        {adGroups.map((adGroup) => (
          <Card key={adGroup.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{adGroup.name}</CardTitle>
                <Badge variant={getStatusVariant(adGroup.status)}>
                  {adGroup.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Campaign: {adGroup.campaign_name}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Device</p>
                  <p className="font-medium">{adGroup.device}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Impressions</p>
                  <p className="font-medium">{formatNumber(adGroup.metrics.impressions)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clicks</p>
                  <p className="font-medium">{formatNumber(adGroup.metrics.clicks)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost</p>
                  <p className="font-medium">{formatCurrency(adGroup.metrics.cost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdGroupsList;