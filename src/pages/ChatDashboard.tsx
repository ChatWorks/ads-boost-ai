import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useMultiAccountContext } from '@/hooks/useAIContext';
import { useChatManager } from '@/hooks/useChatManager';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageCircle, 
  Send, 
  TrendingUp, 
  DollarSign, 
  Target, 
  BarChart3,
  Zap,
  Plus,
  Search,
  BookOpen,
  PlayCircle
} from 'lucide-react';
import ChatMessage from '@/components/Chat/ChatMessage';
import ChatInput from '@/components/Chat/ChatInput';
import RecentChats from '@/components/Chat/RecentChats';

interface GoogleAdsAccount {
  id: string;
  customer_id: string;
  account_name: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  actions?: QuickAction[];
}

interface QuickAction {
  label: string;
  icon: any;
  action: string;
}

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

  const [isLoading, setIsLoading] = useState(true);

  // Load conversations when component mounts
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Initialize chat based on account context
  useEffect(() => {
    if (accounts.length === 0 && !contextLoading) {
      setIsLoading(false);
    } else if (accounts.length > 0 && isContextReady) {
      setIsLoading(false);
    }
  }, [accounts, isContextReady, contextLoading]);

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };


  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'connect-account':
        window.location.href = '/integrations';
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
      case 'new-chat':
        startNewConversation();
        break;
      default:
        console.log('Quick action:', action);
    }
  };

  const quickActionButtons = isContextReady ? [
    { label: 'Performance Analysis', icon: BarChart3, action: 'performance-analysis' },
    { label: 'Budget Optimization', icon: DollarSign, action: 'budget-optimization' },
    { label: 'Keyword Insights', icon: Target, action: 'keyword-insights' },
    { label: 'Campaign Review', icon: TrendingUp, action: 'campaign-review' }
  ] : [
    { label: 'Connect Google Ads', icon: Zap, action: 'connect-account' },
    { label: 'Learn More', icon: BookOpen, action: 'learn-more' },
    { label: 'Watch Demo', icon: PlayCircle, action: 'watch-demo' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mb-4 mx-auto">
            <span className="text-primary-foreground font-bold text-sm">I</span>
          </div>
          <p className="text-muted-foreground">Loading Innogo Chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Left Sidebar - Recent Chats */}
      <div className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-background font-bold text-xs">I</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">Innogo</span>
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
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sidebar-foreground/50 text-sm">No chat history!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div 
                  key={conversation.id}
                  className="p-2 rounded text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent cursor-pointer"
                  onClick={() => loadConversation && loadConversation(conversation.id)}
                >
                  <div className="truncate">{conversation.title}</div>
                  <div className="text-xs text-sidebar-foreground/50">
                    {conversation.message_count} messages
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
              Ask Tara
            </h1>
            <p className="text-muted-foreground text-center text-sm">
              Your AI Data & E-commerce Agent
            </p>
            {accounts.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                {accounts.length > 1 && (
                  <select 
                    value={selectedAccountId || ''} 
                    onChange={(e) => switchAccount(e.target.value)}
                    className="text-xs bg-background border border-border rounded px-2 py-1"
                  >
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} ({account.customer_id})
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <Badge variant={isContextReady ? "default" : "secondary"} className="text-xs">
                    {isContextReady ? `✓ ${dataFreshness} data` : '⏳ Loading data'}
                  </Badge>
                  {contextError && (
                    <Badge variant="destructive" className="text-xs">
                      ⚠️ Connection issue
                    </Badge>
                  )}
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
                          <div className="animate-pulse">Tara is typing...</div>
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
              placeholder="Ask Tara a question..."
              disabled={isStreaming}
            />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Tara can make mistakes
            </p>
            <div className="flex justify-center mt-3 text-xs text-muted-foreground">
              <span>Need help setting up your prompt? </span>
              <button className="text-primary hover:underline ml-1">Click here✨</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}