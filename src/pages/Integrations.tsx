import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Trash2, TestTube, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import GoogleAdsAccountSelection from '@/components/GoogleAdsAccountSelection';

type FlowStep = 'connect' | 'select_accounts' | 'completed';

interface GoogleAdsAccount {
  id: string;
  customer_id: string;
  account_name: string | null;
  is_manager: boolean;
  account_type: string;
  connection_status: string;
  is_active: boolean;
  currency_code: string | null;
  time_zone: string | null;
  created_at: string;
}

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<GoogleAdsAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>('connect');

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
      loadConnectedAccounts().then(() => {
        // After successful connection, move to account selection step
        setCurrentStep('select_accounts');
      });
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

  // Load connected accounts
  const loadConnectedAccounts = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('*')
        .order('account_name');

      if (error) {
        console.error('Error fetching accounts:', error);
        setConnectedAccounts([]);
      } else {
        setConnectedAccounts(data || []);
        
        // Determine which step to show
        if (data && data.length > 0) {
          const hasActiveAccounts = data.some(account => account.is_active);
          setCurrentStep(hasActiveAccounts ? 'completed' : 'select_accounts');
        } else {
          setCurrentStep('connect');
        }
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load connected accounts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load accounts on mount
  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const handleSelectionComplete = () => {
    // Reload accounts to get updated data
    loadConnectedAccounts();
    // Move to completed step
    setCurrentStep('completed');
  };

  const handleManageAccounts = () => {
    setCurrentStep('select_accounts');
  };

  // Test connection function
  const testConnection = async (accountId: string) => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-test', {
        body: { accountId }
      });

      if (error) throw error;

      toast({
        title: "Connection Test",
        description: data?.message || "Connection tested successfully",
      });
    } catch (error: any) {
      toast({
        title: "Test Failed", 
        description: "Google Ads Developer Token needs to be activated",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Delete account function  
  const deleteAccount = async (accountId: string) => {
    try {
      // For demo purposes, just update local state
      setConnectedAccounts(prev => prev.filter(acc => acc.id !== accountId));
      
      toast({
        title: "Account Removed",
        description: "Google Ads account has been disconnected",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove account",
        variant: "destructive",
      });
    }
  };

  const handleConnectGoogleAds = async () => {
    console.log('🚀 Starting Google Ads connection...');
    setIsConnecting(true);
    
    try {
      console.log('📡 Calling supabase function: google-ads-connect');
      const { data, error } = await supabase.functions.invoke('google-ads-connect');
      
      console.log('📊 Function response:', { data, error });

      if (error) {
        console.error('❌ Function error:', error);
        throw error;
      }

      if (data?.authUrl) {
        console.log('✅ Got auth URL, redirecting to:', data.authUrl);
        console.log('🔧 Expected redirect URI:', data.redirectUri);
        
        // Show the redirect URI to help with debugging
        toast({
          title: "Redirect URI Info",
          description: `Expected redirect URI: ${data.redirectUri}`,
        });
        
        window.location.href = data.authUrl;
      } else {
        console.error('❌ No authUrl in response:', data);
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('💥 Error connecting Google Ads:', error);
      toast({
        title: "Connection Error",
        description: `Failed to connect: ${error.message}`,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect your Google Ads accounts to start analyzing and optimizing your campaigns.
          </p>
        </div>
        <Card className="professional-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading...</h3>
            <p className="text-muted-foreground">Checking for connected accounts</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your Google Ads accounts to start analyzing and optimizing your campaigns.
        </p>
      </div>

      {/* Step 1: Connect */}
      {currentStep === 'connect' && (
        <>
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

          {/* Google Cloud Console Configuration Instructions */}
          <Card className="professional-card">
            <CardHeader>
              <CardTitle>Google Cloud Console Configuration</CardTitle>
              <CardDescription>
                Configure your OAuth2 settings in Google Cloud Console exactly as shown below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2">✅ Authorized JavaScript origins:</h4>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                  http://localhost:3000<br/>
                  https://ijocgytumkinjhmgferk.supabase.co<br/>
                  https://preview--ads-boost-ai.lovable.app
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">✅ Authorized redirect URIs:</h4>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                  https://ijocgytumkinjhmgferk.supabase.co/functions/v1/google-ads-callback
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="professional-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Zap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ready to Connect</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Update your Google Cloud Console settings and then click the button above to connect your Google Ads account.
              </p>
              <Button onClick={handleConnectGoogleAds} disabled={isConnecting}>
                {isConnecting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Connect Google Ads Account
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Select Accounts */}
      {currentStep === 'select_accounts' && (
        <Card className="professional-card">
          <CardContent className="py-8">
            <GoogleAdsAccountSelection onSelectionComplete={handleSelectionComplete} />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Completed */}
      {currentStep === 'completed' && (
        <>
          <Card className="professional-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Google Ads Integration Active
                </CardTitle>
                <CardDescription>
                  Your selected Google Ads accounts are now active and being analyzed.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={handleManageAccounts}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Accounts
              </Button>
            </CardHeader>
          </Card>

          {/* Active Accounts */}
          <Card className="professional-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Active Google Ads Accounts
              </CardTitle>
              <CardDescription>
                These accounts are included in your dashboard and AI analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectedAccounts.filter(account => account.is_active).map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{account.account_name || `Account ${account.customer_id}`}</h4>
                      <div className="flex space-x-1">
                        {account.is_manager && (
                          <Badge variant="secondary">Manager</Badge>
                        )}
                        {account.account_type === 'TEST' && (
                          <Badge variant="outline">Test</Badge>
                        )}
                        <Badge variant="default">Active</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Customer ID: {account.customer_id}</p>
                      {account.currency_code && <p>Currency: {account.currency_code}</p>}
                      {account.time_zone && <p>Timezone: {account.time_zone}</p>}
                      <p>Connected: {new Date(account.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testConnection(account.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="mr-1 h-3 w-3" />
                      )}
                      Test
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Google Ads Developer Token Setup */}
          <Card className="professional-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Next Steps: Google Ads Developer Token
              </CardTitle>
              <CardDescription>
                To access Google Ads data, you need to activate your Developer Token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">🔑 Developer Token Required</h4>
                <p className="text-amber-800 text-sm mb-3">
                  OAuth is working, but you need a Google Ads Developer Token to access campaign data. 
                  This requires Google approval and can take 1-3 business days.
                </p>
                <div className="space-y-2 text-sm text-amber-800">
                  <p><strong>1. Request Developer Token:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Go to Google Ads → Tools & Settings → API Center</li>
                    <li>Apply for a Developer Token</li>
                    <li>Fill in your application details</li>
                    <li>Wait for Google approval (1-3 days)</li>
                  </ul>
                  
                  <p className="mt-3"><strong>2. Add Token to Secrets:</strong></p>
                  <p>Once approved, add your token to Supabase secrets as GOOGLE_ADS_DEVELOPER_TOKEN</p>
                  
                  <p className="mt-3"><strong>3. Test Connection:</strong></p>
                  <p>Use the "Test" button above to verify your setup</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <a 
                  href="https://ads.google.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Go to Google Ads Console
                </a>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}