import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: any;
  actions?: QuickAction[];
  isStreaming?: boolean;
  error?: string;
}

export interface QuickAction {
  label: string;
  icon: any;
  action: string;
}

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
  google_ads_account_id?: string;
}

interface ChatManagerState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}

export function useChatManager(accountId?: string) {
  const { user } = useAuth();
  const [state, setState] = useState<ChatManagerState>({
    conversations: [],
    currentConversation: null,
    messages: [],
    isLoading: false,
    isStreaming: false,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load user's conversations
   */
  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('id, title, updated_at, message_count, google_ads_account_id')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        conversations: data || []
      }));
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation history",
        variant: "destructive"
      });
    }
  }, [user]);

  /**
   * Load messages for a specific conversation
   */
  const loadConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get conversation details
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .select('id, title, updated_at, message_count, google_ads_account_id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convError) throw convError;

      // Get conversation messages
      const { data: contextData, error: contextError } = await supabase
        .rpc('get_conversation_context', {
          conversation_uuid: conversationId,
          message_limit: 50
        });

      if (contextError) throw contextError;

      // Convert to ChatMessage format and reverse order
      const messages: ChatMessage[] = (contextData || [])
        .reverse()
        .map((msg: any) => ({
          id: msg.message_id,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.created_at),
          metadata: msg.metadata
        }));

      setState(prev => ({
        ...prev,
        currentConversation: conversation,
        messages,
        isLoading: false
      }));

    } catch (error) {
      console.error('Error loading conversation:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load conversation'
      }));
    }
  }, [user]);

  /**
   * Start a new conversation
   */
  const startNewConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentConversation: null,
      messages: [],
      error: null
    }));
  }, []);

  /**
   * Send a message and get AI response
   */
  const sendMessage = useCallback(async (message: string): Promise<void> => {
    if (!user || !message.trim()) return;

    // Abort any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: message.trim(),
      role: 'user',
      timestamp: new Date()
    };

    // Add user message to UI immediately
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isStreaming: true,
      error: null
    }));

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Call AI chat function using direct fetch to ensure proper JSON body
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Missing auth session');
      }

      const projectRef = 'ijocgytumkinjhmgferk';
      const url = `https://${projectRef}.functions.supabase.co/functions/v1/ai-chat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message.trim(),
          conversation_id: state.currentConversation?.id,
          account_id: accountId,
          // Use non-streaming for reliability with fetch/JSON handling
          stream: false
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI chat failed: ${response.status} ${errText}`);
      }

      const data = await response.json();

      // Non-streaming response
      if (data.message) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          content: data.message,
          role: 'assistant',
          timestamp: new Date(),
          metadata: data.usage ? { usage: data.usage } : undefined
        };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isStreaming: false,
          currentConversation: prev.currentConversation || {
            id: data.conversation_id,
            title: message.length > 50 ? message.substring(0, 47) + '...' : message,
            updated_at: new Date().toISOString(),
            message_count: 2
          }
        }));

        // Reload conversations to update list
        loadConversations();
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        content: "I'm sorry, I encountered an error while processing your message. Please try again.",
        role: 'assistant',
        timestamp: new Date(),
        error: error.message
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        isStreaming: false,
        error: error.message
      }));

      toast({
        title: "Chat Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
    }
  }, [user, state.currentConversation, accountId, loadConversations]);

  /**
   * Handle streaming response from AI
   */
  const handleStreamingResponse = useCallback(async (stream: ReadableStream) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    
    let assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: true
    };

    // Add empty assistant message to start streaming
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, assistantMessage]
    }));

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Mark streaming as complete
          setState(prev => ({
            ...prev,
            messages: prev.messages.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, isStreaming: false }
                : msg
            ),
            isStreaming: false
          }));
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content' && data.content) {
                // Update assistant message content
                assistantMessage.content += data.content;
                
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: assistantMessage.content }
                      : msg
                  ),
                  currentConversation: prev.currentConversation || {
                    id: data.conversation_id,
                    title: prev.messages[prev.messages.length - 2]?.content.substring(0, 47) + '...' || 'New Conversation',
                    updated_at: new Date().toISOString(),
                    message_count: prev.messages.length + 1
                  }
                }));
              }
            } catch (e) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }

      // Reload conversations after streaming is complete
      loadConversations();

    } catch (error) {
      console.error('Error handling streaming response:', error);
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: 'Streaming error occurred'
      }));
    }
  }, [loadConversations]);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update state
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== conversationId),
        currentConversation: prev.currentConversation?.id === conversationId ? null : prev.currentConversation,
        messages: prev.currentConversation?.id === conversationId ? [] : prev.messages
      }));

      toast({
        title: "Conversation deleted",
        description: "The conversation has been permanently deleted."
      });

    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  }, [user]);

  /**
   * Archive a conversation
   */
  const archiveConversation = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ is_archived: true })
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update state
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== conversationId),
        currentConversation: prev.currentConversation?.id === conversationId ? null : prev.currentConversation,
        messages: prev.currentConversation?.id === conversationId ? [] : prev.messages
      }));

      toast({
        title: "Conversation archived",
        description: "The conversation has been archived."
      });

    } catch (error) {
      console.error('Error archiving conversation:', error);
      toast({
        title: "Error",
        description: "Failed to archive conversation",
        variant: "destructive"
      });
    }
  }, [user]);

  /**
   * Stop current streaming
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isStreaming: false,
      messages: prev.messages.map(msg => ({ ...msg, isStreaming: false }))
    }));
  }, []);

  return {
    // State
    conversations: state.conversations,
    currentConversation: state.currentConversation,
    messages: state.messages,
    isLoading: state.isLoading,
    isStreaming: state.isStreaming,
    error: state.error,

    // Actions
    loadConversations,
    loadConversation,
    startNewConversation,
    sendMessage,
    deleteConversation,
    archiveConversation,
    stopStreaming
  };
}