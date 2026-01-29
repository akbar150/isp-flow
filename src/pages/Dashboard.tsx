import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { QuickCallRecord } from "@/components/QuickCallRecord";
import { supabase } from "@/integrations/supabase/client";
import { useIspSettings } from "@/hooks/useIspSettings";
import { 
  Users, 
  UserCheck, 
  AlertTriangle, 
  UserX, 
  DollarSign,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format, startOfDay, isBefore } from "date-fns";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  expiringUsers: number;
  expiredUsers: number;
  totalDue: number;
  todayCollections: number;
}

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  expiry_date: string;
  status: 'active' | 'expiring' | 'expired' | 'suspended';
  total_due: number;
  packages: {
    name: string;
    monthly_price: number;
  } | null;
}

export default function Dashboard() {
  const { ispName } = useIspSettings();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    expiringUsers: 0,
    expiredUsers: 0,
    totalDue: 0,
    todayCollections: 0
  });
  const [expiringCustomers, setExpiringCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch customers using safe view (excludes password_hash)
      const { data: customers, error: customersError } = await supabase
        .from('customers_safe')
        .select('*, packages(name, monthly_price)');

      if (customersError) throw customersError;

      // Calculate stats using actual billing date logic
      const today = startOfDay(new Date());
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(today.getDate() + 3);

      let totalDue = 0;
      let activeCount = 0;
      let expiringCount = 0;
      let expiredCount = 0;
      const expiringList: Customer[] = [];

      customers?.forEach(customer => {
        const expiryDate = startOfDay(new Date(customer.expiry_date));
        const isBillingPassed = isBefore(expiryDate, today) || expiryDate.getTime() === today.getTime();
        
        // Only count due if billing date has passed
        if (isBillingPassed) {
          totalDue += Number(customer.total_due) || 0;
        }
        
        if (isBefore(expiryDate, today)) {
          expiredCount++;
        } else if (expiryDate <= threeDaysFromNow) {
          expiringCount++;
          expiringList.push(customer as Customer);
        } else {
          activeCount++;
        }
      });

      // Fetch today's payments
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', todayStr);

      const todayCollections = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        totalUsers: customers?.length || 0,
        activeUsers: activeCount,
        expiringUsers: expiringCount,
        expiredUsers: expiredCount,
        totalDue,
        todayCollections
      });

      setExpiringCustomers(expiringList.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Welcome back! Here's your {ispName} overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Customers"
          value={stats.totalUsers}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Expiring in 3 Days"
          value={stats.expiringUsers}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Expired Users"
          value={stats.expiredUsers}
          icon={UserX}
          variant="danger"
        />
        <StatCard
          title="Total Due Amount"
          value={`৳${stats.totalDue.toLocaleString()}`}
          icon={DollarSign}
          variant="warning"
        />
        <StatCard
          title="Today's Collections"
          value={`৳${stats.todayCollections.toLocaleString()}`}
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Expiring Soon Table */}
      <div className="form-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="form-section-title border-0 mb-0 pb-0">Expiring Soon</h2>
          <Link to="/customers?filter=expiring">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {expiringCustomers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No customers expiring in the next 3 days 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Package</th>
                  <th>Expiry</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {expiringCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="font-mono text-sm">{customer.user_id}</td>
                    <td className="font-medium">{customer.full_name}</td>
                    <td>{customer.packages?.name || 'N/A'}</td>
                    <td>{format(new Date(customer.expiry_date), 'dd MMM yyyy')}</td>
                  <td className="amount-due">৳{customer.total_due}</td>
                    <td>
                      <StatusBadge status={customer.status} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <QuickCallRecord
                          customerId={customer.id}
                          customerName={customer.full_name}
                        />
                        <WhatsAppButton
                          phone={customer.phone}
                          customerName={customer.full_name}
                          userId={customer.user_id}
                          packageName={customer.packages?.name || 'Internet'}
                          expiryDate={new Date(customer.expiry_date)}
                          amount={customer.packages?.monthly_price || customer.total_due}
                          variant="icon"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
