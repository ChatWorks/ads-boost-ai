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
      <div className={`max-w-3xl ${isUser ? 'ml-12' : 'mr-12'}`}>
        {/* Message Header */}
        <div className={`flex items-center gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {!isUser && (
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">🤖</span>
            </div>
          )}
          <span className="text-sm font-medium">
            {isUser ? '👤 You' : '🤖 Innogo'}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(message.timestamp, 'HH:mm')}
          </span>
          {isUser && (
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">👤</span>
            </div>
          )}
        </div>

        {/* Message Bubble */}
        <div
          className={`
            rounded-lg p-4 shadow-sm
            ${isUser 
              ? 'bg-primary text-primary-foreground ml-8' 
              : 'bg-muted/70 text-foreground mr-8'
            }
          `}
        >
          <div className="prose prose-sm max-w-none">
            {message.content.split('\n').map((line, index) => (
              <p key={index} className={`${index === 0 ? 'mt-0' : 'mt-2'} mb-0 leading-relaxed`}>
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 mr-8 flex flex-wrap gap-2">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onQuickAction?.(action.action)}
                className="text-xs h-8"
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