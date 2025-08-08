import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { corsHeaders } from '../_shared/cors.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

function formatDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeDateRange(freq: 'daily'|'weekly'|'monthly') {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 1); // end at yesterday
  const start = new Date(end);
  if (freq === 'daily') start.setUTCDate(end.getUTCDate());
  else if (freq === 'weekly') start.setUTCDate(end.getUTCDate() - 6);
  else start.setUTCDate(end.getUTCDate() - 29);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client with user context
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    // Admin client for privileged DB reads/inserts
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: auth } = await supabaseUser.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const accountId: string = body.accountId;
    const metrics: string[] = body.metrics || [];
    const frequency: 'daily'|'weekly'|'monthly' = body.frequency || 'weekly';
    const title: string = body.title || 'Google Ads Insights';

    if (!accountId || !metrics.length) {
      return new Response(JSON.stringify({ error: 'accountId and metrics are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve recipient
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: 'No profile email found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: account } = await supabaseAdmin
      .from('google_ads_accounts')
      .select('account_name, customer_id')
      .eq('id', accountId)
      .maybeSingle();

    const { startDate, endDate } = computeDateRange(frequency);

    const { data: metricsRes, error: metricsErr } = await supabaseAdmin.functions.invoke('get-account-metrics', {
      body: {
        accountId,
        startDate,
        endDate,
        metrics,
      },
    });

    if (metricsErr) {
      return new Response(JSON.stringify({ error: metricsErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const m = metricsRes?.metrics || {};

    const periodLabel = `${startDate} to ${endDate}`;
    const html = `
      <h2 style="margin:0 0 8px 0;">${title}${account?.account_name ? ' - ' + account.account_name : ''}</h2>
      <p style="margin:0 0 16px 0; color:#555">Period: ${periodLabel}</p>
      <table style="border-collapse:collapse; width:100%">
        <tbody>
          ${metrics.includes('conversions') ? `<tr><td><strong>Conversions</strong></td><td style="text-align:right">${(m.conversions ?? 0).toLocaleString()}</td></tr>` : ''}
          ${metrics.includes('spend') ? `<tr><td><strong>Spend</strong></td><td style="text-align:right">$${Number(m.spend ?? 0).toFixed(2)}</td></tr>` : ''}
          ${metrics.includes('impressions') ? `<tr><td><strong>Impressions</strong></td><td style="text-align:right">${(m.impressions ?? 0).toLocaleString()}</td></tr>` : ''}
          ${metrics.includes('clicks') ? `<tr><td><strong>Clicks</strong></td><td style="text-align:right">${(m.clicks ?? 0).toLocaleString()}</td></tr>` : ''}
          ${metrics.includes('cpm') ? `<tr><td><strong>CPM</strong></td><td style="text-align:right">$${Number(m.cpm ?? 0).toFixed(2)}</td></tr>` : ''}
          ${metrics.includes('ctr') ? `<tr><td><strong>CTR</strong></td><td style="text-align:right">${((m.ctr ?? 0) * 100).toFixed(2)}%</td></tr>` : ''}
        </tbody>
      </table>
      <p style="margin-top:16px; color:#555">This is a one-off test email for your Google Ads insights.</p>
    `;

    try {
      const email = await resend.emails.send({
        from: 'Innogo Insights <onboarding@resend.dev>',
        to: [profile.email],
        subject: `${title}${account?.account_name ? ' - ' + account.account_name : ''} (Test)`,
        html,
      });

      await supabaseAdmin.from('insights_email_logs').insert({
        subscription_id: null,
        user_id: user.id,
        google_ads_account_id: accountId,
        status: 'TEST_SENT',
        metrics_snapshot: m,
      });

      return new Response(JSON.stringify({ ok: true, id: email?.data?.id || null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await supabaseAdmin.from('insights_email_logs').insert({
        subscription_id: null,
        user_id: user.id,
        google_ads_account_id: accountId,
        status: 'FAILED',
        error_message: e.message,
        metrics_snapshot: m,
      });
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});