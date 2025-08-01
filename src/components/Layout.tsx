import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mb-4 mx-auto">
            <span className="text-primary-foreground font-bold text-sm">I</span>
          </div>
          <p className="text-muted-foreground">Loading Innogo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-12 flex items-center border-b bg-card px-4 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          
          {/* Main content */}
          <main className="flex-1 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}