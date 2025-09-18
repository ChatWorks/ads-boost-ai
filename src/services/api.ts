import { supabase } from '@/integrations/supabase/client';

// API base URL - automatically detects environment
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-app.vercel.app/api'
  : 'http://localhost:3000/api';

// Helper function to get auth headers
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No active session');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

// Google Ads API Service
export const googleAdsService = {
  // Connect Google Ads account
  async connect(returnUrl?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/google-ads/connect`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ returnUrl })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initiate Google Ads connection');
    }
    
    return response.json();
  },

  // Get campaigns
  async getCampaigns(accountId: string, filters?: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/google-ads/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId, filters })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch campaigns');
    }
    
    return response.json();
  },

  // Get ad groups
  async getAdGroups(accountId: string, filters?: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/google-ads/adgroups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId, filters })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch ad groups');
    }
    
    return response.json();
  },

  // Get keywords
  async getKeywords(accountId: string, filters?: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/google-ads/keywords`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId, filters })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch keywords');
    }
    
    return response.json();
  },

  // Get account context
  async getAccountContext(accountId: string, userQuery?: string, filters?: any) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/google-ads/account-context`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        account_id: accountId, 
        user_query: userQuery, 
        filters 
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch account context');
    }
    
    return response.json();
  }
};

// AI Chat Service
export const aiChatService = {
  // Send message to AI chat
  async sendMessage(message: string, conversationId?: string, accountId?: string, stream = false) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/ai-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        account_id: accountId,
        stream
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }
    
    if (stream) {
      // Handle streaming response
      return response.body?.getReader();
    } else {
      return response.json();
    }
  }
};

// Insights Service (if needed)
export const insightsService = {
  // Send test insights email
  async sendTestEmail(accountId: string, metrics: string[], frequency: string, title: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/insights/send-test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        accountId,
        metrics,
        frequency,
        title
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send test email');
    }
    
    return response.json();
  }
};

// Utility function to check if we're in development
export const isDevelopment = process.env.NODE_ENV === 'development';

// Utility function to get the correct API base URL
export const getApiBaseUrl = () => API_BASE;
