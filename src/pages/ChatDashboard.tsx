import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useMultiAccountContext } from '@/hooks/useAIContext';
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
    getContextSummary,
    prepareQueryContext,
    dataFreshness
  } = useMultiAccountContext();
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize chat based on account context
  useEffect(() => {
    if (accounts.length > 0 && isContextReady && contextData && naturalLanguage) {
      const currentAccount = accounts.find(acc => acc.id === selectedAccountId);
      if (currentAccount) {
        // Initialize with AI-powered welcome message using real data
        const welcomeMessage = generateWelcomeMessage(currentAccount, contextData, naturalLanguage);
        setChatMessages([welcomeMessage]);
      }
    } else if (accounts.length === 0 && !contextLoading) {
      // No accounts connected
      setChatMessages([{
        id: '1',
        content: `Hi ${user?.user_metadata?.full_name || 'there'}, I notice you haven't connected your Google Ads account yet.\n\nI'm Tara, your AI assistant for Google Ads optimization. I need access to your account data to provide personalized insights.\n\nHere's what I can do once connected:\n• Analyze campaign performance in real-time\n• Suggest budget optimizations\n• Identify high-performing keywords\n• Alert you to performance issues\n• Provide daily insights and recommendations\n\nWould you like to connect your Google Ads account now?`,
        sender: 'assistant',
        timestamp: new Date(),
        actions: [
          { label: 'Connect Google Ads', icon: Zap, action: 'connect-account' },
          { label: 'Learn More', icon: BookOpen, action: 'learn-more' },
          { label: 'Watch Demo', icon: PlayCircle, action: 'watch-demo' }
        ]
      }]);
    }
    setIsLoading(false);
  }, [accounts, isContextReady, contextData, naturalLanguage, selectedAccountId, contextLoading, user]);

  const generateWelcomeMessage = (account: any, contextData: any, naturalLanguage: any): ChatMessage => {
    const { account_summary, performance_snapshot } = contextData;
    const { executive_summary } = naturalLanguage;
    
    const dataStatusEmoji = dataFreshness === 'fresh' ? '🟢' : dataFreshness === 'stale' ? '🟡' : '🔴';
    const dataStatusText = dataFreshness === 'fresh' ? 'Fresh data' : dataFreshness === 'stale' ? 'Recent data' : 'Limited data';
    
    return {
      id: '1',
      content: `Hi ${user?.user_metadata?.full_name || 'there'}! I've analyzed your Google Ads account and here's what I found:\n\n${executive_summary}\n\n📊 **Account Status:**\n${dataStatusEmoji} ${dataStatusText}\n💰 Total spend: $${performance_snapshot.total_spend.toFixed(2)}\n🎯 ${performance_snapshot.total_conversions} conversions\n📈 ${performance_snapshot.performance_distribution.high_performing_campaigns} high-performing campaigns\n\nI'm ready to help optimize your campaigns! What would you like me to analyze?`,
      sender: 'assistant',
      timestamp: new Date(),
      actions: [
        { label: 'Performance Analysis', icon: BarChart3, action: 'performance-analysis' },
        { label: 'Budget Optimization', icon: DollarSign, action: 'budget-optimization' },
        { label: 'Keyword Insights', icon: Target, action: 'keyword-insights' },
        { label: 'Campaign Review', icon: TrendingUp, action: 'campaign-review' }
      ]
    };
  };

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);

    // Prepare context-aware response
    try {
      let responseContent = "I understand you're looking for help with your Google Ads campaigns.";
      
      if (isContextReady && selectedAccountId) {
        // Get query-specific context
        const queryContext = await prepareQueryContext(message, selectedAccountId);
        
        // Generate context-aware response (this would normally call your AI service)
        responseContent = generateContextAwareResponse(message, queryContext);
      } else {
        responseContent = "I'd love to help, but I need to analyze your account data first. Please make sure your Google Ads account is connected and try again.";
      }

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: responseContent,
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error generating response:', error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "I'm having trouble accessing your account data right now. Please try reconnecting your Google Ads account or try again in a moment.",
        sender: 'assistant',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorResponse]);
    }
  };

  const generateContextAwareResponse = (query: string, queryContext: any): string => {
    const queryLower = query.toLowerCase();
    
    if (!queryContext || !queryContext.general_context) {
      return "I'm still loading your account data. Please give me a moment to analyze your campaigns.";
    }

    const { general_context, natural_language, query_specific } = queryContext;
    
    // Budget-related queries
    if (queryLower.includes('budget') || queryLower.includes('spend')) {
      const totalSpend = general_context.performance_snapshot.total_spend;
      const budgetRecs = general_context.actionable_recommendations.filter((r: any) => r.type === 'budget');
      
      let response = `Based on your account analysis:\n\n💰 **Current Spend:** $${totalSpend.toFixed(2)}\n\n`;
      
      if (budgetRecs.length > 0) {
        response += `**Budget Optimization Opportunities:**\n`;
        budgetRecs.slice(0, 3).forEach((rec: any, idx: number) => {
          response += `${idx + 1}. ${rec.title} - ${rec.potential_impact}\n`;
        });
      } else {
        response += "Your budget allocation looks well-optimized based on current performance.";
      }
      
      return response;
    }
    
    // Performance queries
    if (queryLower.includes('performance') || queryLower.includes('how') && queryLower.includes('doing')) {
      const { performance_snapshot } = general_context;
      const trends = general_context.insights_summary.performance_trends;
      
      return `📊 **Performance Overview:**\n\n• **CTR:** ${(performance_snapshot.overall_ctr * 100).toFixed(2)}%\n• **CPC:** $${performance_snapshot.overall_cpc.toFixed(2)}\n• **Conversions:** ${performance_snapshot.total_conversions}\n• **Conversion Rate:** ${(performance_snapshot.conversion_rate * 100).toFixed(2)}%\n\n**Recent Trends:**\n${trends.slice(0, 3).join('\n')}\n\n${natural_language.performance_narrative}`;
    }
    
    // Campaign queries
    if (queryLower.includes('campaign')) {
      const topCampaigns = general_context.performance_snapshot.top_campaigns;
      const underperforming = general_context.insights_summary.main_concerns;
      
      let response = `📈 **Campaign Analysis:**\n\n**Top Performers:**\n`;
      topCampaigns.slice(0, 3).forEach((campaign: any, idx: number) => {
        response += `${idx + 1}. ${campaign.name} - $${campaign.spend.toFixed(2)} spend, ${campaign.conversions} conversions\n`;
      });
      
      if (underperforming.length > 0) {
        response += `\n⚠️ **Areas for Improvement:**\n${underperforming.join('\n')}`;
      }
      
      return response;
    }
    
    // Default response with insights
    return `${natural_language.executive_summary}\n\n**Key Insights:**\n${general_context.insights_summary.key_opportunities.slice(0, 3).join('\n')}\n\nWhat specific aspect would you like me to dive deeper into?`;
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
            {chatMessages.length === 0 || (chatMessages.length === 1 && accounts.length === 0) ? (
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