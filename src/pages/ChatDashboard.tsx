import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
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
  const [connectedAccounts, setConnectedAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<GoogleAdsAccount | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load connected accounts on mount
  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('google_ads_accounts')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      setConnectedAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccount(data[0]);
        setIsConnected(true);
        // Initialize with connected state message
        setChatMessages([{
          id: '1',
          content: `Hi ${user?.user_metadata?.full_name || 'there'}! I've analyzed your Google Ads account '${data[0].account_name} (${data[0].customer_id})'.\n\nHere's your current status:\n✅ Account connected\n📊 Ready for analysis\n🎯 AI insights available\n\nWhat would you like me to help you with today?`,
          sender: 'assistant',
          timestamp: new Date(),
          actions: [
            { label: 'Campaign Analysis', icon: BarChart3, action: 'campaign-analysis' },
            { label: 'Budget Review', icon: DollarSign, action: 'budget-review' },
            { label: 'Optimization Tips', icon: Target, action: 'optimization-tips' }
          ]
        }]);
      } else {
        setIsConnected(false);
        // Initialize with not connected state message
        setChatMessages([{
          id: '1',
          content: `Hi ${user?.user_metadata?.full_name || 'there'}, I notice you haven't connected your Google Ads account yet.\n\nI'm your AI assistant for Google Ads optimization, but I need access to your account data to help you.\n\nHere's what I can do once connected:\n• Analyze campaign performance in real-time\n• Suggest budget optimizations\n• Identify high-performing keywords\n• Alert you to performance issues\n• Provide daily insights and recommendations\n\nWould you like to connect your Google Ads account now?`,
          sender: 'assistant',
          timestamp: new Date(),
          actions: [
            { label: 'Connect Google Ads', icon: Zap, action: 'connect-account' },
            { label: 'Learn More', icon: BookOpen, action: 'learn-more' },
            { label: 'Watch Demo', icon: PlayCircle, action: 'watch-demo' }
          ]
        }]);
      }
    } catch (error) {
      console.error('Error loading connected accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);

    // Simulate AI response (in real implementation, this would call an AI service)
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "I understand you're looking for help with your Google Ads campaigns. Let me analyze that for you and provide some insights.",
        sender: 'assistant',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'connect-account':
        window.location.href = '/integrations';
        break;
      case 'campaign-analysis':
        handleSendMessage('Show me my campaign performance analysis');
        break;
      case 'budget-review':
        handleSendMessage('Review my current budget allocation');
        break;
      case 'optimization-tips':
        handleSendMessage('What optimization opportunities do you see?');
        break;
      default:
        console.log('Quick action:', action);
    }
  };

  const quickActionButtons = isConnected ? [
    { label: 'Deep Insights', icon: Search, action: 'deep-insights' },
    { label: 'Performance Summary', icon: BarChart3, action: 'performance-summary' },
    { label: 'Budget Analysis', icon: DollarSign, action: 'budget-analysis' },
    { label: 'Keyword Optimization', icon: Target, action: 'keyword-optimization' },
    { label: 'Trend Analysis', icon: TrendingUp, action: 'trend-analysis' }
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
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Recent Chats Section */}
        <div className="flex-1 p-4">
          <div className="text-xs text-sidebar-foreground/60 mb-3 uppercase tracking-wide">Recent Chats</div>
          {/* Show recent chats or empty state */}
          {chatMessages.length <= 1 ? (
            <div className="text-center py-8">
              <p className="text-sidebar-foreground/50 text-sm">No chat history!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Recent chat items would go here */}
              <div className="p-2 rounded text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent cursor-pointer">
                How to optimize my campaigns?
              </div>
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
            {selectedAccount && (
              <div className="flex justify-end mt-4">
                <Badge variant="secondary" className="text-xs">
                  Connected integrations
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {chatMessages.length === 0 || (chatMessages.length === 1 && !isConnected) ? (
              /* Empty/Initial State */
              <div className="text-center py-16">
                <h2 className="text-4xl font-normal mb-4 text-foreground">
                  What can I help you with?
                </h2>
              </div>
            ) : (
              /* Chat Messages */
              <div className="space-y-6">
                {chatMessages.map((message) => (
                  <ChatMessage 
                    key={message.id} 
                    message={message} 
                    onQuickAction={handleQuickAction}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-background">
          <div className="max-w-3xl mx-auto p-6">
            {/* Quick Action Buttons */}
            {quickActionButtons.length > 0 && chatMessages.length <= 1 && (
              <div className="mb-4">
                <div className="flex gap-2 justify-center">
                  {quickActionButtons.slice(0, 1).map((action, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAction(action.action)}
                      className="bg-foreground text-background hover:bg-foreground/90 border-0"
                    >
                      <action.icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <ChatInput 
              onSendMessage={handleSendMessage}
              placeholder="Ask Tara a question..."
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