import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, DollarSign, TrendingUp, Award } from "lucide-react";

interface ResellerStats {
  totalResellers: number;
  activeResellers: number;
  totalCustomers: number;
  totalPendingCommission: number;
  totalPaidCommission: number;
}

export function ResellerDashboardStats() {
  const [stats, setStats] = useState<ResellerStats>({
    totalResellers: 0,
    activeResellers: 0,
    totalCustomers: 0,
    totalPendingCommission: 0,
    totalPaidCommission: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [resellersRes, customersRes, commissionsRes] = await Promise.all([
        supabase.from("resellers").select("id, status"),
        supabase.from("reseller_customers").select("id"),
        supabase.from("reseller_commissions").select("amount, status"),
      ]);

      const resellers = resellersRes.data || [];
      const totalPending = (commissionsRes.data || [])
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + Number(c.amount), 0);
      const totalPaid = (commissionsRes.data || [])
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + Number(c.amount), 0);

      setStats({
        totalResellers: resellers.length,
        activeResellers: resellers.filter((r) => r.status === "active").length,
        totalCustomers: (customersRes.data || []).length,
        totalPendingCommission: totalPending,
        totalPaidCommission: totalPaid,
      });
    } catch (error) {
      console.error("Error fetching reseller stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg animate-pulse h-20" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Total Resellers", value: stats.totalResellers, icon: Users, color: "text-primary" },
    { label: "Active Resellers", value: stats.activeResellers, icon: TrendingUp, color: "text-green-600" },
    { label: "Assigned Customers", value: stats.totalCustomers, icon: Users, color: "text-blue-600" },
    { label: "Pending Commission", value: `৳${stats.totalPendingCommission.toLocaleString()}`, icon: DollarSign, color: "text-yellow-600" },
    { label: "Paid Commission", value: `৳${stats.totalPaidCommission.toLocaleString()}`, icon: Award, color: "text-green-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
          <p className="text-xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
