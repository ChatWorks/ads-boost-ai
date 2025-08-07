import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';

interface InsightConfig {
  id: string;
  name: string;
  icon: any;
  description: string;
  enabled: boolean;
  category: string;
}

interface InsightToggleProps {
  insight: InsightConfig;
  onToggle: (insightId: string) => void;
  onConfigure?: (insightId: string) => void;
}

export default function InsightToggle({ insight, onToggle, onConfigure }: InsightToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
          <insight.icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{insight.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onConfigure?.(insight.id)}
          className="h-8 w-8 p-0"
        >
          <Settings className="h-3 w-3" />
        </Button>
        
        <div className="flex items-center gap-2">
          <Switch
            checked={insight.enabled}
            onCheckedChange={() => onToggle(insight.id)}
          />
          <span className={`text-xs font-medium ${insight.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
            {insight.enabled ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}