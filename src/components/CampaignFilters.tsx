import { useState } from 'react';
import { CalendarIcon, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface CampaignFilters {
  dateRange: 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM';
  startDate?: Date;
  endDate?: Date;
  metrics: string[];
  campaignStatus: string[];
  limit: number;
}

interface CampaignFiltersProps {
  filters: CampaignFilters;
  onFiltersChange: (filters: CampaignFilters) => void;
  onApplyFilters: () => void;
  isLoading?: boolean;
}

const availableMetrics = [
  { id: 'impressions', label: 'Impressions', default: true },
  { id: 'clicks', label: 'Clicks', default: true },
  { id: 'cost_micros', label: 'Cost', default: true },
  { id: 'ctr', label: 'CTR', default: true },
  { id: 'average_cpc', label: 'Avg. CPC', default: false },
  { id: 'conversions', label: 'Conversions', default: true },
  { id: 'cost_per_conversion', label: 'Cost per Conversion', default: false },
  { id: 'search_impression_share', label: 'Search Impression Share', default: false },
  { id: 'search_budget_lost_impression_share', label: 'Budget Lost IS', default: false },
  { id: 'search_rank_lost_impression_share', label: 'Rank Lost IS', default: false },
  { id: 'average_cost', label: 'Average Cost', default: false },
  { id: 'video_views', label: 'Video Views', default: false },
  { id: 'view_through_conversions', label: 'View-through Conversions', default: false },
];

const campaignStatuses = [
  { id: 'ENABLED', label: 'Enabled' },
  { id: 'PAUSED', label: 'Paused' },
  { id: 'REMOVED', label: 'Removed' },
];

export default function CampaignFilters({ filters, onFiltersChange, onApplyFilters, isLoading }: CampaignFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilters = (updates: Partial<CampaignFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const handleMetricToggle = (metricId: string, checked: boolean) => {
    const updatedMetrics = checked
      ? [...filters.metrics, metricId]
      : filters.metrics.filter(m => m !== metricId);
    updateFilters({ metrics: updatedMetrics });
  };

  const handleStatusToggle = (statusId: string, checked: boolean) => {
    const updatedStatuses = checked
      ? [...filters.campaignStatus, statusId]
      : filters.campaignStatus.filter(s => s !== statusId);
    updateFilters({ campaignStatus: updatedStatuses });
  };

  const resetToDefaults = () => {
    updateFilters({
      dateRange: 'LAST_30_DAYS',
      startDate: undefined,
      endDate: undefined,
      metrics: availableMetrics.filter(m => m.default).map(m => m.id),
      campaignStatus: ['ENABLED'],
      limit: 50
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Campaign Filters
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={onApplyFilters} 
              disabled={isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Apply Filters'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Date Range</label>
          <Select 
            value={filters.dateRange} 
            onValueChange={(value: any) => updateFilters({ dateRange: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LAST_7_DAYS">Last 7 days</SelectItem>
              <SelectItem value="LAST_14_DAYS">Last 14 days</SelectItem>
              <SelectItem value="LAST_30_DAYS">Last 30 days</SelectItem>
              <SelectItem value="LAST_90_DAYS">Last 90 days</SelectItem>
              <SelectItem value="CUSTOM">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {filters.dateRange === 'CUSTOM' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, "PPP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => updateFilters({ startDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal flex-1",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, "PPP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => updateFilters({ endDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Metrics Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Metrics to Retrieve</label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {availableMetrics.map((metric) => (
              <div key={metric.id} className="flex items-center space-x-2">
                <Checkbox
                  id={metric.id}
                  checked={filters.metrics.includes(metric.id)}
                  onCheckedChange={(checked) => handleMetricToggle(metric.id, checked as boolean)}
                />
                <label htmlFor={metric.id} className="text-sm">
                  {metric.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Status */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Campaign Status</label>
          <div className="flex gap-4">
            {campaignStatuses.map((status) => (
              <div key={status.id} className="flex items-center space-x-2">
                <Checkbox
                  id={status.id}
                  checked={filters.campaignStatus.includes(status.id)}
                  onCheckedChange={(checked) => handleStatusToggle(status.id, checked as boolean)}
                />
                <label htmlFor={status.id} className="text-sm">
                  {status.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Limit */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Number of Campaigns</label>
          <Select 
            value={filters.limit.toString()} 
            onValueChange={(value) => updateFilters({ limit: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 campaigns</SelectItem>
              <SelectItem value="25">25 campaigns</SelectItem>
              <SelectItem value="50">50 campaigns</SelectItem>
              <SelectItem value="100">100 campaigns</SelectItem>
              <SelectItem value="200">200 campaigns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}