import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Keyword {
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  keyword_text: string;
  match_type: string;
  metrics: {
    clicks: number;
    cost: number;
    impressions: number;
    [key: string]: any;
  };
}

interface KeywordsListProps {
  accountId: string;
  filters: any;
}

const KeywordsList: React.FC<KeywordsListProps> = ({ accountId, filters }) => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchKeywords = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('get-keywords', {
        body: { accountId, filters }
      });

      if (functionError) {
        throw functionError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setKeywords(data.keywords || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch keywords';
      setError(errorMessage);
      
      if (errorMessage.includes('reconnection')) {
        toast({
          title: "Connection Required",
          description: "Please reconnect your Google Ads account to fetch keywords.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchKeywords();
    }
  }, [accountId, filters]);

  const getMatchTypeVariant = (matchType: string) => {
    switch (matchType) {
      case 'EXACT': return 'default';
      case 'PHRASE': return 'secondary';
      case 'BROAD': return 'outline';
      default: return 'outline';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading keywords...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-destructive font-medium">Error loading keywords</p>
            <p className="text-muted-foreground text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (keywords.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-muted-foreground">No keywords found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Keywords Performance</h3>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Match Type</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Ad Group</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((keyword, index) => (
                <TableRow key={`${keyword.ad_group_id}-${keyword.keyword_text}-${index}`}>
                  <TableCell className="font-medium">
                    {keyword.keyword_text}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMatchTypeVariant(keyword.match_type)}>
                      {keyword.match_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {keyword.campaign_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {keyword.ad_group_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(keyword.metrics.clicks)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(keyword.metrics.impressions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(keyword.metrics.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default KeywordsList;