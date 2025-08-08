import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authorization },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Optional return URL from the frontend to redirect back after OAuth
    let returnUrl: string | null = null;
    try {
      const body = await req.json();
      returnUrl = body?.returnUrl || null;
    } catch (_e) {
      // no body provided
    }

    const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const redirectUri = `${supabaseUrl}/functions/v1/google-ads-callback`;

    console.log('🔧 OAuth Configuration:');
    console.log('Client ID:', clientId);
    console.log('Redirect URI:', redirectUri);
    console.log('Supabase URL:', supabaseUrl);

    if (!clientId) {
      throw new Error('Google Ads client ID not configured');
    }

    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ].join(' '));
    oauthUrl.searchParams.set('access_type', 'offline');
    oauthUrl.searchParams.set('prompt', 'consent');
    // Encode state with user id and return URL so callback can redirect correctly
    const statePayload = btoa(JSON.stringify({ u: user.id, r: returnUrl || 'https://preview--ads-boost-ai.lovable.app' }));
    oauthUrl.searchParams.set('state', statePayload);

    console.log('Generated OAuth URL for user:', user.id);
    console.log('Full OAuth URL:', oauthUrl.toString());

    return new Response(
      JSON.stringify({ 
        authUrl: oauthUrl.toString(),
        redirectUri: redirectUri,
        message: 'Redirect to this URL to complete Google Ads authorization'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in google-ads-connect:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});