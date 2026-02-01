import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  Settings,
  Bell,
  LogOut,
  Router,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Phone,
  FileBarChart,
  Calculator,
  Boxes,
  UserCog,
  FileText,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useIspSettings } from "@/hooks/useIspSettings";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string; // Resource for permission check
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", icon: Users, resource: "customers" },
  { path: "/packages", label: "Packages", icon: Package, resource: "packages" },
  { path: "/payments", label: "Payments", icon: CreditCard, resource: "payments" },
  { path: "/invoices", label: "Invoices", icon: FileText, resource: "invoices" },
  { path: "/reminders", label: "Reminders", icon: Bell, resource: "reminders" },
  { path: "/call-records", label: "Call Records", icon: Phone, resource: "call_records" },
  { path: "/inventory", label: "Inventory", icon: Boxes, resource: "inventory" },
  { path: "/hrm", label: "HRM", icon: UserCog, resource: "hrm" },
  { path: "/accounting", label: "Accounting", icon: Calculator, resource: "transactions" },
  { path: "/reports", label: "Reports", icon: FileBarChart, resource: "reports" },
  { path: "/routers", label: "Routers", icon: Router, resource: "routers" },
  { path: "/settings", label: "Settings", icon: Settings, resource: "settings" },
];

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { canRead } = usePermissions();
  const { ispName } = useIspSettings();
  const [collapsed, setCollapsed] = useState(false);

  // Filter navigation items based on user permissions
  const visibleNavItems = navItems.filter((item) => {
    // Dashboard is always visible for authenticated users
    if (!item.resource) return true;
    
    // super_admin always sees all items
    if (role === "super_admin") return true;
    
    // Check database permission for read access
    return canRead(item.resource);
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Wifi className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sidebar-foreground truncate">{ispName}</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">Billing System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "nav-item",
                isActive && "active"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="nav-item w-full text-sidebar-foreground/70 hover:text-destructive"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border shadow-sm hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </Button>
    </aside>
  );
}
