import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Current Google Ads API version (use latest)
const GOOGLE_ADS_API_VERSION = 'v20'; // v20 is the latest stable version (June 2025)

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
      apiVersion: GOOGLE_ADS_API_VERSION
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

    // Get Developer Token
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!developerToken) {
      console.error('❌ No developer token found');
      throw new Error('Developer token not configured');
    }

    console.log('🔍 Fetching accessible Google Ads customers with API version:', GOOGLE_ADS_API_VERSION);

    let accessibleCustomers: string[] = [];
    let customerDetails: any[] = [];

    try {
      // CORRECTED: Use proper API version and URL
      const customersResponse = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 listAccessibleCustomers response status:', customersResponse.status);

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        accessibleCustomers = customersData.resourceNames || [];
        console.log('✅ Found accessible customers:', accessibleCustomers.length);
        console.log('📋 Customer resource names:', accessibleCustomers);

        // Get details for each customer (limit to first 5 to avoid timeouts)
        for (const customerResource of accessibleCustomers.slice(0, 5)) {
          const customerId = customerResource.replace('customers/', '');
          
          try {
            console.log('🔍 Getting details for customer:', customerId);
            
            const customerDetailResponse = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`, {
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

            console.log('📊 Customer detail response status for', customerId, ':', customerDetailResponse.status);

            if (customerDetailResponse.ok) {
              const detailData = await customerDetailResponse.json();
              console.log('✅ Got customer details for', customerId);
              
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
                console.log('✅ Added customer details for:', customer.id);
              }
            } else {
              const detailError = await customerDetailResponse.text();
              console.log('⚠️ Could not get details for customer:', customerId, 'Error:', detailError);
              
              // Add basic info even if detailed info fails
              customerDetails.push({
                customer_id: customerId,
                account_name: `Google Ads Account ${customerId}`,
                currency_code: null,
                time_zone: null,
                is_manager: false,
                is_test: false,
              });
            }
          } catch (detailError) {
            console.log('⚠️ Exception getting details for customer:', customerId, detailError);
            
            // Add basic info even if detailed info fails
            customerDetails.push({
              customer_id: customerId,
              account_name: `Google Ads Account ${customerId}`,
              currency_code: null,
              time_zone: null,
              is_manager: false,
              is_test: false,
            });
          }
        }
      } else {
        const customerError = await customersResponse.text();
        console.error('❌ Could not fetch customers:', customersResponse.status, customerError);
        
        // More specific error handling
        if (customersResponse.status === 404) {
          throw new Error(`API endpoint not found. Check if API version ${GOOGLE_ADS_API_VERSION} is correct.`);
        } else if (customersResponse.status === 401) {
          throw new Error('Authentication failed. Check your developer token and OAuth credentials.');
        } else if (customersResponse.status === 403) {
          throw new Error('Permission denied. Your developer token may not be approved for this Google account.');
        } else {
          throw new Error(`Google Ads API error: ${customersResponse.status} - ${customerError}`);
        }
      }
    } catch (apiError) {
      console.error('❌ Google Ads API error:', apiError);
      throw apiError; // Re-throw to be handled by outer catch
    }

    // Store accounts in database
    console.log('💾 Storing', customerDetails.length, 'accounts in database...');
    
    if (customerDetails.length > 0) {
      // Store each real account
      for (const customerDetail of customerDetails) {
        try {
          const { error: insertError } = await supabaseClient
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
              developer_token_status: 'APPROVED', // Since it worked
              last_connection_test: new Date().toISOString(),
            }, {
              onConflict: 'user_id,customer_id'
            });

          if (insertError) {
            console.error('❌ Database insert error for customer', customerDetail.customer_id, ':', insertError);
          } else {
            console.log('✅ Stored customer in database:', customerDetail.customer_id);
          }
        } catch (dbError) {
          console.error('❌ Database error for customer', customerDetail.customer_id, ':', dbError);
        }      }
      
      console.log('✅ Successfully stored', customerDetails.length, 'Google Ads accounts');
    } else {
      // Fallback: store connection info even if no customers found
      console.log('⚠️ No accessible customers found, storing OAuth connection...');
      
      await supabaseClient
        .from('google_ads_accounts')
        .upsert({
          user_id: state,
          customer_id: 'oauth_connected_no_accounts',
          account_name: 'OAuth Connected - No Accessible Accounts',
          refresh_token: encryptedRefreshToken,
          is_active: false,
          connection_status: 'CONNECTED',
          developer_token_status: 'APPROVED',
          account_type: 'PRODUCTION',
        }, {
          onConflict: 'user_id,customer_id'
        });
    }

    console.log('✅ Successfully completed OAuth flow for user:', state);

    // Redirect back to frontend with success and account count
    const frontendUrl = 'https://preview--ads-boost-ai.lovable.app';
    const successParams = new URLSearchParams({
      success: 'true',
      accounts: customerDetails.length.toString(),
      api_version: GOOGLE_ADS_API_VERSION
    });
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${frontendUrl}/integrations?${successParams.toString()}`
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