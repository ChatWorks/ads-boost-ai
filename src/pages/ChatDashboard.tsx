import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useMultiAccountContext } from '@/hooks/useAIContext';
import { useChatManager } from '@/hooks/useChatManager';
import { useDataRefresh } from '@/hooks/useDataRefresh';
import { ChatErrorBoundary } from '@/components/Chat/ChatErrorBoundary';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  BarChart3,
  Zap,
  Plus,
  BookOpen,
  PlayCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import ChatMessage from '@/components/Chat/ChatMessage';
import ChatInput from '@/components/Chat/ChatInput';

// interface QuickAction {
//   label: string;
//   icon: any;
//   action: string;
// }

export default function ChatDashboard() {
  const { user } = useAuth();
  const { 
    accounts, 
    selectedAccountId, 
    switchAccount,
    contextData,
    naturalLanguage,
    isLoading: contextLoading,
    error: contextError,
    isContextReady,
    dataFreshness
  } = useMultiAccountContext();
  
  const {
    conversations,
    currentConversation,
    messages,
    isLoading: chatLoading,
    isStreaming,
    sendMessage,
    loadConversations,
    loadConversation,
    startNewConversation,
    deleteConversation
  } = useChatManager(selectedAccountId || undefined);

  const { 
    refreshState, 
    forceRefresh, 
    scheduleRefresh, 
    needsRefresh 
  } = useDataRefresh();

  const [isLoading, setIsLoading] = useState(true);

  // Load conversations when component mounts
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Smart loading logic with better state management
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (contextLoading) {
      // Show loading for at least 500ms to prevent flashing
      timeoutId = setTimeout(() => {
        if (!contextLoading) setIsLoading(false);
      }, 500);
    } else {
      // Context loaded, determine if we're ready
      if (accounts.length === 0) {
        // No accounts - ready to show connect state
        setIsLoading(false);
      } else if (accounts.length > 0) {
        // Have accounts - check if context is ready or if we should show with limited data
        setIsLoading(false);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [accounts, isContextReady, contextLoading, contextError]);

  const handleSendMessage = async (message: string) => {
    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Error handling is done in useChatManager
    }
  };


  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'connect-account':
        window.location.href = '/integrations';
        break;
      case 'retry-connection':
        // Trigger a refresh of the account context
        if (selectedAccountId) {
          try {
            await forceRefresh(selectedAccountId);
            if (switchAccount) {
              switchAccount(selectedAccountId);
            }
          } catch (error) {
            console.error('Failed to refresh data:', error);
          }
        }
        break;
      case 'performance-analysis':
        handleSendMessage('Show me a detailed performance analysis of my campaigns');
        break;
      case 'budget-optimization':
        handleSendMessage('Analyze my budget allocation and suggest optimizations');
        break;
      case 'keyword-insights':
        handleSendMessage('What keyword opportunities do you see in my account?');
        break;
      case 'campaign-review':
        handleSendMessage('Review my campaigns and identify improvement opportunities');
        break;
      case 'general-help':
        handleSendMessage('What are some general Google Ads best practices I should know?');
        break;
      case 'best-practices':
        handleSendMessage('What are the most important Google Ads optimization strategies?');
        break;
      case 'new-chat':
        startNewConversation();
        break;
      case 'learn-more':
        window.open('https://support.google.com/google-ads', '_blank');
        break;
      case 'watch-demo':
        // Could link to a demo video or tutorial
        handleSendMessage('Can you walk me through how to use this AI assistant?');
        break;
      default:
        console.log('Quick action:', action);
    }
  };

  // Dynamic action buttons based on context state
  const quickActionButtons = (() => {
    if (accounts.length === 0) {
      return [
        { label: 'Connect Google Ads', icon: Zap, action: 'connect-account' },
        { label: 'Learn More', icon: BookOpen, action: 'learn-more' },
        { label: 'Watch Demo', icon: PlayCircle, action: 'watch-demo' }
      ];
    }
    
    if (contextError) {
      return [
        { label: 'Retry Connection', icon: AlertCircle, action: 'retry-connection' },
        { label: 'Check Integrations', icon: Zap, action: 'connect-account' }
      ];
    }
    
    if (isContextReady) {
      return [
        { label: 'Performance Analysis', icon: BarChart3, action: 'performance-analysis' },
        { label: 'Budget Optimization', icon: DollarSign, action: 'budget-optimization' },
        { label: 'Keyword Insights', icon: Target, action: 'keyword-insights' },
        { label: 'Campaign Review', icon: TrendingUp, action: 'campaign-review' }
      ];
    }
    
    // Loading state or limited data
    return [
      { label: 'General Questions', icon: BookOpen, action: 'general-help' },
      { label: 'Best Practices', icon: Target, action: 'best-practices' }
    ];
  })();

  // Enhanced loading state
  if (isLoading || (contextLoading && accounts.length === 0)) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4 mx-auto">
            <Loader2 className="h-6 w-6 text-primary-foreground animate-spin" />
          </div>
          <p className="text-muted-foreground">Initializing Joost Chat...</p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            {contextLoading ? 'Loading account data...' : 'Setting up interface...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChatErrorBoundary>
    <div className="h-full flex bg-background">
      {/* Left Sidebar - Recent Chats */}
      <div className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-background font-bold text-xs">T</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">Joost AI</span>
          </div>
          <Button 
            variant="default" 
            className="w-full justify-start bg-foreground text-background hover:bg-foreground/90 border-0"
            onClick={() => handleQuickAction('new-chat')}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Recent Chats Section */}
        <div className="flex-1 p-4">
          <div className="text-xs text-sidebar-foreground/60 mb-3 uppercase tracking-wide">Recent Chats</div>
          {chatLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2 text-sidebar-foreground/50" />
              <p className="text-sidebar-foreground/50 text-xs">Loading chats...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sidebar-foreground/50 text-sm">No chat history yet!</p>
              <p className="text-sidebar-foreground/40 text-xs mt-1">Start a conversation to see it here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div 
                  key={conversation.id}
                  className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                    currentConversation?.id === conversation.id 
                      ? 'bg-sidebar-accent text-sidebar-foreground' 
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50'
                  }`}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <div className="truncate font-medium">{conversation.title}</div>
                  <div className="text-xs text-sidebar-foreground/50 flex items-center gap-1">
                    <span>{conversation.message_count} messages</span>
                    {conversation.google_ads_account_id && (
                      <Badge variant="outline" className="text-xs px-1 py-0">Data</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom User Section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sidebar-foreground/10 rounded-full flex items-center justify-center">
              <span className="text-sidebar-foreground font-medium text-sm">
                {user?.user_metadata?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.user_metadata?.full_name || 'User'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Clean Header */}
        <div className="p-6 border-b border-border bg-background">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-medium text-center mb-2">
              Ask Joost
            </h1>
            <p className="text-muted-foreground text-center text-sm">
              Your AI Google Ads Assistant
            </p>
            
            {/* Enhanced status section */}
            {accounts.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                {accounts.length > 1 && (
                  <select 
                    value={selectedAccountId || ''} 
                    onChange={(e) => switchAccount(e.target.value)}
                    className="text-xs bg-background border border-border rounded px-3 py-1.5 max-w-48"
                  >
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.account_name}
                      </option>
                    ))}
                  </select>
                )}
                
                <div className="flex gap-4 items-center">
                  {/* Mini-debug info */}
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const acc = accounts.find(a => a.id === selectedAccountId);
                      return (
                        <span>
                          User: {user?.id?.slice(0,8)}… · Account: {acc ? `${acc.account_name} (${acc.customer_id})` : '—'}
                        </span>
                      );
                    })()}
                  </div>

                  {(contextLoading || refreshState.isRefreshing) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{refreshState.isRefreshing ? 'Refreshing...' : 'Loading...'}</span>
                    </div>
                  )}
                  
                  <Badge 
                    variant={isContextReady ? "default" : contextError || refreshState.error ? "destructive" : "secondary"} 
                    className="text-xs"
                  >
                    {contextError || refreshState.error ? '⚠️ Error' : isContextReady ? `✓ ${dataFreshness}` : '⏳ Loading'}
                  </Badge>
                  
                  {(contextError || refreshState.error) && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleQuickAction('retry-connection')}
                      className="text-xs h-6 px-2"
                      disabled={refreshState.isRefreshing}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${refreshState.isRefreshing ? 'animate-spin' : ''}`} />
                      Retry
                    </Button>
                  )}
                  
                  {isContextReady && needsRefresh() && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleQuickAction('retry-connection')}
                      className="text-xs h-6 px-2 text-amber-600 hover:text-amber-700"
                      disabled={refreshState.isRefreshing}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {/* Connection warning */}
            {accounts.length === 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  <span>Connect your Google Ads account for personalized insights</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {messages.length === 0 && accounts.length === 0 && !isContextReady ? (
              /* Empty/Initial State */
              <div className="text-center py-16">
                <h2 className="text-4xl font-normal mb-4 text-foreground">
                  What can I help you with?
                </h2>
                <p className="text-muted-foreground mb-8">
                  Connect your Google Ads account to get personalized insights and recommendations.
                </p>
                <Button onClick={() => handleQuickAction('connect-account')} className="bg-foreground text-background hover:bg-foreground/90">
                  <Zap className="mr-2 h-4 w-4" />
                  Connect Google Ads
                </Button>
              </div>
            ) : messages.length === 0 && isContextReady ? (
              /* Welcome state with account connected */
              <div className="text-center py-16">
                <h2 className="text-4xl font-normal mb-4 text-foreground">
                  Hi {user?.user_metadata?.full_name || 'there'}! 👋
                </h2>
                <p className="text-muted-foreground mb-8">
                  I've analyzed your Google Ads account. What would you like me to help you with?
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {quickActionButtons.slice(0, 4).map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleQuickAction(action.action)}
                    >
                      <action.icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              /* Chat Messages */
              <div className="space-y-6">
                {messages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={{
                      id: message.id,
                      content: message.content,
                      sender: message.role === 'user' ? 'user' : 'assistant',
                      timestamp: message.timestamp,
                      actions: message.actions
                    }} 
                    onQuickAction={handleQuickAction}
                  />
                ))}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="max-w-2xl mr-16">
                      <div className="rounded-2xl px-4 py-3 text-sm bg-muted text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="animate-pulse">Joost is typing...</div>
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-background">
          <div className="max-w-3xl mx-auto p-6">
            <ChatInput 
              onSendMessage={handleSendMessage}
              placeholder="Ask Joost a question..."
              disabled={isStreaming}
            />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Joost can make mistakes
            </p>
            <div className="flex justify-center mt-3 text-xs text-muted-foreground">
              <span>Need help setting up your prompt? </span>
              <button className="text-primary hover:underline ml-1">Click here✨</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ChatErrorBoundary>
  );
}