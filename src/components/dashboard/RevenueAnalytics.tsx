import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, Users, Target, Percent } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface MonthlyData {
  month: string;
  billed: number;
  collected: number;
  efficiency: number;
}

interface AreaRevenue {
  name: string;
  revenue: number;
}

interface AnalyticsData {
  mrr: number;
  arpu: number;
  churnRate: number;
  collectionEfficiency: number;
  monthlyTrend: MonthlyData[];
  areaRevenue: AreaRevenue[];
  activeCustomers: number;
  newCustomers: number;
  lostCustomers: number;
}

const CHART_COLORS = [
  "hsl(185, 65%, 35%)",
  "hsl(152, 69%, 40%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 50%, 50%)",
  "hsl(200, 60%, 45%)",
  "hsl(320, 60%, 50%)",
  "hsl(60, 70%, 45%)",
];

export function RevenueAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const now = new Date();
      const monthlyTrend: MonthlyData[] = [];

      // Fetch last 6 months of billing and payment data
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));
      const sixMonthsAgoStr = format(sixMonthsAgo, "yyyy-MM-dd");

      const [
        { data: billingRecords },
        { data: payments },
        { data: customers },
        { data: areas },
      ] = await Promise.all([
        supabase
          .from("billing_records")
          .select("billing_date, amount, amount_paid, status")
          .gte("billing_date", sixMonthsAgoStr),
        supabase
          .from("payments")
          .select("payment_date, amount")
          .gte("payment_date", sixMonthsAgoStr),
        supabase
          .from("customers_safe")
          .select("id, status, area_id, package_id, created_at, packages(monthly_price)"),
        supabase.from("areas").select("id, name"),
      ]);

      // Build monthly trend data
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthLabel = format(monthDate, "MMM yyyy");
        const monthStartStr = format(monthStart, "yyyy-MM-dd");
        const monthEndStr = format(monthEnd, "yyyy-MM-dd");

        const monthBilled = (billingRecords || [])
          .filter((r) => r.billing_date >= monthStartStr && r.billing_date <= monthEndStr)
          .reduce((sum, r) => sum + Number(r.amount), 0);

        const monthCollected = (payments || [])
          .filter((p) => p.payment_date >= monthStartStr && p.payment_date <= monthEndStr)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        monthlyTrend.push({
          month: monthLabel,
          billed: monthBilled,
          collected: monthCollected,
          efficiency: monthBilled > 0 ? Math.round((monthCollected / monthBilled) * 100) : 0,
        });
      }

      // Current month stats
      const currentMonth = monthlyTrend[monthlyTrend.length - 1];
      const activeCustomers = (customers || []).filter((c) => c.status === "active").length;
      const totalCustomers = (customers || []).length;

      // MRR: sum of monthly_price for all active customers
      const mrr = (customers || [])
        .filter((c) => c.status === "active")
        .reduce((sum, c) => sum + Number((c as any).packages?.monthly_price || 0), 0);

      // ARPU
      const arpu = activeCustomers > 0 ? Math.round(mrr / activeCustomers) : 0;

      // Churn: customers who became expired in current month vs total
      const expiredCustomers = (customers || []).filter((c) => c.status === "expired").length;
      const churnRate = totalCustomers > 0 ? Math.round((expiredCustomers / totalCustomers) * 100) : 0;

      // Collection efficiency current month
      const collectionEfficiency = currentMonth?.efficiency || 0;

      // Area-wise revenue from payments this month
      const areaMap = new Map<string, string>();
      (areas || []).forEach((a) => areaMap.set(a.id, a.name));

      const customerAreaMap = new Map<string, string>();
      (customers || []).forEach((c) => {
        if (c.area_id && c.id) {
          customerAreaMap.set(c.id, c.area_id);
        }
      });

      // Calculate area revenue from active customer packages
      const areaRevenueMap = new Map<string, number>();
      (customers || []).forEach((c) => {
        if (c.area_id && c.status === "active") {
          const areaName = areaMap.get(c.area_id) || "Unknown";
          const price = Number((c as any).packages?.monthly_price || 0);
          areaRevenueMap.set(areaName, (areaRevenueMap.get(areaName) || 0) + price);
        }
      });

      const areaRevenue = Array.from(areaRevenueMap.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      // New customers this month
      const currentMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const newCustomers = (customers || []).filter(
        (c) => c.created_at && c.created_at >= currentMonthStart
      ).length;

      setData({
        mrr,
        arpu,
        churnRate,
        collectionEfficiency,
        monthlyTrend,
        areaRevenue,
        activeCustomers,
        newCustomers,
        lostCustomers: expiredCustomers,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-5">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    {
      title: "Monthly Recurring Revenue",
      value: `৳${data.mrr.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "ARPU",
      value: `৳${data.arpu.toLocaleString()}`,
      icon: Users,
      color: "text-[hsl(var(--status-active))]",
      bgColor: "bg-[hsl(var(--status-active)/0.1)]",
    },
    {
      title: "Collection Efficiency",
      value: `${data.collectionEfficiency}%`,
      icon: Target,
      color: "text-[hsl(var(--status-expiring))]",
      bgColor: "bg-[hsl(var(--status-expiring)/0.1)]",
    },
    {
      title: "Churn Rate",
      value: `${data.churnRate}%`,
      icon: Percent,
      color: "text-[hsl(var(--status-expired))]",
      bgColor: "bg-[hsl(var(--status-expired)/0.1)]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.title} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-card-label">{kpi.title}</p>
                <p className="stat-card-value mt-1">{kpi.value}</p>
              </div>
              <div className={`metric-icon ${kpi.bgColor} ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Revenue Trend (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [`৳${value.toLocaleString()}`, undefined]}
                />
                <Legend />
                <Bar dataKey="billed" name="Billed" fill="hsl(185, 65%, 35%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="hsl(152, 69%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Collection Efficiency Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Collection Efficiency %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Efficiency"]}
                />
                <Line
                  type="monotone"
                  dataKey="efficiency"
                  stroke="hsl(38, 92%, 50%)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(38, 92%, 50%)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Area-wise Revenue */}
        {data.areaRevenue.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Area-wise MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.areaRevenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="revenue"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {data.areaRevenue.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number) => [`৳${value.toLocaleString()}`, "Revenue"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Customer Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Customer Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">Active Customers</span>
                <span className="text-lg font-bold text-[hsl(var(--status-active))]">
                  {data.activeCustomers}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">New This Month</span>
                <span className="text-lg font-bold text-primary">
                  +{data.newCustomers}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">Expired Customers</span>
                <span className="text-lg font-bold text-[hsl(var(--status-expired))]">
                  {data.lostCustomers}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">Churn Rate</span>
                <span className="text-lg font-bold text-[hsl(var(--status-expiring))]">
                  {data.churnRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
