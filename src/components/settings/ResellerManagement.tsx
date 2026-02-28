import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Store, Users, DollarSign, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";

interface Reseller {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  commission_rate: number;
  status: string;
  reseller_code: string;
  created_at: string;
}

interface Commission {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  customers: { full_name: string } | null;
}

export function ResellerManagement() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    commission_rate: "10",
    password: "",
  });

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    const { data } = await supabase
      .from("resellers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setResellers(data as any);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name || !form.phone || !form.password) {
      toast({ title: "Name, phone and password are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Generate code via RPC
      const { data: code } = await supabase.rpc("generate_reseller_code");
      // Hash password
      const { data: hash } = await supabase.rpc("hash_password", { raw_password: form.password });

      const { error } = await supabase.from("resellers").insert({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        commission_rate: parseFloat(form.commission_rate) || 10,
        password_hash: hash,
        reseller_code: code,
      });

      if (error) throw error;
      toast({ title: "Reseller created", description: `Code: ${code}` });
      setAddOpen(false);
      setForm({ name: "", phone: "", email: "", address: "", commission_rate: "10", password: "" });
      fetchResellers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (reseller: Reseller) => {
    const newStatus = reseller.status === "active" ? "inactive" : "active";
    await supabase.from("resellers").update({ status: newStatus }).eq("id", reseller.id);
    fetchResellers();
    toast({ title: `Reseller ${newStatus}` });
  };

  const viewCommissions = async (reseller: Reseller) => {
    setSelectedReseller(reseller);
    setCommissionOpen(true);
    const { data } = await supabase
      .from("reseller_commissions")
      .select("id, amount, status, created_at, customers:customer_id(full_name)")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCommissions(data as any);
  };

  const markCommissionPaid = async (commissionId: string) => {
    await supabase.from("reseller_commissions").update({ status: "paid" }).eq("id", commissionId);
    if (selectedReseller) viewCommissions(selectedReseller);
    toast({ title: "Commission marked as paid" });
  };

  const markAllPaid = async () => {
    if (!selectedReseller) return;
    await supabase
      .from("reseller_commissions")
      .update({ status: "paid" })
      .eq("reseller_id", selectedReseller.id)
      .eq("status", "pending");
    viewCommissions(selectedReseller);
    toast({ title: "All pending commissions marked as paid" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Store className="h-5 w-5" />
            Reseller Management
          </h3>
          <p className="text-sm text-muted-foreground">Manage sub-dealers and their commissions</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Reseller
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Reseller</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reseller name" />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
              </div>
              <div className="space-y-2">
                <Label>Commission Rate (%)</Label>
                <Input type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Login password" />
              </div>
              <Button onClick={handleAdd} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Reseller
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resellers table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resellers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No resellers yet. Add your first sub-dealer.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellers.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.reseller_code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell>{r.commission_rate}%</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(r.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => viewCommissions(r)}>
                            <Eye className="h-3 w-3 mr-1" />
                            Commissions
                          </Button>
                          <Button
                            variant={r.status === "active" ? "secondary" : "default"}
                            size="sm"
                            onClick={() => toggleStatus(r)}
                          >
                            {r.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission dialog */}
      <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Commissions - {selectedReseller?.name} ({selectedReseller?.reseller_code})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={markAllPaid}>
                <DollarSign className="h-4 w-4 mr-1" />
                Mark All Pending as Paid
              </Button>
            </div>
            {commissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No commissions yet</p>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>{c.customers?.full_name || "—"}</TableCell>
                        <TableCell className="font-semibold">৳{Number(c.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "paid" ? "default" : "secondary"}>{c.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {c.status === "pending" && (
                            <Button variant="outline" size="sm" onClick={() => markCommissionPaid(c.id)}>
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
