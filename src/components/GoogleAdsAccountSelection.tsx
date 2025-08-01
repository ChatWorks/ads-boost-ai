import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  needs_reconnection: boolean;
  last_error_message: string | null;
  last_error_at: string | null;
}

interface GoogleAdsAccountSelectionProps {
  onSelectionComplete: () => void;
}

export default function GoogleAdsAccountSelection({ onSelectionComplete }: GoogleAdsAccountSelectionProps) {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch all connected accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from('google_ads_accounts')
          .select('*')
          .order('account_name');

        if (error) {
          console.error('Error fetching accounts:', error);
          toast({
            title: "Error",
            description: "Failed to load Google Ads accounts",
            variant: "destructive",
          });
          return;
        }

        setAccounts(data || []);
        
        // Pre-select accounts that are already active
        const activeAccountIds = new Set(
          data?.filter(account => account.is_active).map(account => account.id) || []
        );
        setSelectedAccounts(activeAccountIds);
      } catch (error) {
        console.error('Error:', error);
        toast({
          title: "Error",
          description: "Failed to load accounts",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleAccountToggle = (accountId: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const handleSaveSelection = async () => {
    setSaving(true);
    try {
      // Update all accounts - set is_active based on selection
      const updates = accounts.map(account => ({
        id: account.id,
        is_active: selectedAccounts.has(account.id)
      }));

      // Update each account
      for (const update of updates) {
        const { error } = await supabase
          .from('google_ads_accounts')
          .update({ is_active: update.is_active })
          .eq('id', update.id);

        if (error) {
          throw error;
        }
      }

      toast({
        title: "Success",
        description: `${selectedAccounts.size} account(s) activated for analysis`,
      });

      onSelectionComplete();
    } catch (error) {
      console.error('Error saving selection:', error);
      toast({
        title: "Error",
        description: "Failed to save account selection",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading your Google Ads accounts...</span>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Accounts Found</CardTitle>
          <CardDescription>
            No Google Ads accounts are connected. Please connect your accounts first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select Accounts to Activate</h2>
        <p className="text-muted-foreground">
          Choose which Google Ads accounts you want to include in your dashboard and AI analysis.
        </p>
      </div>

      <div className="grid gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Checkbox
                    id={account.id}
                    checked={selectedAccounts.has(account.id)}
                    onCheckedChange={() => handleAccountToggle(account.id)}
                  />
                  
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <label 
                          htmlFor={account.id}
                          className="font-medium cursor-pointer"
                        >
                          {account.account_name || `Account ${account.customer_id}`}
                        </label>
                        
                        <div className="flex space-x-1">
                          {account.is_manager && (
                            <Badge variant="secondary">Manager</Badge>
                          )}
                          {account.account_type === 'TEST' && (
                            <Badge variant="outline">Test</Badge>
                          )}
                          <Badge 
                            variant={
                              account.needs_reconnection ? 'destructive' :
                              account.connection_status === 'CONNECTED' ? 'default' : 'secondary'
                            }
                          >
                            {account.needs_reconnection ? 'NEEDS RECONNECTION' : account.connection_status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mt-1">
                        Customer ID: {account.customer_id}
                        {account.currency_code && ` • ${account.currency_code}`}
                        {account.time_zone && ` • ${account.time_zone}`}
                        {account.needs_reconnection && account.last_error_message && (
                          <div className="text-destructive text-xs mt-1">
                            Error: {account.last_error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {selectedAccounts.size} of {accounts.length} account(s) selected
        </div>
        
        <Button 
          onClick={handleSaveSelection}
          disabled={saving || selectedAccounts.size === 0}
          className="min-w-[120px]"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Activate Accounts'
          )}
        </Button>
      </div>
    </div>
  );
}