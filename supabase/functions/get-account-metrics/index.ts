import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { accountId, startDate, endDate, metrics } = await req.json();
    if (!accountId || !startDate || !endDate) {
      throw new Error('accountId, startDate, and endDate are required');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Invoke existing get-campaigns function to fetch campaign metrics and aggregate
    const { data, error } = await supabaseAdmin.functions.invoke('get-campaigns', {
      body: {
        accountId,
        filters: {
          dateRange: 'CUSTOM',
          startDate,
          endDate,
          metrics: metrics ?? ['impressions', 'clicks', 'conversions', 'cost_micros']
        }
      }
    });

    if (error) throw new Error(error.message || 'Failed to fetch campaigns');

    const campaigns = data?.campaigns || [];

    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let spend = 0; // in account currency

    for (const c of campaigns) {
      const m = c.metrics || {};
      impressions += Number(m.impressions || 0);
      clicks += Number(m.clicks || 0);
      conversions += Number(m.conversions || 0);
      spend += Number(m.cost || 0); // get-campaigns already converts cost_micros to cost
    }

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const conversion_rate = clicks > 0 ? conversions / clicks : 0;

    const result = {
      impressions,
      clicks,
      conversions,
      spend,
      ctr,
      cpm,
      conversion_rate,
      startDate,
      endDate,
    };

    return new Response(JSON.stringify({ metrics: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});