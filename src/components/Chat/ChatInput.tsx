import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({ 
  onSendMessage, 
  placeholder = "Ask Innogo a question...",
  disabled = false 
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pr-12 py-4 text-base rounded-2xl border-border bg-background focus:ring-1 focus:ring-foreground/20"
      />
      <Button
        type="submit"
        size="sm"
        disabled={!message.trim() || disabled}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-foreground hover:bg-foreground/90 rounded-full"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}