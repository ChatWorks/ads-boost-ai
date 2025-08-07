-- Fix security warnings by adding search_path to functions
-- This ensures functions operate in a secure, predictable schema context

-- Update update_conversation_metadata function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update set_message_sequence function
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
$$ LANGUAGE plpgsql SET search_path = '';

-- Update generate_conversation_title function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update cleanup_old_conversations function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update get_conversation_context function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';