import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AdminNotifications } from "./AdminNotifications";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <AppSidebar />
      </div>

      <main className="flex-1 overflow-y-auto">
        {/* Header with notifications */}
        <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="font-semibold text-lg md:hidden">ISP Billing</h1>
          </div>
          <div className="flex items-center gap-2">
            <AdminNotifications />
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
