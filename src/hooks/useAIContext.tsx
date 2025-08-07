import { useState, useEffect, useCallback } from 'react';
import { aiDataPreparationService, AIContextData, NaturalLanguageContext } from '@/services/aiDataPreparation';
import { dataConsolidationService, DataFilters } from '@/services/dataConsolidation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AIContextState {
  contextData: AIContextData | null;
  naturalLanguage: NaturalLanguageContext | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  dataFreshness: 'fresh' | 'stale' | 'unavailable';
}

interface AIContextHookReturn extends AIContextState {
  refreshContext: (accountId?: string, filters?: DataFilters) => Promise<void>;
  prepareQueryContext: (query: string, accountId?: string) => Promise<any>;
  clearContext: () => void;
  getContextSummary: () => string;
  isContextReady: boolean;
}

export function useAIContext(defaultAccountId?: string): AIContextHookReturn {
  const { user } = useAuth();
  const [state, setState] = useState<AIContextState>({
    contextData: null,
    naturalLanguage: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
    dataFreshness: 'unavailable'
  });

  const [currentAccountId, setCurrentAccountId] = useState<string | null>(defaultAccountId || null);

  // Auto-load context when account is available
  useEffect(() => {
    if (currentAccountId && user && !state.contextData && !state.isLoading) {
      refreshContext(currentAccountId);
    }
  }, [currentAccountId, user]);

  // Auto-refresh stale data
  useEffect(() => {
    if (state.lastUpdated && state.dataFreshness === 'stale') {
      const refreshTimer = setTimeout(() => {
        if (currentAccountId) {
          refreshContext(currentAccountId);
        }
      }, 5000); // 5 second delay for stale data refresh

      return () => clearTimeout(refreshTimer);
    }
  }, [state.dataFreshness, currentAccountId]);

  /**
   * Refresh AI context data
   */
  const refreshContext = useCallback(async (
    accountId?: string, 
    filters: DataFilters = {}
  ): Promise<void> => {
    const targetAccountId = accountId || currentAccountId;
    
    if (!targetAccountId || !user) {
      setState(prev => ({ 
        ...prev, 
        error: 'No account selected or user not authenticated',
        dataFreshness: 'unavailable'
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First, check if we have access to this account
      const { data: accountData, error: accountError } = await supabase
        .from('google_ads_accounts')
        .select('id, account_name, connection_status, last_successful_fetch')
        .eq('id', targetAccountId)
        .eq('user_id', user.id)
        .single();

      if (accountError || !accountData) {
        throw new Error('Account not found or access denied');
      }

      // Check account connection status
      if (accountData.connection_status !== 'CONNECTED') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `Account "${accountData.account_name}" is not properly connected. Please reconnect your Google Ads account.`,
          dataFreshness: 'unavailable'
        }));
        return;
      }

      // Prepare AI context with enhanced error handling
      const contextResult = await aiDataPreparationService.prepareAIContext(
        targetAccountId, 
        filters
      );

      // Determine data freshness
      const dataFreshness = calculateDataFreshness(accountData.last_successful_fetch);

      setState({
        contextData: contextResult.structured_data,
        naturalLanguage: contextResult.natural_language,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        dataFreshness
      });

      // Update current account if different
      if (targetAccountId !== currentAccountId) {
        setCurrentAccountId(targetAccountId);
      }

    } catch (error: any) {
      console.error('Error refreshing AI context:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load account data',
        dataFreshness: 'unavailable'
      }));
    }
  }, [currentAccountId, user]);

  /**
   * Prepare query-specific context data
   */
  const prepareQueryContext = useCallback(async (
    query: string, 
    accountId?: string
  ): Promise<any> => {
    const targetAccountId = accountId || currentAccountId;
    
    if (!targetAccountId || !user) {
      throw new Error('No account selected or user not authenticated');
    }

    try {
      // Get fresh context with query-specific data
      const contextResult = await aiDataPreparationService.prepareAIContext(
        targetAccountId, 
        {},
        query
      );

      return {
        general_context: state.contextData,
        natural_language: state.naturalLanguage,
        query_specific: contextResult.query_specific_data,
        user_query: query,
        account_id: targetAccountId
      };
    } catch (error: any) {
      console.error('Error preparing query context:', error);
      throw error;
    }
  }, [currentAccountId, user, state.contextData, state.naturalLanguage]);

  /**
   * Clear context data
   */
  const clearContext = useCallback(() => {
    setState({
      contextData: null,
      naturalLanguage: null,
      isLoading: false,
      error: null,
      lastUpdated: null,
      dataFreshness: 'unavailable'
    });
    dataConsolidationService.clearCache();
  }, []);

  /**
   * Get a summary of the current context for AI
   */
  const getContextSummary = useCallback((): string => {
    if (!state.contextData || !state.naturalLanguage) {
      return 'No account data available. Please connect your Google Ads account to get started.';
    }

    const { account_summary, performance_snapshot } = state.contextData;
    const { executive_summary, performance_narrative } = state.naturalLanguage;

    return `
ACCOUNT CONTEXT:
${executive_summary}

CURRENT PERFORMANCE:
${performance_narrative}

DATA STATUS: ${state.dataFreshness} (last updated: ${state.lastUpdated?.toLocaleString()})

AVAILABLE ACTIONS: Campaign analysis, budget optimization, keyword research, performance forecasting
    `.trim();
  }, [state.contextData, state.naturalLanguage, state.dataFreshness, state.lastUpdated]);

  // Derived state
  const isContextReady = !!(
    state.contextData && 
    state.naturalLanguage && 
    !state.isLoading && 
    !state.error &&
    state.dataFreshness !== 'unavailable'
  );

  return {
    ...state,
    refreshContext,
    prepareQueryContext,
    clearContext,
    getContextSummary,
    isContextReady
  };
}

/**
 * Helper function to calculate data freshness
 */
function calculateDataFreshness(lastFetch: string | null): 'fresh' | 'stale' | 'unavailable' {
  if (!lastFetch) return 'unavailable';
  
  const now = new Date();
  const fetchDate = new Date(lastFetch);
  const hoursDiff = (now.getTime() - fetchDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff < 2) return 'fresh'; // Fresh if updated within 2 hours
  if (hoursDiff < 24) return 'stale'; // Stale if updated within 24 hours
  return 'unavailable'; // Unavailable if older than 24 hours
}

/**
 * Hook for accessing multiple accounts context
 */
export function useMultiAccountContext() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const aiContext = useAIContext(selectedAccountId || undefined);

  useEffect(() => {
    if (user) {
      loadUserAccounts();
    }
  }, [user]);

  const loadUserAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('id, account_name, customer_id, connection_status, last_successful_fetch')
        .eq('user_id', user?.id)
        .eq('connection_status', 'CONNECTED')
        .order('account_name');

      if (error) throw error;

      setAccounts(data || []);
      
      // Auto-select first account if none selected
      if (data && data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading user accounts:', error);
    }
  };

  const switchAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    aiContext.clearContext();
  }, [aiContext]);

  return {
    ...aiContext,
    accounts,
    selectedAccountId,
    switchAccount,
    reloadAccounts: loadUserAccounts
  };
}