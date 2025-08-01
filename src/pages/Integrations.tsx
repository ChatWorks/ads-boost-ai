import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);

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
              https://ijocgytumkinjhmgferk.supabase.co
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">✅ Authorized redirect URIs:</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-sm">
              https://ijocgytumkinjhmgferk.supabase.co/functions/v1/google-ads-callback
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">Belangrijke wijziging nodig!</h4>
                <p className="text-blue-800 text-sm mt-1">
                  Vervang in je Google Cloud Console de redirect URI van<br/>
                  <code className="bg-white px-1 rounded">http://localhost:3000/api/auth/google-ads/callback</code><br/>
                  naar<br/>
                  <code className="bg-white px-1 rounded">https://ijocgytumkinjhmgferk.supabase.co/functions/v1/google-ads-callback</code>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No Data State */}
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
    </div>
  );
}