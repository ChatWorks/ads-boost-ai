import { useState, useCallback, useRef, useEffect } from 'react';
import { dataConsolidationService } from '@/services/dataConsolidation';
import { aiDataPreparationService } from '@/services/aiDataPreparation';

interface DataRefreshOptions {
  accountId: string;
  forceRefresh?: boolean;
  maxAge?: number; // in milliseconds
}

interface RefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  error: string | null;
}

export function useDataRefresh() {
  const [refreshState, setRefreshState] = useState<RefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    error: null
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Smart data refresh with hybrid caching strategy
   */
  const refreshData = useCallback(async (options: DataRefreshOptions) => {
    const { accountId, forceRefresh = false, maxAge = 5 * 60 * 1000 } = options;

    // Abort any ongoing refresh
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check if we need to refresh based on cache age
    if (!forceRefresh && refreshState.lastRefresh) {
      const age = Date.now() - refreshState.lastRefresh.getTime();
      if (age < maxAge) {
        console.log('Data is fresh, skipping refresh');
        return;
      }
    }

    // Clear any pending refresh timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    setRefreshState(prev => ({
      ...prev,
      isRefreshing: true,
      error: null
    }));

    abortControllerRef.current = new AbortController();

    try {
      console.log('Refreshing data for account:', accountId);

      // Clear database cache for this account if force refresh
      if (forceRefresh) {
        await dataConsolidationService.clearAccountCache(accountId);
      }

      // Refresh consolidated data (now uses database cache internally)
      const consolidatedData = await dataConsolidationService.getConsolidatedAccountData(accountId);
      
      // Prepare AI context
      const aiContext = await aiDataPreparationService.prepareAIContext(accountId);

      console.log('Data refresh completed successfully');

      setRefreshState({
        isRefreshing: false,
        lastRefresh: new Date(),
        error: null
      });

      return { consolidatedData, aiContext };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Data refresh was aborted');
        return;
      }

      console.error('Error refreshing data:', error);
      setRefreshState({
        isRefreshing: false,
        lastRefresh: null,
        error: error.message || 'Failed to refresh data'
      });
      
      throw error;
    }
  }, [refreshState.lastRefresh]);

  /**
   * Schedule automatic refresh
   */
  const scheduleRefresh = useCallback((accountId: string, delay: number = 5 * 60 * 1000) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshData({ accountId, forceRefresh: false, maxAge: 0 });
    }, delay);
  }, [refreshData]);

  /**
   * Clear refresh timeout
   */
  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  /**
   * Force immediate refresh
   */
  const forceRefresh = useCallback((accountId: string) => {
    return refreshData({ accountId, forceRefresh: true });
  }, [refreshData]);

  /**
   * Check if data needs refresh
   */
  const needsRefresh = useCallback((maxAge: number = 5 * 60 * 1000): boolean => {
    if (!refreshState.lastRefresh) return true;
    
    const age = Date.now() - refreshState.lastRefresh.getTime();
    return age > maxAge;
  }, [refreshState.lastRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    refreshState,
    refreshData,
    scheduleRefresh,
    clearRefreshTimeout,
    forceRefresh,
    needsRefresh
  };
}