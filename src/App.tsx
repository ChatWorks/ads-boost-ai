import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import ChatDashboard from "./pages/ChatDashboard";
import InsightsDashboard from "./pages/InsightsDashboard";
import InsightEmailSettings from "./pages/InsightEmailSettings";
import Integrations from "./pages/Integrations";
import Data from "./pages/Data";
import Campaigns from "./pages/Campaigns";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <Layout>{children}</Layout>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

// Public Route Component (redirects to dashboard if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <>{children}</>;
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <ChatDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/auth" 
              element={
                <PublicRoute>
                  <Auth />
                </PublicRoute>
              } 
            />
            <Route 
              path="/integrations" 
              element={
                <ProtectedRoute>
                  <Integrations />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/insights" 
              element={
                <ProtectedRoute>
                  <InsightsDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/insights/settings/:insightId" 
              element={
                <ProtectedRoute>
                  <InsightEmailSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/data" 
              element={
                <ProtectedRoute>
                  <Data />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/campaigns" 
              element={
                <ProtectedRoute>
                  <Campaigns />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-muted-foreground">Deep dive into your campaign performance</p>
                  </div>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <div className="p-6">
                    <h1 className="text-3xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">Configure your account and preferences</p>
                  </div>
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
