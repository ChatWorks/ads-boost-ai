import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption functions
async function encrypt(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...result));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('📥 Callback received:', { 
      hasCode: !!code, 
      hasState: !!state, 
      error: error,
      fullUrl: req.url 
    });

    if (error) {
      console.error('❌ OAuth error from Google:', error);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${req.headers.get('origin') || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(error)}`
        }
      });
    }

    if (!code || !state) {
      console.error('❌ Missing required parameters:', { code: !!code, state: !!state });
      throw new Error('Missing authorization code or state');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Exchange code for tokens
    console.log('🔄 Exchanging code for tokens...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_ADS_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET') ?? '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-ads-callback`,
      }),
    });

    console.log('📊 Token response status:', tokenResponse.status);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Tokens received, has refresh_token:', !!tokens.refresh_token);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received');
    }

    // Get accessible customers using Google Ads API
    const customersResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') ?? '',
      },
    });

    const customersData = await customersResponse.json();
    console.log('Accessible customers:', customersData);

    // Encrypt refresh token
    const encryptedRefreshToken = await encrypt(tokens.refresh_token, Deno.env.get('ENCRYPTION_KEY') ?? '');

    // Store accounts in database
    if (customersData.resourceNames) {
      for (const resourceName of customersData.resourceNames) {
        const customerId = resourceName.split('/')[1];
        
        // Get customer details
        const customerResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'developer-token': Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') ?? '',
          },
        });

        let customerData: any = {};
        if (customerResponse.ok) {
          customerData = await customerResponse.json();
        }

        // Insert or update Google Ads account
        await supabaseClient
          .from('google_ads_accounts')
          .upsert({
            user_id: state,
            customer_id: customerId,
            account_name: customerData.descriptiveName || `Account ${customerId}`,
            currency_code: customerData.currencyCode,
            time_zone: customerData.timeZone,
            refresh_token: encryptedRefreshToken,
            is_active: true,
          }, {
            onConflict: 'user_id,customer_id'
          });
      }
    }

    console.log('Successfully stored Google Ads accounts for user:', state);

    // Redirect back to frontend
    const frontendUrl = req.headers.get('referer')?.split('/integrations')[0] || 'http://localhost:3000';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/integrations?success=true`
      }
    });

  } catch (error) {
    console.error('Error in google-ads-callback:', error);
    const frontendUrl = req.headers.get('referer')?.split('/integrations')[0] || 'http://localhost:3000';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/integrations?error=${encodeURIComponent(error.message)}`
      }
    });
  }
});