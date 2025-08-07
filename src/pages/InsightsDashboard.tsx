import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Settings, 
  Target, 
  DollarSign, 
  Eye, 
  MousePointer, 
  BarChart3, 
  TrendingUp, 
  ShoppingCart 
} from 'lucide-react';
import InsightToggle from '@/components/Insights/InsightToggle';

interface InsightConfig {
  id: string;
  name: string;
  icon: any;
  description: string;
  enabled: boolean;
  category: string;
}

export default function InsightsDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [insights, setInsights] = useState<InsightConfig[]>([
    {
      id: 'conversion-rate',
      name: 'Conversion rate',
      icon: Target,
      description: 'Monitor conversion rate changes and trends',
      enabled: false,
      category: 'performance'
    },
    {
      id: 'ads-spend',
      name: 'Ads spend',
      icon: DollarSign,
      description: 'Track daily/weekly spend patterns and budget alerts',
      enabled: false,
      category: 'budget'
    },
    {
      id: 'impressions',
      name: 'Impressions',
      icon: Eye,
      description: 'Monitor impression volume and reach metrics',
      enabled: false,
      category: 'performance'
    },
    {
      id: 'clicks',
      name: 'Clicks',
      icon: MousePointer,
      description: 'Track click performance and trends',
      enabled: false,
      category: 'performance'
    },
    {
      id: 'cpm',
      name: 'CPM (Cost per 1K impressions)',
      icon: BarChart3,
      description: 'Cost per thousand impressions monitoring',
      enabled: false,
      category: 'budget'
    },
    {
      id: 'ctr',
      name: 'CTR (Click-through rate)',
      icon: TrendingUp,
      description: 'Click-through rate performance alerts',
      enabled: false,
      category: 'performance'
    },
    {
      id: 'conversions',
      name: 'Allocated purchases (conversions)',
      icon: ShoppingCart,
      description: 'Purchase and lead conversion tracking',
      enabled: false,
      category: 'conversion'
    }
  ]);

  const enabledCount = insights.filter(insight => insight.enabled).length;
  const totalCount = insights.length;

  const handleToggleInsight = (insightId: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId 
        ? { ...insight, enabled: !insight.enabled }
        : insight
    ));
  };

  const filteredInsights = insights.filter(insight => {
    const matchesSearch = insight.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         insight.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || insight.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground">
            Configure which Google Ads metrics you want to monitor
          </p>
        </div>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Global Settings
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search insights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Insights" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Insights</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="budget">Budget</SelectItem>
            <SelectItem value="conversion">Conversion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Google Ads Insights Section */}
      <Card className="professional-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-primary font-bold text-lg">📢</span>
              </div>
              <div>
                <CardTitle className="text-xl">Google Ads</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={enabledCount > 0 ? "default" : "secondary"}>
                    {enabledCount} of {totalCount} insights enabled
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredInsights.map((insight) => (
            <InsightToggle
              key={insight.id}
              insight={insight}
              onToggle={handleToggleInsight}
            />
          ))}
          
          {filteredInsights.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No insights found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      {enabledCount > 0 && (
        <Card className="professional-card">
          <CardHeader>
            <CardTitle>Active Insights Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.filter(insight => insight.enabled).map((insight) => (
                <div key={insight.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <insight.icon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{insight.name}</p>
                    <p className="text-xs text-muted-foreground">Active monitoring</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-primary font-medium">
                📊 Your insights are being monitored in real-time
              </p>
              <p className="text-xs text-primary/80 mt-1">
                You'll receive notifications when significant changes occur
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}