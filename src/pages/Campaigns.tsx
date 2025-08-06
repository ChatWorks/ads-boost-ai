import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CampaignList from '@/components/CampaignList';
import AdGroupsList from '@/components/AdGroupsList';
import KeywordsList from '@/components/KeywordsList';
import CampaignFilters from '@/components/CampaignFilters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GoogleAdsAccount {
  id: string;
  account_name: string;
  customer_id: string;
  connection_status: string;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('accountId');
  
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

  useEffect(() => {
    if (accountId && accounts.length > 0) {
      const account = accounts.find(acc => acc.id === accountId);
      if (account) {
        setSelectedAccount(account);
      }
    }
  }, [accountId, accounts]);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('id, account_name, customer_id, connection_status')
        .eq('is_active', true)
        .eq('connection_status', 'CONNECTED');

      if (error) throw error;
      setAccounts(data || []);
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
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading accounts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Connected Accounts</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              You need to connect a Google Ads account before you can view campaign data.
            </p>
            <Button onClick={() => navigate('/integrations')}>
              Connect Google Ads Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Campaign Analytics</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Select an Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {accounts.map((account) => (
                <Card 
                  key={account.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedAccount(account);
                    navigate(`/campaigns?accountId=${account.id}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{account.account_name}</h3>
                        <p className="text-sm text-muted-foreground">ID: {account.customer_id}</p>
                      </div>
                      <div className="text-sm text-green-600">Connected</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Campaign Analytics</h1>
          <p className="text-muted-foreground">
            Account: {selectedAccount.account_name} ({selectedAccount.customer_id})
          </p>
        </div>
      </div>

      <CampaignFilters 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApplyFilters={handleApplyFilters}
        isLoading={isApplyingFilters}
      />

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="adgroups">Ad Groups</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
        </TabsList>
        
        <TabsContent value="campaigns">
          <CampaignList 
            accountId={selectedAccount.id} 
            filters={filters}
            key={`campaigns-${isApplyingFilters}`}
          />
        </TabsContent>
        
        <TabsContent value="adgroups">
          <AdGroupsList 
            accountId={selectedAccount.id} 
            filters={filters}
            key={`adgroups-${isApplyingFilters}`}
          />
        </TabsContent>
        
        <TabsContent value="keywords">
          <KeywordsList 
            accountId={selectedAccount.id} 
            filters={filters}
            key={`keywords-${isApplyingFilters}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}