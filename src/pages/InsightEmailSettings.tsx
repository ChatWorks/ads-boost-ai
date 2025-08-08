import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Save, Mail, ArrowLeft, Settings } from 'lucide-react';

interface InsightConfig {
  id: 'impressions' | 'clicks' | 'conversions' | 'spend' | 'cpm' | 'ctr';
  name: string;
  description: string;
}

const ALL_INSIGHTS: Record<InsightConfig['id'], InsightConfig> = {
  impressions: { id: 'impressions', name: 'Impressions', description: 'Monitor impression volume and reach metrics' },
  clicks: { id: 'clicks', name: 'Clicks', description: 'Track click performance and trends' },
  conversions: { id: 'conversions', name: 'Conversions', description: 'Allocated purchases and leads (conversions)' },
  spend: { id: 'spend', name: 'Ads spend', description: 'Daily/weekly spend patterns and budget alerts' },
  cpm: { id: 'cpm', name: 'CPM (Cost per 1K impressions)', description: 'Cost per thousand impressions monitoring' },
  ctr: { id: 'ctr', name: 'CTR (Click-through rate)', description: 'Click-through rate performance alerts' },
};

interface AdsAccount { id: string; account_name: string | null; customer_id: string; time_zone: string | null; currency_code: string | null; }

export default function InsightEmailSettings() {
  const { insightId } = useParams<{ insightId: InsightConfig['id'] }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);

  // Email settings
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [sendTime, setSendTime] = useState<string>('09:00');
  const browserTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [timeZone, setTimeZone] = useState<string>(browserTz);
  const [title, setTitle] = useState<string>('Google Ads Insights');

  useEffect(() => {
    document.title = `Email instellingen · ${insightId ? ALL_INSIGHTS[insightId].name : 'Insight'}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `Instellingen voor ${insightId ? ALL_INSIGHTS[insightId].name : 'insight'} e-mail alerts`);
  }, [insightId]);

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

  // Default account from query or first available
  useEffect(() => {
    const q = params.get('account');
    if (q) setSelectedAccountId(q);
  }, [params]);
  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0) setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId]);

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
      if (error && error.code !== 'PGRST116') throw error;
      return data as any | null;
    },
    enabled: !!user && !!selectedAccountId,
  });

  useEffect(() => {
    if (subscription) {
      setFrequency(subscription.frequency);
      setSendTime(subscription.send_time || '09:00');
      setTimeZone(subscription.time_zone || browserTz);
      setTitle(subscription.title || 'Google Ads Insights');
      setEnabled(subscription.selected_metrics?.includes(insightId as any) ?? true);
    }
  }, [subscription, browserTz, insightId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAccountId || !insightId) throw new Error('Selecteer eerst een account');
      const selected_metrics = Array.from(new Set([...(subscription?.selected_metrics || []), insightId]));
      const payload: any = {
        id: subscription?.id || undefined,
        user_id: user.id,
        google_ads_account_id: selectedAccountId,
        frequency,
        send_time: sendTime,
        time_zone: timeZone,
        title,
        is_paused: subscription?.is_paused || false,
        selected_metrics: enabled ? selected_metrics : (subscription?.selected_metrics || []).filter((m: string) => m !== insightId),
      };
      const { data, error } = await supabase
        .from('insights_email_subscriptions')
        .upsert(payload)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights-subscription', selectedAccountId] });
      toast({ title: 'Opgeslagen', description: 'Instellingen bijgewerkt.' });
    },
    onError: (err: any) => toast({ title: 'Opslaan mislukt', description: err.message, variant: 'destructive' }),
  });

  const sendTest = async () => {
    try {
      if (!selectedAccountId || !insightId) throw new Error('Selecteer eerst een account');
      const { error } = await supabase.functions.invoke('send-insights-test', {
        body: {
          accountId: selectedAccountId,
          metrics: [insightId],
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

  const insight = insightId ? ALL_INSIGHTS[insightId] : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email instellingen</h1>
          <p className="text-muted-foreground">Specifieke instellingen voor deze insight</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/insights')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Terug
        </Button>
      </div>

      {insight && (
        <Card className="professional-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-primary font-bold text-lg">⚙️</span>
              </div>
              <div>
                <CardTitle className="text-xl">{insight.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className={`text-sm ${enabled ? 'text-primary' : 'text-muted-foreground'}`}>{enabled ? 'Aan' : 'Uit'}</span>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <SelectItem value={browserTz}>{browserTz} (browser)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Titel</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Google Ads Insights" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => saveMutation.mutate()} disabled={!selectedAccountId || saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> Opslaan
            </Button>
            <Button variant="outline" onClick={sendTest} disabled={!selectedAccountId}>
              <Mail className="h-4 w-4 mr-2" /> Stuur testmail
            </Button>
            <Badge variant={enabled ? 'default' : 'secondary'}>
              {enabled ? 'Insight aan' : 'Insight uit'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
