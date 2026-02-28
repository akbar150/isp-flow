import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Store, Users, DollarSign, LogOut, TrendingUp, Loader2 } from "lucide-react";
import { useIspSettings } from "@/hooks/useIspSettings";
import { format } from "date-fns";

interface ResellerSession {
  id: string;
  name: string;
  reseller_code: string;
  phone: string;
  email: string;
  commission_rate: number;
}

interface CustomerRow {
  id: string;
  customer_id: string;
  created_at: string;
  customers: {
    full_name: string;
    phone: string;
    user_id: string;
    status: string;
    total_due: number;
    expiry_date: string;
    packages: { name: string; monthly_price: number } | null;
  };
}

interface CommissionRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  notes: string | null;
  customers: { full_name: string; user_id: string } | null;
}

export default function ResellerPortal() {
  const navigate = useNavigate();
  const { ispName } = useIspSettings();
  const [reseller, setReseller] = useState<ResellerSession | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("reseller_session");
    if (!session) {
      navigate("/reseller-login");
      return;
    }
    const parsed = JSON.parse(session);
    setReseller(parsed);
    fetchData(parsed.id);
  }, []);

  const fetchData = async (resellerId: string) => {
    try {
      const [custRes, commRes] = await Promise.all([
        supabase
          .from("reseller_customers")
          .select("id, customer_id, created_at, customers(full_name, phone, user_id, status, total_due, expiry_date, packages:package_id(name, monthly_price))")
          .eq("reseller_id", resellerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("reseller_commissions")
          .select("id, amount, status, created_at, notes, customers:customer_id(full_name, user_id)")
          .eq("reseller_id", resellerId)
          .order("created_at", { ascending: false }),
      ]);

      if (custRes.data) setCustomers(custRes.data as any);
      if (commRes.data) setCommissions(commRes.data as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("reseller_session");
    localStorage.removeItem("reseller_token");
    navigate("/reseller-login");
  };

  if (!reseller) return null;

  const totalEarnings = commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const pendingEarnings = commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">{ispName}</h1>
              <p className="text-xs text-muted-foreground">
                Reseller: {reseller.name} ({reseller.reseller_code})
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">My Customers</p>
                  <p className="text-2xl font-bold">{customers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                  <p className="text-2xl font-bold">৳{totalEarnings.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">৳{pendingEarnings.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Store className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commission Rate</p>
                  <p className="text-2xl font-bold">{reseller.commission_rate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="customers">
          <TabsList>
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              My Customers
            </TabsTrigger>
            <TabsTrigger value="commissions">
              <DollarSign className="h-4 w-4 mr-2" />
              Commissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>My Customers</CardTitle>
                <CardDescription>Customers registered under your reseller account</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : customers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No customers yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Expiry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((rc) => (
                          <TableRow key={rc.id}>
                            <TableCell className="font-mono text-sm">{rc.customers?.user_id}</TableCell>
                            <TableCell>{rc.customers?.full_name}</TableCell>
                            <TableCell>{rc.customers?.phone}</TableCell>
                            <TableCell>{rc.customers?.packages?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={rc.customers?.status === "active" ? "default" : "secondary"}>
                                {rc.customers?.status}
                              </Badge>
                            </TableCell>
                            <TableCell>৳{Number(rc.customers?.total_due || 0).toLocaleString()}</TableCell>
                            <TableCell>{rc.customers?.expiry_date ? format(new Date(rc.customers.expiry_date), "dd MMM yyyy") : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
                <CardDescription>Track your earnings from customer payments</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : commissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No commissions yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                            <TableCell>{c.customers?.full_name || "—"}</TableCell>
                            <TableCell className="font-semibold">৳{Number(c.amount).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === "paid" ? "default" : c.status === "pending" ? "secondary" : "destructive"}>
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{c.notes || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
