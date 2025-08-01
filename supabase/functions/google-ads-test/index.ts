import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decryption function
async function decrypt(encryptedText: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const encryptedData = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}

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

    const { accountId } = await req.json();
    
    console.log('🧪 Testing Google Ads connection for account:', accountId);
    console.log('👤 User ID:', user.id);

    // Get refresh token from database
    const { data: account, error: dbError } = await supabaseClient
      .from('google_ads_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', accountId)
      .single();

    if (dbError || !account) {
      throw new Error('Account not found');
    }

    console.log('🔍 Found account:', account.account_name);

    // Decrypt refresh token
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY') ?? '');
    
    // Test token refresh
    console.log('🔄 Testing token refresh...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_ADS_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_ADS_CLIENT_SECRET') ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh access token');
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Token refresh successful');

    // Test Google Ads API access (if developer token is available)
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (developerToken && developerToken !== 'your_developer_token_here') {
      console.log('🔍 Testing Google Ads API access...');
      
      const adsResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'developer-token': developerToken,
        },
      });

      if (adsResponse.ok) {
        const adsData = await adsResponse.json();
        console.log('✅ Google Ads API test successful');
        
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Full connection test successful! Google Ads API is accessible.',
            details: {
              tokenRefresh: 'OK',
              adsApiAccess: 'OK',
              accessibleCustomers: adsData.resourceNames?.length || 0
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } else {
        const errorText = await adsResponse.text();
        console.log('❌ Google Ads API test failed:', errorText);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            message: 'OAuth tokens work, but Google Ads API access failed. Developer token may need activation.',
            details: {
              tokenRefresh: 'OK',
              adsApiAccess: 'FAILED',
              error: errorText
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    } else {
      console.log('⚠️ No valid developer token found');
      
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'OAuth tokens work, but no Google Ads Developer Token found. Please add GOOGLE_ADS_DEVELOPER_TOKEN to secrets.',
          details: {
            tokenRefresh: 'OK',
            adsApiAccess: 'SKIPPED - No Developer Token'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        message: error.message,
        details: {
          error: error.message
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});