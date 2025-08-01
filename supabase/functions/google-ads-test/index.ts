import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use correct Google Ads API version
const GOOGLE_ADS_API_VERSION = 'v20'; // Latest version (June 2025)

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
    
    console.log('🧪 DEBUGGING Google Ads connection...');
    console.log('👤 User ID:', user.id);
    console.log('🏦 Account ID:', accountId);
    console.log('🔧 Using API version:', GOOGLE_ADS_API_VERSION);

    // Get account from database
    const { data: account, error: dbError } = await supabaseClient
      .from('google_ads_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', accountId)
      .single();

    if (dbError || !account) {
      console.error('❌ Account not found in database:', dbError);
      throw new Error('Account not found');
    }

    console.log('🔍 Found account in DB:', {
      name: account.account_name,
      customer_id: account.customer_id,
      is_active: account.is_active
    });

    // Check environment variables
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
    
    console.log('🔧 Environment Check:', {
      hasDeveloperToken: !!developerToken,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      developerTokenLength: developerToken?.length || 0
    });

    if (!developerToken) {
      throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not found in environment');
    }

    if (developerToken.length !== 22) {
      console.warn('⚠️ Developer token should be 22 characters long, got:', developerToken.length);
    }

    // Decrypt and test refresh token
    console.log('🔄 Testing token refresh...');
    const refreshToken = await decrypt(account.refresh_token, Deno.env.get('ENCRYPTION_KEY') ?? '');
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token refresh failed:', errorText);
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Token refresh successful');

    // STEP 1: Test listAccessibleCustomers with CORRECT API version
    console.log('🔍 Step 1: Testing listAccessibleCustomers with API version', GOOGLE_ADS_API_VERSION);
    
    const listCustomersURL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`;
    console.log('🔗 Using URL:', listCustomersURL);
    
    const listCustomersResponse = await fetch(listCustomersURL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('📊 listAccessibleCustomers response status:', listCustomersResponse.status);

    if (!listCustomersResponse.ok) {
      const errorText = await listCustomersResponse.text();
      console.error('❌ listAccessibleCustomers failed:', errorText);
      
      let errorDetails: any = {};
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { rawError: errorText };
      }

      return new Response(
        JSON.stringify({ 
          success: false,
          step: 'listAccessibleCustomers',
          message: 'Failed to list accessible customers',
          details: {
            tokenRefresh: 'OK',
            httpStatus: listCustomersResponse.status,
            url: listCustomersURL,
            apiVersion: GOOGLE_ADS_API_VERSION,
            error: errorDetails,
            troubleshooting: {
              404: `API endpoint not found. Version ${GOOGLE_ADS_API_VERSION} may be incorrect.`,
              401: 'Authentication failed - check your developer token',
              403: 'Developer token not approved for this Google account',
              400: 'Bad request - check your request format'
            }
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const customersData = await listCustomersResponse.json();
    console.log('✅ listAccessibleCustomers successful:', customersData);

    const accessibleCustomers = customersData.resourceNames || [];
    console.log('📋 Accessible customers:', accessibleCustomers.length);

    // STEP 2: Try to get customer info if we have accessible customers
    let customerInfoResults: any[] = [];
    
    if (accessibleCustomers.length > 0) {
      console.log('🔍 Step 2: Testing customer info retrieval...');
      
      // Test with first few customers
      for (const customerResource of accessibleCustomers.slice(0, 3)) {
        const customerId = customerResource.replace('customers/', '');
        
        try {
          const customerSearchURL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`;
          console.log('🔗 Testing customer search for:', customerId);
          
          const customerResponse = await fetch(customerSearchURL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
              'developer-token': developerToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1'
            }),
          });

          if (customerResponse.ok) {
            const customerData = await customerResponse.json();
            customerInfoResults.push({
              customer_id: customerId,
              status: 'SUCCESS',
              data: customerData.results?.[0]?.customer || null
            });
            console.log('✅ Customer info retrieved for:', customerId);
          } else {
            const customerError = await customerResponse.text();
            customerInfoResults.push({
              customer_id: customerId,
              status: 'FAILED',
              error: customerError
            });
            console.log('⚠️ Customer info failed for:', customerId, customerError);
          }
        } catch (err) {
          customerInfoResults.push({
            customer_id: customerId,
            status: 'ERROR',
            error: err.message
          });
          console.log('⚠️ Customer info error for:', customerId, err);
        }
      }
    }

    // Return comprehensive test results
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Google Ads API connection test completed successfully!',
        results: {
          apiVersion: GOOGLE_ADS_API_VERSION,
          tokenRefresh: 'OK',
          listAccessibleCustomers: 'OK',
          accessibleCustomersCount: accessibleCustomers.length,
          accessibleCustomers: accessibleCustomers,
          customerInfoTests: customerInfoResults,
          successfulCustomerTests: customerInfoResults.filter(r => r.status === 'SUCCESS').length,
        },
        recommendations: accessibleCustomers.length === 0 ? [
          'No accessible customers found. This could mean:',
          '1. Your Google account is not linked to any Google Ads accounts',
          '2. Your developer token is not approved for the Google account you used for OAuth',
          '3. You need to create Google Ads accounts first',
          '4. Your OAuth user needs to be granted access to existing Google Ads accounts'
        ] : [
          'Connection is working! You can now:',
          '1. Your database should be populated with real customer IDs',
          '2. Start fetching campaign data from these customers',
          '3. Begin building your AI analysis features'
        ],
        nextSteps: {
          checkDatabase: 'Verify that real customer IDs are now stored in your google_ads_accounts table',
          testCampaigns: 'Try fetching campaign data from accessible customers',
          buildFeatures: 'Start implementing your AI analysis features'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Debug test failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        message: error.message,
        details: {
          apiVersion: GOOGLE_ADS_API_VERSION,
          error: error.message,
          stack: error.stack
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});