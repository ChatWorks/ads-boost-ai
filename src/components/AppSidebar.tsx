import { useState } from "react";
import { BarChart3, Settings, Zap, MessageCircle, LogOut, User, Database } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const menuItems = [
  { title: "Chat", url: "/", icon: MessageCircle },
  { title: "Integrations", url: "/integrations", icon: Zap },
  { title: "Data", url: "/data", icon: Database },
  { title: "Insights", url: "/insights", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const getNavClasses = (path: string) => 
    isActive(path) ? "sidebar-nav-item active" : "sidebar-nav-item";

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <Sidebar
      className={`shadow-sidebar transition-smooth ${collapsed ? "w-14" : "w-60"}`}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">I</span>
          </div>
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">Innogo</h2>
              <p className="text-xs text-sidebar-foreground/60">AI Ads Assistant</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs uppercase tracking-wider px-3 mb-2">
            {!collapsed && "Main Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClasses(item.url)}>
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="space-y-2">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.user_metadata?.full_name || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.email}
                </p>
              </div>
            )}
          </div>

          {/* Sign Out Button */}
          <Button
            onClick={signOut}
            variant="ghost"
            size="sm"
            className={`w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent ${
              collapsed ? "px-2" : ""
            }`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}