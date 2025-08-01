import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GoogleAdsAccount {
  id: string;
  customer_id: string;
  account_name: string;
  currency_code: string;
  time_zone: string;
  is_active: boolean;
  created_at: string;
}

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      toast({
        title: "Google Ads Connected!",
        description: "Successfully connected your Google Ads account.",
      });
      setSearchParams({});
      loadAccounts();
    }

    if (error) {
      toast({
        title: "Connection Failed",
        description: error,
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load Google Ads accounts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleConnectGoogleAds = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-connect');

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting Google Ads:', error);
      toast({
        title: "Connection Error",
        description: "Failed to initiate Google Ads connection. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('google_ads_accounts')
        .update({ is_active: false })
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: "Account Disconnected",
        description: "Google Ads account has been disconnected.",
      });

      loadAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect account.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your Google Ads accounts to start analyzing and optimizing your campaigns.
        </p>
      </div>

      {/* Connection Status */}
      <Card className="professional-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Google Ads Integration
            </CardTitle>
            <CardDescription>
              Connect your Google Ads account to access campaign data and AI insights.
            </CardDescription>
          </div>
          <Button 
            onClick={handleConnectGoogleAds} 
            disabled={isConnecting}
            className="bg-primary hover:bg-primary/90"
          >
            {isConnecting ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Connect Google Ads
          </Button>
        </CardHeader>
      </Card>

      {/* Connected Accounts */}
      <Card className="professional-card">
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your connected Google Ads accounts and their permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Connected Accounts</h3>
              <p className="text-muted-foreground mb-4">
                Connect your Google Ads account to start viewing campaign data and AI insights.
              </p>
              <Button onClick={handleConnectGoogleAds} disabled={isConnecting}>
                <Zap className="mr-2 h-4 w-4" />
                Connect Google Ads Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{account.account_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Customer ID: {account.customer_id}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary">
                          {account.currency_code || 'USD'}
                        </Badge>
                        <Badge variant="outline">
                          {account.time_zone || 'UTC'}
                        </Badge>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Connected
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View in Google Ads
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDisconnectAccount(account.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Connection Test */}
      {accounts.length > 0 && (
        <Card className="professional-card">
          <CardHeader>
            <CardTitle>API Connection Test</CardTitle>
            <CardDescription>
              Test your Google Ads API connection and verify data access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Test API Connection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}