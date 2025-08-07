import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, BarChart3, AlertCircle } from 'lucide-react';
import CampaignList from '@/components/CampaignList';
import AdGroupsList from '@/components/AdGroupsList';
import KeywordsList from '@/components/KeywordsList';
import CampaignFilters from '@/components/CampaignFilters';
import CampaignAnalysis from '@/components/CampaignAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface GoogleAdsAccount {
  id: string;
  account_name: string;
  customer_id: string;
  connection_status: string;
}

export default function Data() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<GoogleAdsAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: 'LAST_30_DAYS' as const,
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    metrics: ['impressions', 'clicks', 'cost_micros', 'ctr', 'conversions'],
    campaignStatus: ['ENABLED'],
    limit: 50
  });
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('id, account_name, customer_id, connection_status')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .eq('connection_status', 'CONNECTED');

      if (error) throw error;
      
      setAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccount(data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching accounts:', err);
      toast({
        title: "Error",
        description: "Failed to fetch Google Ads accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    setIsApplyingFilters(true);
    setTimeout(() => setIsApplyingFilters(false), 500);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Data</h1>
            <p className="text-muted-foreground">Google Ads campaign data and analytics</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading Google Ads accounts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Data</h1>
            <p className="text-muted-foreground">Google Ads campaign data and analytics</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Connected Accounts</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need to connect a Google Ads account before you can view campaign data and analytics.
            </p>
            <Button onClick={() => window.location.href = '/integrations'}>
              Connect Google Ads Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Data</h1>
            <p className="text-muted-foreground">
              {selectedAccount ? (
                `${selectedAccount.account_name} (${selectedAccount.customer_id})`
              ) : (
                'Google Ads campaign data and analytics'
              )}
            </p>
          </div>
        </div>

        {/* Account Selector */}
        {accounts.length > 1 && (
          <Card className="w-80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Connected Account</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <select 
                className="w-full p-2 border rounded-md text-sm"
                value={selectedAccount?.id || ''}
                onChange={(e) => {
                  const account = accounts.find(acc => acc.id === e.target.value);
                  setSelectedAccount(account || null);
                }}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_name} ({account.customer_id})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedAccount && (
        <>
          {/* Filters */}
          <CampaignFilters 
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApplyFilters={handleApplyFilters}
            isLoading={isApplyingFilters}
          />

          {/* Analysis Overview */}
          <CampaignAnalysis />

          {/* Data Tabs */}
          <Tabs defaultValue="campaigns" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              <TabsTrigger value="adgroups">Ad Groups</TabsTrigger>
              <TabsTrigger value="keywords">Keywords</TabsTrigger>
            </TabsList>
            
            <TabsContent value="campaigns">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Campaign Performance Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CampaignList 
                    accountId={selectedAccount.id} 
                    filters={filters}
                    key={`campaigns-${isApplyingFilters}`}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="adgroups">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Ad Groups Performance Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AdGroupsList 
                    accountId={selectedAccount.id} 
                    filters={filters}
                    key={`adgroups-${isApplyingFilters}`}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="keywords">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Keywords Performance Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KeywordsList 
                    accountId={selectedAccount.id} 
                    filters={filters}
                    key={`keywords-${isApplyingFilters}`}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}