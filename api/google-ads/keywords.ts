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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 get-keywords function called');
    const { accountId, filters } = req.body;
    if (!accountId) throw new Error('Account ID is required');

    // Get user from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Verify user has access to this account
    const { data: account, error: accountError } = await supabase
      .from('google_ads_accounts')
      .select('id, user_id, customer_id, refresh_token, needs_reconnection')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error('Google Ads account not found or access denied.');
    }
    if (account.needs_reconnection) {
      throw new Error('Account requires reconnection.');
    }

    // Refresh token
    const refreshToken = decrypt(account.refresh_token, process.env.ENCRYPTION_KEY!);
    const { access_token } = await getRefreshedToken(refreshToken, accountId);

    // metrics: accept full field paths and plain metric names
    const defaultMetrics = [
      'impressions', 
      'clicks', 
      'cost_micros', 
      'ctr', 
      'conversions',
      'conversion_value',
      'value_per_conversion',
      'quality_score'
    ];
    const incoming = filters?.metrics?.slice() || defaultMetrics;
    const normalized = incoming.map((f: string) => {
      if (!f) return '';
      const t = f.trim();
      if (t.startsWith('metrics.') || t.includes('.')) return t;
      return `metrics.${t}`;
    }).filter(Boolean);
    const metricsQuery = normalized.join(', ');

    // date range
    let dateCondition = 'segments.date DURING LAST_30_DAYS';
    if (filters?.dateRange) {
      const dr = filters.dateRange;
      if (dr === 'LAST_7_DAYS') dateCondition = 'segments.date DURING LAST_7_DAYS';
      else if (dr === 'LAST_14_DAYS') dateCondition = 'segments.date DURING LAST_14_DAYS';
      else if (dr === 'LAST_90_DAYS') dateCondition = 'segments.date DURING LAST_90_DAYS';
      else if (dr === 'CUSTOM' && filters.startDate && filters.endDate) {
        const sd = filters.startDate.replace(/-/g, '');
        const ed = filters.endDate.replace(/-/g, '');
        dateCondition = `segments.date BETWEEN '${sd}' AND '${ed}'`;
      }
    }

    // status
    const statuses = filters?.keywordStatus || ['ENABLED'];
    const statusCondition = `ad_group_criterion.status IN (${statuses.map(s => `'${s}'`).join(',')})`;

    const limit = filters?.limit || 50;
    const query = `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        ${metricsQuery}
      FROM keyword_view
      WHERE ${dateCondition}
        AND ${statusCondition}
        AND campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
      ORDER BY metrics.impressions DESC
      LIMIT ${limit}`;

    const customerId = account.customer_id.replace(/-/g, '');
    let response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
          'login-customer-id': customerId,
        },
        body: JSON.stringify({ query }),
      }
    );

    // token refresh fallback
    if (response.status === 401) {
      const newTokens = await getRefreshedToken(refreshToken, accountId);
      response = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newTokens.access_token}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query }),
        }
      );
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Ads API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const keywords = data[0]?.results?.map((row: any) => ({
      criterion_id: row.ad_group_criterion.criterion_id,
      keyword: {
        text: row.ad_group_criterion.keyword.text,
        match_type: row.ad_group_criterion.keyword.match_type,
      },
      status: row.ad_group_criterion.status,
      ad_group: {
        id: row.ad_group.id,
        name: row.ad_group.name,
      },
      campaign: {
        id: row.campaign.id,
        name: row.campaign.name,
      },
      metrics: {
        ...row.metrics,
        cost: (row.metrics.cost_micros || 0) / 1e6,
        average_cpc: (row.metrics.average_cpc || 0) / 1e6,
        cost_per_conversion: (row.metrics.cost_per_conversion || 0) / 1e6,
        conversion_value_dollars: (row.metrics.conversion_value || 0) / 1e6,
        value_per_conversion_dollars: (row.metrics.value_per_conversion || 0) / 1e6,
        conversion_rate:
          row.metrics.clicks > 0 && row.metrics.conversions > 0
            ? row.metrics.conversions / row.metrics.clicks
            : 0,
        // Calculated ROAS (Return on Ad Spend)
        roas: row.metrics.conversion_value > 0 && row.metrics.cost_micros > 0
          ? (row.metrics.conversion_value / row.metrics.cost_micros)
          : 0,
        // Calculated ROMI (Return on Marketing Investment) - percentage
        romi: row.metrics.conversion_value > 0 && row.metrics.cost_micros > 0
          ? ((row.metrics.conversion_value - row.metrics.cost_micros) / row.metrics.cost_micros) * 100
          : 0,
        // CPM (Cost per 1000 impressions)
        cpm: row.metrics.impressions > 0 && row.metrics.cost_micros > 0
          ? (row.metrics.cost_micros / row.metrics.impressions) * 1000 / 1e6
          : 0,
        // Quality Score
        quality_score: row.metrics.quality_score || 0,
      },
    })) || [];

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    
    return res.status(200).json({
      keywords,
      cached: false,
      fetched_at: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('Error in get-keywords:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(400).json({ error: err.message });
  }
}

async function getRefreshedToken(refreshToken: string, accountId: string) {
  console.log('🔐 Attempting to refresh token...');
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  
  if (!clientId) {
    throw new Error('GOOGLE_ADS_CLIENT_ID is missing or empty');
  }
  if (!clientSecret) {
    throw new Error('GOOGLE_ADS_CLIENT_SECRET is missing or empty');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
  }
  const tokenData = await response.json();
  return tokenData;
}

// Decryption function using Node.js crypto
function decrypt(encryptedText: string, key: string): string {
  try {
    const algorithm = 'aes-256-gcm';
    const keyBuffer = Buffer.from(key.slice(0, 32).padEnd(32, '0'), 'utf8');
    
    // Decode base64
    const encryptedBuffer = Buffer.from(encryptedText, 'base64');
    
    // Extract IV (first 16 bytes), authTag (next 16 bytes), and encrypted data
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const encrypted = encryptedBuffer.subarray(32);
    
    const decipher = crypto.createDecipher(algorithm, keyBuffer);
    decipher.setAAD(Buffer.from(''));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}
