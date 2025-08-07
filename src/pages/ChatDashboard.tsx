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
    <div className="h-screen flex bg-muted/30">
      {/* Left Sidebar - Recent Chats */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* New Chat Button */}
        <div className="p-4 border-b border-border">
          <Button variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Recent Chats */}
        <RecentChats />

        {/* Trial Info & User */}
        <div className="mt-auto p-4 border-t border-border">
          <div className="bg-muted rounded-lg p-3 mb-3">
            <p className="text-sm font-medium">Trial ends in 10 days</p>
            <p className="text-xs text-muted-foreground">Upgrade to continue using Innogo</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-medium text-sm">
                {user?.user_metadata?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.user_metadata?.full_name || 'User'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">
                Hi {user?.user_metadata?.full_name || 'there'},
              </h1>
              <p className="text-muted-foreground">
                What can I help you with?
              </p>
            </div>
            {selectedAccount && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {selectedAccount.account_name}
              </Badge>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {chatMessages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              onQuickAction={handleQuickAction}
            />
          ))}
        </div>

        {/* Quick Action Buttons */}
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {quickActionButtons.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.action)}
                className="text-xs"
              >
                <action.icon className="mr-1 h-3 w-3" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-6 border-t border-border bg-card">
          <ChatInput 
            onSendMessage={handleSendMessage}
            placeholder={isConnected ? "Ask Innogo about your campaigns..." : "Ask me anything about Google Ads..."}
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Innogo can make mistakes
          </p>
        </div>
      </div>
    </div>
  );
}