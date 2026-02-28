import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AreaBreakdown {
  name: string;
  total: number;
  active: number;
  expired: number;
  due: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function AreaBreakdownWidget() {
  const [data, setData] = useState<AreaBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAreaData();
  }, []);

  const fetchAreaData = async () => {
    try {
      const [areasRes, customersRes] = await Promise.all([
        supabase.from("areas").select("id, name"),
        supabase.from("customers_safe").select("area_id, status, total_due, expiry_date"),
      ]);

      const areas = areasRes.data || [];
      const customers = customersRes.data || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const breakdown: AreaBreakdown[] = areas.map((area) => {
        const areaCustomers = customers.filter((c) => c.area_id === area.id);
        const active = areaCustomers.filter((c) => {
          const exp = new Date(c.expiry_date);
          return exp >= today;
        }).length;
        const expired = areaCustomers.length - active;
        const due = areaCustomers.reduce((sum, c) => sum + (Number(c.total_due) || 0), 0);

        return { name: area.name, total: areaCustomers.length, active, expired, due };
      });

      // Add "No Area" for unassigned
      const noArea = customers.filter((c) => !c.area_id);
      if (noArea.length > 0) {
        const active = noArea.filter((c) => new Date(c.expiry_date) >= today).length;
        breakdown.push({
          name: "No Area",
          total: noArea.length,
          active,
          expired: noArea.length - active,
          due: noArea.reduce((sum, c) => sum + (Number(c.total_due) || 0), 0),
        });
      }

      // Sort by total customers desc
      breakdown.sort((a, b) => b.total - a.total);

      setData(breakdown);
    } catch (error) {
      console.error("Error fetching area breakdown:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="form-section animate-pulse h-64">
        <div className="h-full bg-muted rounded" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="form-section text-center py-8 text-muted-foreground">
        No areas configured yet.
      </div>
    );
  }

  return (
    <div className="form-section">
      <h2 className="form-section-title">Area-wise Customer Breakdown</h2>
      
      {/* Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              formatter={(value: number) => [value, "Customers"]}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Area</th>
              <th className="text-right">Total</th>
              <th className="text-right">Active</th>
              <th className="text-right">Expired</th>
              <th className="text-right">Total Due</th>
            </tr>
          </thead>
          <tbody>
            {data.map((area) => (
              <tr key={area.name}>
                <td className="font-medium">{area.name}</td>
                <td className="text-right">{area.total}</td>
                <td className="text-right text-green-600">{area.active}</td>
                <td className="text-right text-destructive">{area.expired}</td>
                <td className="text-right font-medium">৳{area.due.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="font-semibold border-t-2">
              <td>Total</td>
              <td className="text-right">{data.reduce((s, a) => s + a.total, 0)}</td>
              <td className="text-right text-green-600">{data.reduce((s, a) => s + a.active, 0)}</td>
              <td className="text-right text-destructive">{data.reduce((s, a) => s + a.expired, 0)}</td>
              <td className="text-right">৳{data.reduce((s, a) => s + a.due, 0).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
