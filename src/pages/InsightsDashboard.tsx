import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Search, 
  DollarSign, 
  Eye, 
  MousePointer, 
  BarChart3, 
  TrendingUp, 
  ShoppingCart, 
  Save,
  Trash2
} from 'lucide-react';
import InsightToggle from '@/components/Insights/InsightToggle';
import { toast } from '@/hooks/use-toast';

interface InsightConfig {
  id: 'impressions' | 'clicks' | 'conversions' | 'spend' | 'cpm' | 'ctr';
  name: string;
  icon: any;
  description: string;
  enabled: boolean;
  category: 'performance' | 'budget' | 'conversion';
}

interface AdsAccount {
  id: string;
  account_name: string | null;
  customer_id: string;
  time_zone: string | null;
  currency_code: string | null;
  is_active: boolean | null;
}

export default function InsightsDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | InsightConfig['category']>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Email settings form state
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [sendTime, setSendTime] = useState<string>('09:00');
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [timeZone, setTimeZone] = useState<string>(browserTz);
  const [title, setTitle] = useState<string>('Google Ads Insights');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  const [insights, setInsights] = useState<InsightConfig[]>([
    {
      id: 'impressions',
      name: 'Impressions',
      icon: Eye,
      description: 'Monitor impression volume and reach metrics',
      enabled: false,
      category: 'performance',
    },
    {
      id: 'clicks',
      name: 'Clicks',
      icon: MousePointer,
      description: 'Track click performance and trends',
      enabled: false,
      category: 'performance',
    },
    {
      id: 'conversions',
      name: 'Conversions',
      icon: ShoppingCart,
      description: 'Allocated purchases and leads (conversions)',
      enabled: false,
      category: 'conversion',
    },
    {
      id: 'spend',
      name: 'Ads spend',
      icon: DollarSign,
      description: 'Daily/weekly spend patterns and budget alerts',
      enabled: false,
      category: 'budget',
    },
    {
      id: 'cpm',
      name: 'CPM (Cost per 1K impressions)',
      icon: BarChart3,
      description: 'Cost per thousand impressions monitoring',
      enabled: false,
      category: 'budget',
    },
    {
      id: 'ctr',
      name: 'CTR (Click-through rate)',
      icon: TrendingUp,
      description: 'Click-through rate performance alerts',
      enabled: false,
      category: 'performance',
    },
  ]);

  // Load Google Ads accounts
  const { data: accounts } = useQuery({
    queryKey: ['ads-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('id, account_name, customer_id, time_zone, currency_code, is_active')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AdsAccount[];
    },
    enabled: !!user,
  });

  // Set default account when loaded
  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Load subscription for selected account
  const { data: subscription } = useQuery({
    queryKey: ['insights-subscription', selectedAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insights_email_subscriptions')
        .select('*')
        .eq('google_ads_account_id', selectedAccountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; // no rows
      return data as any | null;
    },
    enabled: !!user && !!selectedAccountId,
  });

  // Populate form from subscription
  useEffect(() => {
    if (subscription) {
      setSubscriptionId(subscription.id);
      setFrequency(subscription.frequency);
      setSendTime(subscription.send_time || '09:00');
      setTimeZone(subscription.time_zone || browserTz);
      setTitle(subscription.title || 'Google Ads Insights');
      setIsPaused(!!subscription.is_paused);
      const selected: string[] = subscription.selected_metrics || [];
      setInsights((prev) => prev.map((ins) => ({ ...ins, enabled: selected.includes(ins.id) })));
    } else {
      setSubscriptionId(null);
      setFrequency('weekly');
      setSendTime('09:00');
      setTimeZone(browserTz);
      setTitle('Google Ads Insights');
      setIsPaused(false);
      setInsights((prev) => prev.map((ins) => ({ ...ins, enabled: false })));
    }
  }, [subscription, browserTz]);

  const enabledCount = useMemo(() => insights.filter((i) => i.enabled).length, [insights]);
  const totalCount = insights.length;

  const handleToggleInsight = (insightId: InsightConfig['id']) => {
    setInsights((prev) =>
      prev.map((ins) => (ins.id === insightId ? { ...ins, enabled: !ins.enabled } : ins))
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAccountId) throw new Error('Selecteer eerst een account');
      const selected_metrics = insights.filter((i) => i.enabled).map((i) => i.id);
      const payload: any = {
        id: subscriptionId || undefined,
        user_id: user.id,
        google_ads_account_id: selectedAccountId,
        frequency,
        send_time: sendTime,
        time_zone: timeZone,
        title,
        is_paused: isPaused,
        selected_metrics,
      };
      const { data, error } = await supabase
        .from('insights_email_subscriptions')
        .upsert(payload)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setSubscriptionId(data?.id || null);
      qc.invalidateQueries({ queryKey: ['insights-subscription', selectedAccountId] });
      toast({ title: 'Opgeslagen', description: 'Je e-mailinsights zijn bijgewerkt.' });
    },
    onError: (err: any) => {
      toast({ title: 'Opslaan mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!subscriptionId) return;
      const { error } = await supabase
        .from('insights_email_subscriptions')
        .delete()
        .eq('id', subscriptionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights-subscription', selectedAccountId] });
      toast({ title: 'Verwijderd', description: 'De subscription is verwijderd.' });
    },
    onError: (err: any) => {
      toast({ title: 'Verwijderen mislukt', description: err.message, variant: 'destructive' });
    },
  });

  const sendTestEmail = async (metricsOverride?: InsightConfig['id'][]) => {
    try {
      if (!selectedAccountId) throw new Error('Selecteer eerst een account');
      const metrics = metricsOverride ?? insights.filter((i) => i.enabled).map((i) => i.id);
      if (metrics.length === 0) throw new Error('Selecteer minstens 1 insight');
      const { error } = await supabase.functions.invoke('send-insights-test', {
        body: {
          accountId: selectedAccountId,
          metrics,
          frequency,
          title,
        },
      });
      if (error) throw error;
      toast({ title: 'Testmail verzonden', description: 'Controleer je inbox.' });
    } catch (e: any) {
      toast({ title: 'Testmail mislukt', description: e.message, variant: 'destructive' });
    }
  };

  const filteredInsights = insights.filter((insight) => {
    const matchesSearch =
      insight.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      insight.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || insight.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground">
            Stel hier in welke Google Ads metrics je via e-mail wilt ontvangen en hoe vaak
          </p>
        </div>
      </div>

      {/* Email schedule and account selection */}
      <Card className="professional-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">E-mailinstellingen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Google Ads account</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name || acc.customer_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground">
                  Tijdzone account: {selectedAccount.time_zone || 'Onbekend'} · Valuta: {selectedAccount.currency_code || '—'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Frequentie</label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Dagelijks</SelectItem>
                  <SelectItem value="weekly">Wekelijks</SelectItem>
                  <SelectItem value="monthly">Maandelijks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Verzendtijd (HH:MM)</label>
              <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tijdzone</label>
              <Select value={timeZone} onValueChange={setTimeZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedAccount?.time_zone && (
                    <SelectItem value={selectedAccount.time_zone}>{selectedAccount.time_zone} (account)</SelectItem>
                  )}
                  <SelectItem value={browserTz}>{browserTz} (browser)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Titel</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Google Ads Insights" />
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <Switch checked={isPaused} onCheckedChange={setIsPaused} />
              <span className={`text-sm ${isPaused ? 'text-muted-foreground' : ''}`}>Pauzeer e-mails</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => saveMutation.mutate()} disabled={!selectedAccountId || saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> Opslaan
            </Button>
            <Button variant="outline" onClick={() => sendTestEmail()} disabled={!selectedAccountId}>
              <Search className="h-4 w-4 mr-2" /> Stuur testmail
            </Button>
            {subscriptionId && (
              <Button variant="outline" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" /> Verwijderen
              </Button>
            )}
            <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>
              {enabledCount} van {totalCount} insights aan
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek insights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={(v: any) => setSelectedCategory(v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Alle insights" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle insights</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="budget">Budget</SelectItem>
            <SelectItem value="conversion">Conversion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Google Ads Insights Section */}
      <Card className="professional-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-primary font-bold text-lg">📢</span>
              </div>
              <div>
                <CardTitle className="text-xl">Google Ads</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>
                    {enabledCount} van {totalCount} insights aan
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredInsights.map((insight) => (
            <InsightToggle key={insight.id} insight={insight} onToggle={handleToggleInsight} onConfigure={(id) => navigate(`/insights/settings/${id}?account=${selectedAccountId}`)} />
          ))}

          {filteredInsights.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Geen insights gevonden.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      {enabledCount > 0 && (
        <Card className="professional-card">
          <CardHeader>
            <CardTitle>Actieve insights samenvatting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights
                .filter((insight) => insight.enabled)
                .map((insight) => (
                  <div key={insight.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <insight.icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{insight.name}</p>
                      <p className="text-xs text-muted-foreground">Actief</p>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-primary font-medium">📊 Je ontvangt periodieke e-mails op basis van deze selectie</p>
              <p className="text-xs text-primary/80 mt-1">
                Verzendtijd: {sendTime} ({timeZone}) · Frequentie: {frequency}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
