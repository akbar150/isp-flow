import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AssetAssignment {
  id: string;
  inventory_item_id: string;
  account_type: string | null;
  selling_price: number | null;
  technician_name: string | null;
  condition_on_assign: string | null;
  notes: string | null;
  inventory_items: {
    products: {
      name: string;
      selling_price: number;
      purchase_price: number;
    } | null;
  } | null;
}

interface CustomerAssetEditProps {
  assignment: AssetAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const conditionOptions = ["New", "Good", "Fair", "Poor", "Damaged"];

export function CustomerAssetEdit({ assignment, open, onOpenChange, onSuccess }: CustomerAssetEditProps) {
  const [accountType, setAccountType] = useState(assignment.account_type || "free");
  const [sellingPrice, setSellingPrice] = useState(assignment.selling_price || assignment.inventory_items?.products?.selling_price || 0);
  const [technicianName, setTechnicianName] = useState(assignment.technician_name || "");
  const [condition, setCondition] = useState(assignment.condition_on_assign || "New");
  const [notes, setNotes] = useState(assignment.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("asset_assignments")
        .update({
          account_type: accountType,
          selling_price: accountType === "paid" ? sellingPrice : null,
          technician_name: technicianName || null,
          condition_on_assign: condition,
          notes: notes || null,
        })
        .eq("id", assignment.id);

      if (error) throw error;

      toast({ title: "Success", description: "Assignment updated successfully" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{assignment.inventory_items?.products?.name || "Unknown Product"}</p>
          </div>

          <div className="space-y-2">
            <Label>Account Type *</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free (Loaned)</SelectItem>
                <SelectItem value="paid">Paid (Sold)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accountType === "paid" && (
            <div className="space-y-2">
              <Label>Selling Price *</Label>
              <Input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                placeholder="Enter selling price"
              />
              <p className="text-xs text-muted-foreground">
                Purchase price: ৳{assignment.inventory_items?.products?.purchase_price || 0}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Technician Name</Label>
            <Input
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              placeholder="Who installed this device?"
            />
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
