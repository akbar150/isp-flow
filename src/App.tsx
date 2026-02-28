import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { IspSettingsProvider } from "@/hooks/useIspSettings";
import { usePermissions } from "@/hooks/usePermissions";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Packages from "./pages/Packages";
import Payments from "./pages/Payments";
import Reminders from "./pages/Reminders";
import CallRecords from "./pages/CallRecords";
import Routers from "./pages/Routers";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Accounting from "./pages/Accounting";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import HRM from "./pages/HRM";
import Invoices from "./pages/Invoices";
import CustomerLogin from "./pages/CustomerLogin";
import CustomerPortal from "./pages/CustomerPortal";
import Tickets from "./pages/Tickets";
import Outages from "./pages/Outages";
import ServiceTasks from "./pages/ServiceTasks";
import TechnicianPortal from "./pages/TechnicianPortal";
import ResellerLogin from "./pages/ResellerLogin";
import ResellerPortal from "./pages/ResellerPortal";
import Resellers from "./pages/Resellers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

interface ProtectedRouteProps {
  children: React.ReactNode;
  resource?: string;
  action?: string;
}

function ProtectedRoute({ children, resource, action = "read" }: ProtectedRouteProps) {
  const { user, role, loading: authLoading } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If a resource is specified, check permission
  if (resource) {
    // super_admin always has access
    if (role === "super_admin") {
      return <>{children}</>;
    }
    
    // Check database permission
    if (!hasPermission(resource, action)) {
      // Redirect to dashboard if user doesn't have permission
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute resource="customers">
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/packages"
        element={
          <ProtectedRoute resource="packages">
            <Packages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute resource="payments">
            <Payments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reminders"
        element={
          <ProtectedRoute resource="reminders">
            <Reminders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/call-records"
        element={
          <ProtectedRoute resource="call_records">
            <CallRecords />
          </ProtectedRoute>
        }
      />
      <Route
        path="/routers"
        element={
          <ProtectedRoute resource="routers">
            <Routers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute resource="settings">
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute resource="reports">
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounting"
        element={
          <ProtectedRoute resource="transactions">
            <Accounting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute resource="inventory">
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute resource="inventory">
            <Suppliers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hrm"
        element={
          <ProtectedRoute resource="hrm">
            <HRM />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute resource="invoices">
            <Invoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute resource="tickets">
            <Tickets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/outages"
        element={
          <ProtectedRoute resource="outages">
            <Outages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-tasks"
        element={
          <ProtectedRoute resource="service_tasks">
            <ServiceTasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resellers"
        element={
          <ProtectedRoute resource="resellers">
            <Resellers />
          </ProtectedRoute>
        }
      />
      {/* Customer Routes */}
      <Route path="/customer-login" element={<CustomerLogin />} />
      <Route path="/customer-portal" element={<CustomerPortal />} />
      <Route path="/technician" element={<TechnicianPortal />} />
      <Route path="/reseller-login" element={<ResellerLogin />} />
      <Route path="/reseller-portal" element={<ResellerPortal />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <IspSettingsProvider>
            <AppRoutes />
          </IspSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
