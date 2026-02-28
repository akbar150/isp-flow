import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, Trash2, FileText, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ContractTemplate {
  id: string;
  name: string;
  body_template: string;
  is_default: boolean;
  created_at: string;
}

export function ContractTemplates() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    body_template: "",
    is_default: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTemplates((data as ContractTemplate[]) || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("contract_templates")
          .update({
            name: formData.name,
            body_template: formData.body_template,
            is_default: formData.is_default,
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_templates")
          .insert({
            name: formData.name,
            body_template: formData.body_template,
            is_default: formData.is_default,
          });
        if (error) throw error;
      }

      toast({ title: editingTemplate ? "Template updated" : "Template created" });
      setDialogOpen(false);
      setEditingTemplate(null);
      setFormData({ name: "", body_template: "", is_default: false });
      fetchTemplates();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const { error } = await supabase.from("contract_templates").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Template deleted" });
      fetchTemplates();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    }
  };

  const openEdit = (template: ContractTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      body_template: template.body_template,
      is_default: template.is_default,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      body_template: `SERVICE AGREEMENT

This agreement is made between {ISPName} ("Provider") and {CustomerName} ("Customer").

Customer ID: {CustomerID}
Package: {PackageName}
Monthly Fee: ৳{MonthlyPrice}
Start Date: {StartDate}
End Date: {EndDate}

TERMS AND CONDITIONS:

1. The Customer agrees to pay the monthly fee on or before the due date.
2. The Provider will deliver internet service at the agreed speed.
3. Early termination may incur a fee as specified in this contract.
4. The Provider reserves the right to suspend service for non-payment.
5. This agreement auto-renews unless either party provides 30 days notice.

SIGNATURES:

Provider: {ISPName}
Customer: ___________________
Date: ___________________`,
      is_default: false,
    });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-4">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="form-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="form-section-title flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Templates
          </h3>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {templates.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No contract templates yet. Create one to get started.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {template.name}
                    </span>
                    {template.is_default && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {template.body_template.substring(0, 150)}...
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(template)}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Available Variables:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <code className="bg-background px-2 py-1 rounded">{'{CustomerName}'}</code>
            <span>Customer's full name</span>
            <code className="bg-background px-2 py-1 rounded">{'{CustomerID}'}</code>
            <span>Customer ID</span>
            <code className="bg-background px-2 py-1 rounded">{'{PackageName}'}</code>
            <span>Package name</span>
            <code className="bg-background px-2 py-1 rounded">{'{MonthlyPrice}'}</code>
            <span>Monthly fee</span>
            <code className="bg-background px-2 py-1 rounded">{'{StartDate}'}</code>
            <span>Contract start date</span>
            <code className="bg-background px-2 py-1 rounded">{'{EndDate}'}</code>
            <span>Contract end date</span>
            <code className="bg-background px-2 py-1 rounded">{'{ISPName}'}</code>
            <span>Your ISP name</span>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Contract Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Service Agreement"
              />
            </div>
            <div className="space-y-2">
              <Label>Template Body</Label>
              <Textarea
                value={formData.body_template}
                onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label>Set as default template</Label>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
