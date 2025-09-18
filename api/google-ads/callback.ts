import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const GOOGLE_ADS_API_VERSION = 'v20';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  try {
    const { code, state, error } = req.query;

    console.log('📥 Callback received:', { 
      hasCode: !!code, 
      hasState: !!state, 
      error: error,
      apiVersion: GOOGLE_ADS_API_VERSION
    });

    if (error) {
      console.error('❌ OAuth error from Google:', error);
      return res.redirect(`${process.env.VERCEL_URL || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      console.error('❌ Missing required parameters:', { code: !!code, state: !!state });
      return res.redirect(`${process.env.VERCEL_URL || 'http://localhost:3000'}/integrations?error=Missing authorization code or state`);
    }

    // Decode state (may contain user id and return URL)
    let userId: string | null = null;
    let returnUrl = process.env.VERCEL_URL || 'http://localhost:3000';
    try {
      const parsed = JSON.parse(Buffer.from(state as string, 'base64').toString());
      if (parsed?.u) userId = parsed.u;
      if (parsed?.r) returnUrl = parsed.r;
    } catch (_e) {
      // state was plain user id; keep defaults
      userId = state as string;
    }

    // Exchange code for tokens
    console.log('🔄 Exchanging code for tokens...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/google-ads/callback`,
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
    const encryptedRefreshToken = encrypt(tokens.refresh_token, process.env.ENCRYPTION_KEY!);

    // Get Developer Token
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      console.error('❌ No developer token found');
      throw new Error('Developer token not configured');
    }

    console.log('🔍 Fetching accessible Google Ads customers with API version:', GOOGLE_ADS_API_VERSION);

    let accessibleCustomers: string[] = [];
    let customerDetails: any[] = [];

    try {
      // Get accessible customers
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
          const { error: insertError } = await supabase
            .from('google_ads_accounts')
            .upsert({
              user_id: userId!,
              customer_id: customerDetail.customer_id,
              account_name: customerDetail.account_name,
              currency_code: customerDetail.currency_code,
              time_zone: customerDetail.time_zone,
              is_manager: customerDetail.is_manager,
              account_type: customerDetail.is_test ? 'TEST' : 'PRODUCTION',
              refresh_token: encryptedRefreshToken,
              is_active: true,
              connection_status: 'CONNECTED',
              developer_token_status: 'APPROVED',
              last_connection_test: new Date().toISOString(),
              needs_reconnection: false, // Fresh connection
              last_error_message: null,
              last_error_at: null,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour from now
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
        }
      }
      
      console.log('✅ Successfully stored', customerDetails.length, 'Google Ads accounts');
    } else {
      // Fallback: store connection info even if no customers found
      console.log('⚠️ No accessible customers found, storing OAuth connection...');
      
      await supabase
        .from('google_ads_accounts')
        .upsert({
          user_id: userId!,
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

    console.log('✅ Successfully completed OAuth flow for user:', userId);

    // Redirect back to frontend with success and account count
    const successParams = new URLSearchParams({
      success: 'true',
      accounts: customerDetails.length.toString(),
      api_version: GOOGLE_ADS_API_VERSION
    });
    
    return res.redirect(`${returnUrl}/integrations?${successParams.toString()}`);

  } catch (error: any) {
    console.error('❌ Error in google-ads-callback:', error);
    return res.redirect(`${process.env.VERCEL_URL || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(error.message)}`);
  }
}

// Encryption function using Node.js crypto
function encrypt(text: string, key: string): string {
  const algorithm = 'aes-256-gcm';
  const keyBuffer = Buffer.from(key.slice(0, 32).padEnd(32, '0'), 'utf8');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipher(algorithm, keyBuffer);
  cipher.setAAD(Buffer.from(''));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + encrypted data
  const result = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
  return result.toString('base64');
}
