import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageCircle, MoreHorizontal } from 'lucide-react';

interface RecentChat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  isActive?: boolean;
}

export default function RecentChats() {
  // Mock data - in real implementation, this would come from a database
  const recentChats: RecentChat[] = [
    {
      id: '1',
      title: 'Campaign optimization',
      lastMessage: 'Analyze my campaign performance',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      isActive: true
    },
    {
      id: '2',
      title: 'Budget review',
      lastMessage: 'Show me budget allocation',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      isActive: false
    },
    {
      id: '3',
      title: 'Keyword analysis',
      lastMessage: 'Which keywords are performing best?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      isActive: false
    }
  ];

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Recent Chats
        </h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {recentChats.map((chat) => (
            <Button
              key={chat.id}
              variant={chat.isActive ? "secondary" : "ghost"}
              className={`
                w-full justify-start p-3 h-auto text-left hover:bg-muted/80
                ${chat.isActive ? 'bg-muted border-l-2 border-l-primary' : ''}
              `}
            >
              <div className="flex items-start gap-3 w-full">
                <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate mb-1">
                    {chat.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {chat.lastMessage}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(chat.timestamp)}
                  </p>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}