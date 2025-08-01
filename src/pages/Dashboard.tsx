import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, DollarSign, MousePointer, Zap, Plus } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    {
      title: "Campaign Performance",
      value: "No campaigns connected",
      description: "Connect your Google Ads account to view performance",
      icon: BarChart3,
      change: null,
    },
    {
      title: "Click-through Rate",
      value: "--",
      description: "Average CTR across all campaigns",
      icon: MousePointer,
      change: null,
    },
    {
      title: "Ad Spend",
      value: "--",
      description: "Total spend this month",
      icon: DollarSign,
      change: null,
    },
    {
      title: "Conversions",
      value: "--",
      description: "Total conversions this month",
      icon: TrendingUp,
      change: null,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and optimize your Google Ads campaigns with AI insights
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Connect Google Ads
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="professional-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="professional-card lg:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with Innogo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              <Zap className="mr-2 h-4 w-4" />
              Connect Google Ads Account
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="mr-2 h-4 w-4" />
              Test API Connection
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <TrendingUp className="mr-2 h-4 w-4" />
              View Campaign Analytics
            </Button>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <Card className="professional-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Getting Started with Innogo</CardTitle>
            <CardDescription>Follow these steps to optimize your Google Ads campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Connect Your Google Ads Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Securely connect your Google Ads account using OAuth2 to start analyzing your campaigns.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Analyze Campaign Performance</h4>
                  <p className="text-sm text-muted-foreground">
                    Our AI will analyze your campaign data and provide actionable insights.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">Implement Recommendations</h4>
                  <p className="text-sm text-muted-foreground">
                    Apply AI-generated recommendations to optimize your ad performance and ROI.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* No Data State */}
      <Card className="professional-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Campaign Data Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect your Google Ads account to start viewing campaign performance, analytics, and AI-powered insights.
          </p>
          <Button>
            <Zap className="mr-2 h-4 w-4" />
            Connect Google Ads Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}