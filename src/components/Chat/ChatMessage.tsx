import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface QuickAction {
  label: string;
  icon: any;
  action: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  actions?: QuickAction[];
}

interface ChatMessageProps {
  message: ChatMessage;
  onQuickAction?: (action: string) => void;
}

export default function ChatMessage({ message, onQuickAction }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-2xl ${isUser ? 'ml-16' : 'mr-16'}`}>
        {/* Simple Message Bubble */}
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser 
              ? 'bg-foreground text-background' 
              : 'bg-muted text-foreground'
            }
          `}
        >
          {message.content.split('\n').map((line, index) => (
            <p key={index} className={`${index === 0 ? 'mt-0' : 'mt-2'} mb-0`}>
              {line}
            </p>
          ))}
        </div>

        {/* Quick Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onQuickAction?.(action.action)}
                className="text-xs h-8 bg-background hover:bg-muted"
              >
                <action.icon className="mr-1 h-3 w-3" />
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}