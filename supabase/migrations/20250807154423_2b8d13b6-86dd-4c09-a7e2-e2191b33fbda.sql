-- Create chat conversations table for conversation metadata
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_ads_account_id UUID REFERENCES public.google_ads_accounts(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE
);

-- Create chat messages table for individual messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  context_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sequence_number INTEGER NOT NULL,
  token_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  error_message TEXT
);

-- Enable RLS on both tables
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chat_conversations
-- Users can only see their own conversations
CREATE POLICY "Users can view own conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only create conversations for themselves
CREATE POLICY "Users can create own conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own conversations
CREATE POLICY "Users can update own conversations" 
ON public.chat_conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only delete their own conversations
CREATE POLICY "Users can delete own conversations" 
ON public.chat_conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for chat_messages
-- Users can only see messages from their own conversations
CREATE POLICY "Users can view own messages" 
ON public.chat_messages 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  )
);

-- Users can only create messages in their own conversations
CREATE POLICY "Users can create own messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  )
);

-- Users can only update their own messages
CREATE POLICY "Users can update own messages" 
ON public.chat_messages 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  )
);

-- Users can only delete their own messages
CREATE POLICY "Users can delete own messages" 
ON public.chat_messages 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_updated_at ON public.chat_conversations(updated_at DESC);
CREATE INDEX idx_chat_conversations_user_updated ON public.chat_conversations(user_id, updated_at DESC);
CREATE INDEX idx_chat_conversations_account ON public.chat_conversations(google_ads_account_id);

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX idx_chat_messages_sequence ON public.chat_messages(conversation_id, sequence_number);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Create unique constraint for message sequence within conversation
CREATE UNIQUE INDEX idx_chat_messages_conversation_sequence 
ON public.chat_messages(conversation_id, sequence_number);

-- Function to update conversation metadata when messages are added
CREATE OR REPLACE FUNCTION public.update_conversation_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update message count and last message timestamp
  UPDATE public.chat_conversations 
  SET 
    message_count = (
      SELECT COUNT(*) 
      FROM public.chat_messages 
      WHERE conversation_id = NEW.conversation_id
    ),
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set sequence number automatically
CREATE OR REPLACE FUNCTION public.set_message_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Set sequence number based on existing messages in conversation
  NEW.sequence_number = COALESCE(
    (SELECT MAX(sequence_number) + 1 FROM public.chat_messages WHERE conversation_id = NEW.conversation_id),
    1
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic metadata updates
CREATE TRIGGER trigger_update_conversation_metadata
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_metadata();

CREATE TRIGGER trigger_set_message_sequence
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_sequence();

-- Function to automatically generate conversation title from first user message
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update title if it's still the default and this is a user message
  IF NEW.role = 'user' AND NEW.sequence_number = 1 THEN
    UPDATE public.chat_conversations 
    SET title = CASE 
      WHEN LENGTH(NEW.content) > 50 
      THEN LEFT(NEW.content, 47) || '...'
      ELSE NEW.content
    END
    WHERE id = NEW.conversation_id 
    AND title = 'New Conversation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_generate_conversation_title
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_conversation_title();

-- Function to clean up old conversations (keep latest 10 per user by default)
CREATE OR REPLACE FUNCTION public.cleanup_old_conversations(
  target_user_id UUID DEFAULT NULL,
  keep_count INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  user_to_clean UUID;
BEGIN
  -- If no specific user provided, this function would need to be called per user
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id must be provided for security';
  END IF;
  
  user_to_clean := target_user_id;
  
  -- Delete conversations beyond the keep_count limit
  WITH conversations_to_delete AS (
    SELECT id
    FROM public.chat_conversations
    WHERE user_id = user_to_clean
    AND NOT is_archived
    ORDER BY updated_at DESC
    OFFSET keep_count
  )
  DELETE FROM public.chat_conversations
  WHERE id IN (SELECT id FROM conversations_to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation context for AI (latest N messages)
CREATE OR REPLACE FUNCTION public.get_conversation_context(
  conversation_uuid UUID,
  message_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  message_id UUID,
  role TEXT,
  content TEXT,
  metadata JSONB,
  context_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  sequence_number INTEGER
) AS $$
BEGIN
  -- Verify user has access to this conversation
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_uuid AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to conversation';
  END IF;
  
  RETURN QUERY
  SELECT 
    cm.id,
    cm.role,
    cm.content,
    cm.metadata,
    cm.context_data,
    cm.created_at,
    cm.sequence_number
  FROM public.chat_messages cm
  WHERE cm.conversation_id = conversation_uuid
  ORDER BY cm.sequence_number DESC
  LIMIT message_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to automatically update updated_at column for conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();