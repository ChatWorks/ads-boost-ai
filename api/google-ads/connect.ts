import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const supabaseWithAuth = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Optional return URL from the frontend
    const { returnUrl } = req.body;

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const redirectUri = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/google-ads/callback`;

    console.log('🔧 OAuth Configuration:');
    console.log('Client ID:', clientId);
    console.log('Redirect URI:', redirectUri);
    console.log('Vercel URL:', process.env.VERCEL_URL);

    if (!clientId) {
      return res.status(500).json({ error: 'Google Ads client ID not configured' });
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
    
    // Encode state with user id and return URL
    const statePayload = Buffer.from(JSON.stringify({ 
      u: user.id, 
      r: returnUrl || (process.env.VERCEL_URL || 'http://localhost:3000') 
    })).toString('base64');
    oauthUrl.searchParams.set('state', statePayload);

    console.log('Generated OAuth URL for user:', user.id);
    console.log('Full OAuth URL:', oauthUrl.toString());

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    
    return res.status(200).json({ 
      authUrl: oauthUrl.toString(),
      redirectUri: redirectUri,
      message: 'Redirect to this URL to complete Google Ads authorization'
    });

  } catch (error: any) {
    console.error('Error in google-ads-connect:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(400).json({ error: error.message });
  }
}
