import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

function PageFallback() {
  return (
    <div className="space-y-6 animate-fade-in p-8">
      <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
      <div className="h-96 w-full rounded-xl bg-muted/50 animate-pulse" />
    </div>
  );
}

export default function AppShell() {
  return (
    <TooltipProvider delay={300}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex-1 overflow-auto scrollbar-thin">
            <div className="container mx-auto p-6">
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
