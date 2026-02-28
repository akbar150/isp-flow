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
  ChevronDown,
  Wifi,
  WifiOff,
  Phone,
  FileBarChart,
  Calculator,
  Boxes,
  UserCog,
  FileText,
  TicketCheck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useIspSettings } from "@/hooks/useIspSettings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { 
    path: "/customers", 
    label: "Customers", 
    icon: Users, 
    resource: "customers",
    children: [
      { path: "/reminders", label: "Reminders", icon: Bell, resource: "reminders" },
      { path: "/call-records", label: "Call Records", icon: Phone, resource: "call_records" },
    ]
  },
  { path: "/packages", label: "Packages", icon: Package, resource: "packages" },
  { path: "/payments", label: "Payments", icon: CreditCard, resource: "payments" },
  { 
    path: "/accounting", 
    label: "Accounting", 
    icon: Calculator, 
    resource: "transactions",
    children: [
      { path: "/invoices", label: "Invoices", icon: FileText, resource: "invoices" },
    ]
  },
  { path: "/tickets", label: "Support Tickets", icon: TicketCheck, resource: "tickets" },
  { path: "/outages", label: "Network Outages", icon: WifiOff, resource: "outages" },
  { path: "/inventory", label: "Inventory", icon: Boxes, resource: "inventory" },
  { path: "/hrm", label: "HRM", icon: UserCog, resource: "hrm" },
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
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const toggleMenu = (path: string) => {
    setOpenMenus(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const canAccessItem = (item: NavItem): boolean => {
    if (!item.resource) return true;
    if (role === "super_admin") return true;
    return canRead(item.resource);
  };

  // Filter navigation items based on user permissions
  const visibleNavItems = navItems.filter((item) => {
    if (!canAccessItem(item)) return false;
    
    // If item has children, check if at least one child is accessible
    if (item.children) {
      const hasVisibleChild = item.children.some(child => canAccessItem(child));
      return hasVisibleChild || canAccessItem(item);
    }
    
    return true;
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const isPathActive = (path: string, children?: NavItem[]) => {
    if (location.pathname === path) return true;
    if (children) {
      return children.some(child => location.pathname === child.path);
    }
    return false;
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isPathActive(item.path, item.children);
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.path);
    
    // Filter visible children
    const visibleChildren = item.children?.filter(child => canAccessItem(child)) || [];

    if (hasChildren && visibleChildren.length > 0) {
      return (
        <Collapsible
          key={item.path}
          open={isOpen || isActive}
          onOpenChange={() => !collapsed && toggleMenu(item.path)}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "nav-item w-full justify-between",
                isActive && "active"
              )}
              onClick={(e) => {
                if (collapsed) {
                  e.preventDefault();
                  navigate(item.path);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
              {!collapsed && (
                <ChevronDown 
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    (isOpen || isActive) && "rotate-180"
                  )} 
                />
              )}
            </button>
          </CollapsibleTrigger>
          
          {/* Parent link */}
          {!collapsed && (
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              <Link
                to={item.path}
                className={cn(
                  "nav-item text-sm",
                  location.pathname === item.path && "active"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>All {item.label}</span>
              </Link>
              
              {/* Child items */}
              {visibleChildren.map((child) => (
                <Link
                  key={child.path}
                  to={child.path}
                  className={cn(
                    "nav-item text-sm",
                    location.pathname === child.path && "active"
                  )}
                >
                  <child.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{child.label}</span>
                </Link>
              ))}
            </CollapsibleContent>
          )}
        </Collapsible>
      );
    }

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
        {visibleNavItems.map(renderNavItem)}
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
