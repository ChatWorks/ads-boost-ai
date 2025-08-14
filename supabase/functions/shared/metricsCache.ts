// Shared cache management utilities for Google Ads metrics
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export interface CacheOptions {
  accountId: string;
  cacheKey: string;
  ttlHours?: number;
}

export interface CachedData {
  data: any;
  created_at: string;
  expires_at: string;
}

/**
 * Generate a cache key from query parameters
 */
export function generateCacheKey(entityType: string, dateRange: string, metrics: string[]): string {
  const sortedMetrics = metrics.sort().join(',');
  return `${entityType}_${dateRange}_${sortedMetrics}`;
}

/**
 * Generate a hash for query deduplication
 */
export async function generateQueryHash(queryData: any): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(queryData));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get cached data if available and not expired
 */
export async function getCachedData(options: CacheOptions): Promise<CachedData | null> {
  try {
    const { data, error } = await supabase
      .from('google_ads_metrics_cache')
      .select('data, created_at, expires_at')
      .eq('account_id', options.accountId)
      .eq('cache_key', options.cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

/**
 * Store data in cache with TTL
 */
export async function setCachedData(
  options: CacheOptions, 
  data: any, 
  queryHash: string
): Promise<void> {
  try {
    const ttlHours = options.ttlHours || 1; // Default 1 hour
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const { error } = await supabase
      .from('google_ads_metrics_cache')
      .upsert({
        account_id: options.accountId,
        cache_key: options.cacheKey,
        query_hash: queryHash,
        data: data,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'account_id,cache_key'
      });

    if (error) {
      console.error('Error setting cached data:', error);
    }
  } catch (error) {
    console.error('Error in setCachedData:', error);
  }
}

/**
 * Get historical data from daily metrics table
 */
export async function getHistoricalData(
  accountId: string,
  entityType: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('google_ads_metrics_daily')
      .select('date, entity_id, entity_name, metrics')
      .eq('account_id', accountId)
      .eq('entity_type', entityType)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error getting historical data:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getHistoricalData:', error);
    return [];
  }
}

/**
 * Store daily metrics data
 */
export async function storeDailyMetrics(
  accountId: string,
  entityType: string,
  date: string,
  entityId: string | null,
  entityName: string | null,
  metrics: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from('google_ads_metrics_daily')
      .upsert({
        account_id: accountId,
        date,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        metrics
      }, {
        onConflict: 'account_id,date,entity_type,entity_id'
      });

    if (error) {
      console.error('Error storing daily metrics:', error);
    }
  } catch (error) {
    console.error('Error in storeDailyMetrics:', error);
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const { error } = await supabase.rpc('cleanup_expired_cache');
    
    if (error) {
      console.error('Error cleaning up expired cache:', error);
      return 0;
    }

    return 1; // Function returns count
  } catch (error) {
    console.error('Error in cleanupExpiredCache:', error);
    return 0;
  }
}