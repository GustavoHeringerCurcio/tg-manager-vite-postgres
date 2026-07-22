import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function AppShell() {
  return (
    <TooltipProvider delay={300}>
      <SidebarProvider
        style={
          {
            "--sidebar-top": "var(--header-height)",
          } as React.CSSProperties
        }
      >
        <AppHeader />
        <AppSidebar />
        <SidebarInset>
          <div className="flex flex-1 flex-col pt-[var(--header-height)]">
            <div className="flex-1 overflow-auto scrollbar-thin">
              <div className="container mx-auto p-6">
                <Outlet />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
