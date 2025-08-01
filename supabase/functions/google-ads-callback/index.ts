import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption function
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
          'Location': `https://preview--ads-boost-ai.lovable.app/integrations?error=${encodeURIComponent(error)}`
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

    // Encrypt refresh token
    const encryptedRefreshToken = await encrypt(tokens.refresh_token, Deno.env.get('ENCRYPTION_KEY') ?? '');

    // NOW GET REAL GOOGLE ADS CUSTOMER IDs WITH YOUR APPROVED DEVELOPER TOKEN
    console.log('🔍 Fetching accessible Google Ads customers...');
    
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!developerToken) {
      console.error('❌ No developer token found');
      throw new Error('Developer token not configured');
    }

    let accessibleCustomers: string[] = [];
    let customerDetails: any[] = [];

    try {
      // Get list of accessible customers
      const customersResponse = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
      });

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        accessibleCustomers = customersData.resourceNames || [];
        console.log('✅ Found accessible customers:', accessibleCustomers.length);

        // Get details for each customer
        for (const customerResource of accessibleCustomers.slice(0, 10)) { // Limit to first 10
          const customerId = customerResource.replace('customers/', '');
          
          try {
            const customerDetailResponse = await fetch(`https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'developer-token': developerToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: `SELECT 
                  customer.id, 
                  customer.descriptive_name, 
                  customer.currency_code, 
                  customer.time_zone,
                  customer.manager,
                  customer.test_account
                FROM customer 
                LIMIT 1`
              }),
            });

            if (customerDetailResponse.ok) {
              const detailData = await customerDetailResponse.json();
              if (detailData.results && detailData.results.length > 0) {
                const customer = detailData.results[0].customer;
                customerDetails.push({
                  customer_id: customer.id,
                  account_name: customer.descriptive_name || `Account ${customer.id}`,
                  currency_code: customer.currency_code,
                  time_zone: customer.time_zone,
                  is_manager: customer.manager || false,
                  is_test: customer.test_account || false,
                });
              }
            }
          } catch (detailError) {
            console.log('⚠️ Could not get details for customer:', customerId, detailError);
          }
        }
      } else {
        const customerError = await customersResponse.text();
        console.error('❌ Could not fetch customers:', customerError);
      }
    } catch (apiError) {
      console.error('❌ Google Ads API error:', apiError);
    }

    // Store accounts in database
    console.log('💾 Storing accounts in database...');
    
    if (customerDetails.length > 0) {
      // Store each real account
      for (const customerDetail of customerDetails) {
        await supabaseClient
          .from('google_ads_accounts')
          .upsert({
            user_id: state,
            customer_id: customerDetail.customer_id,
            account_name: customerDetail.account_name,
            currency_code: customerDetail.currency_code,
            time_zone: customerDetail.time_zone,
            is_manager: customerDetail.is_manager,
            account_type: customerDetail.is_test ? 'TEST' : 'PRODUCTION',
            refresh_token: encryptedRefreshToken,
            is_active: true,
            connection_status: 'CONNECTED',
            developer_token_status: 'BASIC_ACCESS', // or 'STANDARD_ACCESS' based on your token
            last_connection_test: new Date().toISOString(),
          }, {
            onConflict: 'user_id,customer_id'
          });
      }
      
      console.log('✅ Stored', customerDetails.length, 'Google Ads accounts');
    } else {
      // Fallback: store a placeholder if no customers found
      console.log('⚠️ No accessible customers found, storing placeholder...');
      
      await supabaseClient
        .from('google_ads_accounts')
        .upsert({
          user_id: state,
          customer_id: 'no_accounts_found',
          account_name: 'No Google Ads Accounts Found',
          refresh_token: encryptedRefreshToken,
          is_active: false,
          connection_status: 'ERROR',
          developer_token_status: 'UNKNOWN',
        }, {
          onConflict: 'user_id,customer_id'
        });
    }

    console.log('✅ Successfully completed OAuth flow for user:', state);

    // Redirect back to frontend with success
    const frontendUrl = 'https://preview--ads-boost-ai.lovable.app';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/integrations?success=true&accounts=${customerDetails.length}`
      }
    });

  } catch (error) {
    console.error('❌ Error in google-ads-callback:', error);
    const frontendUrl = 'https://preview--ads-boost-ai.lovable.app';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/integrations?error=${encodeURIComponent(error.message)}`
      }
    });
  }
});