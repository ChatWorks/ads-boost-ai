import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, DollarSign, MousePointer, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AnalysisItem {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'bid' | 'keyword' | 'budget' | 'targeting';
  improvement: string;
  executed: boolean;
}

export default function CampaignAnalysis() {
  const [suggestions, setSuggestions] = useState<AnalysisItem[]>([
    {
      id: '1',
      title: 'Verhoog biedingen voor high-performing keywords',
      description: 'Keywords met CTR > 5% en conversie rate > 3% kunnen hogere biedingen aan',
      impact: 'high',
      category: 'bid',
      improvement: '+25% meer conversies verwacht',
      executed: false
    },
    {
      id: '2',
      title: 'Pauzeer onderpresterend advertenties',
      description: '12 advertenties hebben een CTR < 1% en kosten €450/maand zonder conversies',
      impact: 'medium',
      category: 'targeting',
      improvement: '€450/maand besparing',
      executed: false
    },
    {
      id: '3',
      title: 'Voeg negatieve keywords toe',
      description: 'Zoektermen als "gratis", "goedkoop" genereren clicks zonder conversies',
      impact: 'medium',
      category: 'keyword',
      improvement: '-15% verspilde clicks',
      executed: false
    },
    {
      id: '4',
      title: 'Verhoog budget voor best presterende campagne',
      description: 'Campagne "Premium Producten" heeft budget limitatie bij 85% conversion rate',
      impact: 'high',
      category: 'budget',
      improvement: '+40% meer omzet mogelijk',
      executed: false
    }
  ]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bid': return <TrendingUp className="h-4 w-4" />;
      case 'keyword': return <Target className="h-4 w-4" />;
      case 'budget': return <DollarSign className="h-4 w-4" />;
      case 'targeting': return <MousePointer className="h-4 w-4" />;
      default: return <TrendingUp className="h-4 w-4" />;
    }
  };

  const executeSuggestion = async (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion) return;

    // Simulate loading
    toast({
      title: "Aanpassing wordt uitgevoerd...",
      description: suggestion.title,
    });

    // Simulate execution time
    setTimeout(() => {
      setSuggestions(prev => 
        prev.map(s => s.id === id ? { ...s, executed: true } : s)
      );

      toast({
        title: "✅ Aanpassing succesvol uitgevoerd",
        description: `${suggestion.title} - ${suggestion.improvement}`,
        variant: "default",
      });
    }, 2000);
  };

  const executedCount = suggestions.filter(s => s.executed).length;
  const totalImpact = suggestions
    .filter(s => s.executed)
    .reduce((acc, s) => acc + (s.impact === 'high' ? 3 : s.impact === 'medium' ? 2 : 1), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              AI Campagne Analyse & Optimalisaties
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Automatische analyse van je campagne performance met directe verbeteringen
            </p>
          </div>
          {executedCount > 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {executedCount}/{suggestions.length} uitgevoerd
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalImpact > 0 && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 font-medium">
              <CheckCircle className="h-4 w-4" />
              Impact van uitgevoerde optimalisaties
            </div>
            <p className="text-sm text-green-700 mt-1">
              Geschatte verbetering in performance en kostenbesparing door jouw aanpassingen.
            </p>
          </div>
        )}

        <div className="grid gap-4">
          {suggestions.map((suggestion) => (
            <div 
              key={suggestion.id}
              className={`p-4 border rounded-lg transition-all ${
                suggestion.executed 
                  ? 'bg-green-50 border-green-200 opacity-75' 
                  : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(suggestion.category)}
                    <h3 className={`font-medium ${suggestion.executed ? 'line-through text-muted-foreground' : ''}`}>
                      {suggestion.title}
                    </h3>
                    <Badge 
                      variant="outline" 
                      className={getImpactColor(suggestion.impact)}
                    >
                      {suggestion.impact === 'high' ? 'Hoge impact' : 
                       suggestion.impact === 'medium' ? 'Gemiddelde impact' : 'Lage impact'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {suggestion.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      📈 {suggestion.improvement}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {suggestion.executed ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Uitgevoerd</span>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => executeSuggestion(suggestion.id)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Uitvoeren
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {executedCount === suggestions.length && (
          <div className="text-center p-6 bg-primary/5 border border-primary/20 rounded-lg">
            <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-medium text-primary mb-1">Alle optimalisaties uitgevoerd!</h3>
            <p className="text-sm text-muted-foreground">
              Je campagnes zijn nu geoptimaliseerd voor betere performance.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}