import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  context_data?: any;
}

interface ChatRequest {
  message: string;
  conversation_id?: string;
  account_id?: string;
  stream?: boolean;
}

interface AccountContext {
  account_summary: any;
  performance_snapshot: any;
  insights_summary: any;
  actionable_recommendations: any[];
  natural_language: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // Parse request
    const { message, conversation_id, account_id, stream = true }: ChatRequest = await req.json();
    
    if (!message?.trim()) {
      throw new Error('Message is required');
    }

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    console.log('Processing chat request for user:', user.id);

    // Get or create conversation
    let currentConversationId = conversation_id;
    if (!currentConversationId) {
      const { data: newConv, error: convError } = await supabaseAdmin
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          google_ads_account_id: account_id,
          title: message.length > 50 ? message.substring(0, 47) + '...' : message
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw new Error('Failed to create conversation');
      }
      currentConversationId = newConv.id;
    }

    // Save user message to database
    const { error: userMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: currentConversationId,
        user_id: user.id,
        role: 'user',
        content: message,
        metadata: { account_id },
      });

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError);
      throw new Error('Failed to save message');
    }

    // Get conversation history for context
    const { data: conversationHistory, error: historyError } = await supabaseAdmin
      .rpc('get_conversation_context', {
        conversation_uuid: currentConversationId,
        message_limit: 10
      });

    if (historyError) {
      console.error('Error fetching conversation history:', historyError);
    }

    // Get account context if account_id provided
    let accountContext: AccountContext | null = null;
    if (account_id) {
      try {
        // Create a user-scoped client so RLS and auth apply inside the invoked function
        const supabaseUser = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: contextData, error: contextError } = await supabaseUser.functions.invoke(
          'get-account-context',
          { body: { account_id, user_query: message } }
        );

        if (contextError) {
          console.warn('get-account-context error:', contextError);
        } else if (contextData) {
          accountContext = contextData as AccountContext;
        }
      } catch (error) {
        console.warn('Could not fetch account context:', error);
      }
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(user, accountContext);
    
    // Build conversation messages for OpenAI
    const messages = buildConversationMessages(systemPrompt, conversationHistory || [], message, accountContext);

    console.log('Sending request to OpenAI with', messages.length, 'messages');

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Using the most capable model
        messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream,
        response_format: { type: "text" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    if (stream) {
      // Handle streaming response
      return handleStreamingResponse(openaiResponse, currentConversationId, user.id, accountContext);
    } else {
      // Handle non-streaming response
      const responseData = await openaiResponse.json();
      const assistantMessage = responseData.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

      // Save assistant response to database
      await saveAssistantMessage(currentConversationId, user.id, assistantMessage, responseData.usage, accountContext);

      return new Response(JSON.stringify({
        message: assistantMessage,
        conversation_id: currentConversationId,
        usage: responseData.usage
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      type: 'ai_chat_error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildSystemPrompt(user: any, accountContext: AccountContext | null): string {
  const userName = user.user_metadata?.full_name || 'there';
  
  let systemPrompt = `You are Tara, an AI assistant specialized in Google Ads optimization and digital marketing analytics. You're helping ${userName} with their Google Ads campaigns.

PERSONALITY & TONE:
- Professional yet friendly and approachable
- Data-driven and analytical
- Proactive in offering actionable insights
- Clear and concise in explanations
- Always focus on practical, implementable recommendations

CORE CAPABILITIES:
- Google Ads campaign analysis and optimization
- Budget allocation recommendations
- Keyword research and bid management
- Performance trend analysis
- ROI and conversion optimization
- Competitive insights and market analysis

RESPONSE GUIDELINES:
- Always provide specific, actionable recommendations
- Use data and metrics to support your suggestions
- Format responses with clear structure (headers, bullet points, numbers)
- Include potential impact estimates when possible
- Ask clarifying questions when you need more context
- Be concise but comprehensive

`;

  if (accountContext) {
    systemPrompt += `
CURRENT ACCOUNT CONTEXT:
You have access to real-time data for this user's Google Ads account:

ACCOUNT OVERVIEW:
${accountContext.natural_language?.executive_summary || 'Account data is being analyzed...'}

PERFORMANCE STATUS:
${accountContext.natural_language?.performance_narrative || 'Performance data is being processed...'}

KEY INSIGHTS:
${accountContext.insights_summary?.key_opportunities?.slice(0, 3).join('\n') || 'Analyzing opportunities...'}

TOP RECOMMENDATIONS:
${accountContext.actionable_recommendations?.slice(0, 3).map((rec: any, idx: number) => 
  `${idx + 1}. ${rec.title}: ${rec.description} (${rec.potential_impact})`
).join('\n') || 'Preparing recommendations...'}

Use this context to provide specific, data-driven recommendations. Reference actual metrics and performance data in your responses.
`;
  } else {
    systemPrompt += `
NOTE: No specific account data is currently available. Focus on general Google Ads best practices and ask the user to connect their account for personalized insights.
`;
  }

  return systemPrompt;
}

function buildConversationMessages(
  systemPrompt: string, 
  history: any[], 
  currentMessage: string,
  accountContext: AccountContext | null
): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history (reverse order since we get latest first)
  if (history && history.length > 0) {
    const reversedHistory = [...history].reverse();
    for (const msg of reversedHistory) {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

async function handleStreamingResponse(
  openaiResponse: Response, 
  conversationId: string, 
  userId: string,
  accountContext: AccountContext | null
): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const reader = openaiResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let assistantMessage = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                // Save complete assistant message to database
                if (assistantMessage.trim()) {
                  await saveAssistantMessage(conversationId, userId, assistantMessage, null, accountContext);
                }
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  assistantMessage += content;
                  // Send chunk to client
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                    type: 'content',
                    content,
                    conversation_id: conversationId
                  })}\n\n`));
                }
              } catch (e) {
                // Skip malformed JSON
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function saveAssistantMessage(
  conversationId: string, 
  userId: string, 
  content: string, 
  usage: any, 
  accountContext: AccountContext | null
): Promise<void> {
  try {
    const metadata: any = {};
    if (usage) {
      metadata.usage = usage;
    }
    if (accountContext) {
      metadata.had_account_context = true;
      metadata.recommendations_count = accountContext.actionable_recommendations?.length || 0;
    }

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: content.trim(),
        metadata,
        context_data: accountContext ? {
          account_summary: accountContext.account_summary,
          insights_used: accountContext.insights_summary?.key_opportunities?.slice(0, 3) || []
        } : null,
        token_count: usage?.total_tokens || null,
      });

    if (error) {
      console.error('Error saving assistant message:', error);
    }
  } catch (error) {
    console.error('Error in saveAssistantMessage:', error);
  }
}