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

function getLocalHHmm(tz: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const h = parts.find(p => p.type === 'hour')?.value || '00';
  const m = parts.find(p => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
}

function minutesDiff(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return Math.abs((ah * 60 + am) - (bh * 60 + bm));
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

function isDue(sub: any, nowTzHHmm: string, now: Date) {
  if (sub.is_paused) return false;
  // allow a 5-minute window
  if (minutesDiff(sub.send_time, nowTzHHmm) > 2) return false;

  const last = sub.last_sent_at ? new Date(sub.last_sent_at) : null;
  if (sub.frequency === 'daily') {
    if (!last) return true;
    const diffHrs = (now.getTime() - last.getTime()) / 36e5;
    return diffHrs >= 20; // safe window
  }
  if (sub.frequency === 'weekly') {
    if (!last) return true;
    const diffDays = (now.getTime() - last.getTime()) / 86400000;
    return diffDays >= 6.5; // about a week
  }
  // monthly
  if (!last) return true;
  const diffDays = (now.getTime() - last.getTime()) / 86400000;
  return diffDays >= 27; // about a month
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch active subscriptions
    const { data: subs, error: subsErr } = await supabaseAdmin
      .from('insights_email_subscriptions')
      .select('*')
      .eq('is_paused', false);

    if (subsErr) throw subsErr;

    const now = new Date();

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const sub of subs || []) {
      const nowTzHHmm = getLocalHHmm(sub.time_zone || 'UTC', now);
      if (!isDue(sub, nowTzHHmm, now)) continue;

      processed++;

      // Get recipient email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', sub.user_id)
        .maybeSingle();
      if (!profile?.email) {
        failed++;
        await supabaseAdmin.from('insights_email_logs').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          google_ads_account_id: sub.google_ads_account_id,
          status: 'FAILED',
          error_message: 'No profile email found',
          metrics_snapshot: {},
        });
        continue;
      }

      const { data: account } = await supabaseAdmin
        .from('google_ads_accounts')
        .select('account_name, customer_id')
        .eq('id', sub.google_ads_account_id)
        .maybeSingle();

      const { startDate, endDate } = computeDateRange(sub.frequency);

      // Fetch metrics summary via our metrics function
      const { data: metricsRes, error: metricsErr } = await supabaseAdmin.functions.invoke('get-account-metrics', {
        body: {
          accountId: sub.google_ads_account_id,
          startDate,
          endDate,
          metrics: sub.selected_metrics,
        }
      });

      if (metricsErr) {
        failed++;
        await supabaseAdmin.from('insights_email_logs').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          google_ads_account_id: sub.google_ads_account_id,
          status: 'FAILED',
          error_message: metricsErr.message,
          metrics_snapshot: {},
        });
        continue;
      }

      const m = metricsRes?.metrics || {};

      const periodLabel = `${startDate} to ${endDate}`;
      const html = `
        <h2 style="margin:0 0 8px 0;">Google Ads Insights${account?.account_name ? ' - ' + account.account_name : ''}</h2>
        <p style="margin:0 0 16px 0; color:#555">Period: ${periodLabel}</p>
        <table style="border-collapse:collapse; width:100%">
          <tbody>
            ${sub.selected_metrics.includes('conversions') ? `<tr><td><strong>Conversions</strong></td><td style="text-align:right">${(m.conversions ?? 0).toLocaleString()}</td></tr>` : ''}
            ${sub.selected_metrics.includes('spend') ? `<tr><td><strong>Spend</strong></td><td style="text-align:right">$${Number(m.spend ?? 0).toFixed(2)}</td></tr>` : ''}
            ${sub.selected_metrics.includes('impressions') ? `<tr><td><strong>Impressions</strong></td><td style="text-align:right">${(m.impressions ?? 0).toLocaleString()}</td></tr>` : ''}
            ${sub.selected_metrics.includes('clicks') ? `<tr><td><strong>Clicks</strong></td><td style="text-align:right">${(m.clicks ?? 0).toLocaleString()}</td></tr>` : ''}
            ${sub.selected_metrics.includes('cpm') ? `<tr><td><strong>CPM</strong></td><td style="text-align:right">$${Number(m.cpm ?? 0).toFixed(2)}</td></tr>` : ''}
            ${sub.selected_metrics.includes('ctr') ? `<tr><td><strong>CTR</strong></td><td style="text-align:right">${((m.ctr ?? 0) * 100).toFixed(2)}%</td></tr>` : ''}
          </tbody>
        </table>
        <p style="margin-top:16px; color:#555">You are receiving this because you subscribed to ${sub.frequency} Google Ads insights for this account at ${sub.send_time} (${sub.time_zone}).</p>
      `;

      try {
        const email = await resend.emails.send({
          from: 'Innogo Insights <onboarding@resend.dev>',
          to: [profile.email],
          subject: `Google Ads Insights${account?.account_name ? ' - ' + account.account_name : ''}`,
          html,
        });

        await supabaseAdmin.from('insights_email_logs').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          google_ads_account_id: sub.google_ads_account_id,
          status: 'SENT',
          metrics_snapshot: m,
        });

        await supabaseAdmin
          .from('insights_email_subscriptions')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', sub.id);

        sent++;
      } catch (e: any) {
        failed++;
        await supabaseAdmin.from('insights_email_logs').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          google_ads_account_id: sub.google_ads_account_id,
          status: 'FAILED',
          error_message: e.message,
          metrics_snapshot: m,
        });
      }
    }

    return new Response(JSON.stringify({ processed, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});