import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Settings as SettingsIcon, Zap, PlugZap, Power, ChevronDown } from "lucide-react";

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
  needs_reconnection: boolean;
  last_error_message: string | null;
  last_error_at: string | null;
  last_successful_fetch: string | null;
  user_id?: string;
}

// Local settings persisted in localStorage for now (simple & fast)
const SETTINGS_KEY = "app.settings.googleAds";

type LocalSettings = {
  autoSyncDaily: boolean;
  emailWeeklyInsights: boolean;
  includeManagerAccounts: boolean;
};

const defaultSettings: LocalSettings = {
  autoSyncDaily: true,
  emailWeeklyInsights: false,
  includeManagerAccounts: false,
};

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const hasActive = useMemo(() => accounts.some(a => a.is_active), [accounts]);
  const activeAccount = useMemo(() => accounts.find(a => a.is_active) || null, [accounts]);

  // Handle OAuth callback status
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast({ title: "Google Ads Connected", description: "Koppeling gelukt." });
      setSearchParams({});
      setShowSelector(true);
      loadAccounts();
    }

    if (error) {
      toast({ title: "Connectie mislukt", description: error, variant: "destructive" });
      setSearchParams({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = hasActive ? "Settings – Google Ads actief" : "Settings – Google Ads";
  }, [hasActive]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("google_ads_accounts")
        .select("*")
        .order("account_name");
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0 && !data.some(a => a.is_active)) {
        // default select first after OAuth
        setSelectedAccountId(data[0].id);
      } else if (data) {
        setSelectedAccountId(data.find(a => a.is_active)?.id || null);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Fout", description: "Kon Google Ads-accounts niet laden", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.origin}/settings`;
      const { data, error } = await supabase.functions.invoke("google-ads-connect", {
        body: { returnUrl },
      });
      if (error) throw error;
      if (data?.authUrl) {
        toast({ title: "Doorverwijzen…", description: "Verbind met Google om verder te gaan" });
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Connectie fout", description: e.message || "Mislukt om te verbinden", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleSaveActive = async () => {
    if (!selectedAccountId) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Geen gebruiker");

      // Deactivate all belonging to this user
      const { error: err1 } = await supabase
        .from("google_ads_accounts")
        .update({ is_active: false })
        .eq("user_id", userId);
      if (err1) throw err1;

      // Activate the selected one
      const { error: err2 } = await supabase
        .from("google_ads_accounts")
        .update({ is_active: true })
        .eq("id", selectedAccountId);
      if (err2) throw err2;

      toast({ title: "Account geactiveerd", description: "Je geselecteerde account is actief" });
      setShowSelector(false);
      await loadAccounts();
    } catch (e) {
      console.error(e);
      toast({ title: "Opslaan mislukt", description: "Kon selectie niet opslaan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Geen gebruiker");

      // Try full removal of connections for a clean disconnect
      const { error } = await supabase
        .from("google_ads_accounts")
        .delete()
        .eq("user_id", userId);

      if (error) {
        // Fallback: just deactivate all
        await supabase.from("google_ads_accounts").update({ is_active: false }).eq("user_id", userId);
      }

      toast({ title: "Ontkoppeld", description: "Google Ads is losgekoppeld" });
      await loadAccounts();
    } catch (e) {
      console.error(e);
      toast({ title: "Ontkoppelen mislukt", description: "Probeer het opnieuw", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveLocalSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(localSettings));
    toast({ title: "Instellingen opgeslagen" });
  };

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Beheer je Google Ads integratie en voorkeuren.</p>
      </header>

      <Card className="professional-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-primary text-lg font-bold">A</span>
            </div>
            <div>
              <CardTitle className="flex items-center gap-3">
                Google Ads
                {loading ? (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Laden
                  </Badge>
                ) : hasActive ? (
                  <Badge variant="default">Connected</Badge>
                ) : accounts.length > 0 ? (
                  <Badge variant="secondary">Inactive</Badge>
                ) : (
                  <Badge variant="destructive">Not Connected</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Verbind één account voor analyses en AI-inzichten.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActive ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowSelector(true)}>
                  <SettingsIcon className="mr-2 h-4 w-4" /> Configure
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlugZap className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={handleConnect} disabled={connecting} className="bg-primary hover:bg-primary/90">
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Connect
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Selector (single account) */}
        {showSelector && (
          <CardContent className="space-y-4 pt-0">
            <Separator />
            <div className="space-y-2">
              <h4 className="font-semibold">Kies je actieve account</h4>
              {loading ? (
                <div className="flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Laden…</div>
              ) : accounts.length === 0 ? (
                <div className="text-muted-foreground">Geen accounts gevonden. Klik op Connect om te koppelen.</div>
              ) : (
                <div className="grid gap-2">
                  <select
                    className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                    value={selectedAccountId ?? ""}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id} disabled={acc.needs_reconnection}>
                        {acc.account_name || `Account ${acc.customer_id}`} ({acc.customer_id})
                        {acc.needs_reconnection ? " – reauth nodig" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveActive} disabled={saving || !selectedAccountId}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}Activeer
                    </Button>
                    <Button variant="outline" onClick={() => setShowSelector(false)}>Annuleren</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}

        {/* Extra instellingen */}
        <CardContent className="space-y-4">
          <button
            type="button"
            className="w-full flex items-center justify-between text-sm text-muted-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            Extra instellingen
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : "rotate-0"}`} />
          </button>
          {expanded && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Automatisch dagelijks syncen</div>
                  <div className="text-sm text-muted-foreground">Ververs je gegevens iedere dag automatisch.</div>
                </div>
                <Switch
                  checked={localSettings.autoSyncDaily}
                  onCheckedChange={(v) => setLocalSettings(s => ({ ...s, autoSyncDaily: Boolean(v) }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Wekelijkse e-mailinzichten</div>
                  <div className="text-sm text-muted-foreground">Ontvang 1x per week een samenvatting.</div>
                </div>
                <Switch
                  checked={localSettings.emailWeeklyInsights}
                  onCheckedChange={(v) => setLocalSettings(s => ({ ...s, emailWeeklyInsights: Boolean(v) }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Manager-accounts meenemen</div>
                  <div className="text-sm text-muted-foreground">Schakel in als je MCC-accounts wilt tonen.</div>
                </div>
                <Switch
                  checked={localSettings.includeManagerAccounts}
                  onCheckedChange={(v) => setLocalSettings(s => ({ ...s, includeManagerAccounts: Boolean(v) }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Ga naar Google Ads Console
                </a>
              </div>
              <div>
                <Button onClick={handleSaveLocalSettings}>Opslaan</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
