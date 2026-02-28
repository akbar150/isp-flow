import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Plus, Loader2, Download, Eye } from "lucide-react";
import { format } from "date-fns";

interface Contract {
  id: string;
  customer_id: string;
  template_id: string | null;
  start_date: string;
  end_date: string;
  terms_text: string;
  auto_renew: boolean;
  early_termination_fee: number;
  signature_data: string | null;
  signed_at: string | null;
  status: string;
  created_at: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  body_template: string;
  is_default: boolean;
}

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  package_id: string | null;
  packages?: { name: string; monthly_price: number } | null;
}

interface ContractManagerProps {
  customer: Customer;
  ispName?: string;
}

export default function ContractManager({ customer, ispName = "ISP" }: ContractManagerProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    template_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    terms_text: "",
    auto_renew: false,
    early_termination_fee: 0,
  });

  useEffect(() => {
    fetchData();
  }, [customer.id]);

  const fetchData = async () => {
    try {
      const [contractsRes, templatesRes] = await Promise.all([
        supabase
          .from("contracts")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false }),
        supabase.from("contract_templates").select("*").order("is_default", { ascending: false }),
      ]);

      if (contractsRes.error) throw contractsRes.error;
      setContracts((contractsRes.data as Contract[]) || []);
      setTemplates((templatesRes.data as ContractTemplate[]) || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    let body = template.body_template;
    body = body.replace(/\{CustomerName\}/g, customer.full_name);
    body = body.replace(/\{CustomerID\}/g, customer.user_id);
    body = body.replace(/\{PackageName\}/g, customer.packages?.name || "N/A");
    body = body.replace(/\{MonthlyPrice\}/g, String(customer.packages?.monthly_price || 0));
    body = body.replace(/\{StartDate\}/g, formData.start_date);
    body = body.replace(/\{EndDate\}/g, formData.end_date);
    body = body.replace(/\{ISPName\}/g, ispName);

    setFormData({ ...formData, template_id: templateId, terms_text: body });
  };

  const handleCreate = async () => {
    if (!formData.terms_text.trim()) {
      toast({ title: "Error", description: "Contract terms are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("contracts").insert({
        customer_id: customer.id,
        template_id: formData.template_id || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        terms_text: formData.terms_text,
        auto_renew: formData.auto_renew,
        early_termination_fee: formData.early_termination_fee,
        status: "pending_signature",
      });

      if (error) throw error;
      toast({ title: "Contract created and sent for signature" });
      setCreateOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create contract", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      pending_signature: "bg-yellow-100 text-yellow-800",
      active: "bg-green-100 text-green-800",
      expired: "bg-red-100 text-red-800",
      terminated: "bg-destructive/10 text-destructive",
    };
    return <Badge className={colors[status] || ""}>{status.replace("_", " ")}</Badge>;
  };

  const exportContractText = (contract: Contract) => {
    const blob = new Blob([contract.terms_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract-${customer.user_id}-${format(new Date(contract.start_date), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Contracts
        </h4>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Contract
        </Button>
      </div>

      {contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No contracts for this customer.</p>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <div key={contract.id} className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getStatusBadge(contract.status)}
                  {contract.signed_at && (
                    <span className="text-xs text-muted-foreground">
                      Signed: {format(new Date(contract.signed_at), "dd MMM yyyy")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(contract.start_date), "dd MMM yyyy")} → {format(new Date(contract.end_date), "dd MMM yyyy")}
                  {contract.auto_renew && " (Auto-renew)"}
                </p>
                {contract.early_termination_fee > 0 && (
                  <p className="text-xs text-muted-foreground">Termination fee: ৳{contract.early_termination_fee}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewContract(contract)}>
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportContractText(contract)}>
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Contract for {customer.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Use Template</Label>
                <Select value={formData.template_id} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " (Default)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Early Termination Fee (৳)</Label>
              <Input
                type="number"
                value={formData.early_termination_fee}
                onChange={(e) => setFormData({ ...formData, early_termination_fee: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.auto_renew}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_renew: checked })}
              />
              <Label>Auto-renew contract</Label>
            </div>
            <div className="space-y-2">
              <Label>Contract Terms</Label>
              <Textarea
                value={formData.terms_text}
                onChange={(e) => setFormData({ ...formData, terms_text: e.target.value })}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {saving ? "Creating..." : "Create & Send for Signature"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
          </DialogHeader>
          {viewContract && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(viewContract.status)}
                {viewContract.auto_renew && <Badge variant="outline">Auto-renew</Badge>}
              </div>
              <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
                {viewContract.terms_text}
              </div>
              {viewContract.signature_data && (
                <div className="space-y-2">
                  <Label>Customer Signature</Label>
                  <div className="border rounded-lg p-2 bg-background">
                    <img src={viewContract.signature_data} alt="Signature" className="max-h-32" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Signed on: {viewContract.signed_at ? format(new Date(viewContract.signed_at), "dd MMM yyyy HH:mm") : "N/A"}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
