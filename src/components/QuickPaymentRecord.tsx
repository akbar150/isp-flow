import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Banknote, Loader2 } from "lucide-react";

interface QuickPaymentRecordProps {
  customerId: string;
  customerName: string;
  dueAmount: number;
  monthlyPrice: number;
  onSuccess: () => void;
}

export function QuickPaymentRecord({
  customerId,
  customerName,
  dueAmount,
  monthlyPrice,
  onSuccess,
}: QuickPaymentRecordProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: monthlyPrice.toString(),
    method: "cash" as "bkash" | "cash" | "bank_transfer" | "due",
    transaction_id: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("payments").insert({
        customer_id: customerId,
        amount: amount,
        method: formData.method,
        transaction_id: formData.transaction_id || null,
        notes: formData.notes || `Quick payment for ${customerName}`,
        created_by: userData.user?.id,
        remaining_due: Math.max(0, dueAmount - amount),
      });

      if (error) throw error;

      toast({
        title: "Payment recorded",
        description: `৳${amount} payment recorded for ${customerName}`,
      });

      setOpen(false);
      setFormData({
        amount: monthlyPrice.toString(),
        method: "cash",
        transaction_id: "",
        notes: "",
      });
      onSuccess();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-[hsl(var(--status-active))]">
          <Banknote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Payment</DialogTitle>
          <DialogDescription>
            Record payment for {customerName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Current Due</p>
            <p className="text-xl font-bold text-destructive">৳{dueAmount}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter amount"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(value: "bkash" | "cash" | "bank_transfer" | "due") =>
                  setFormData({ ...formData, method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.method === "bkash" && (
            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                placeholder="bKash transaction ID"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({ ...formData, amount: monthlyPrice.toString() })}
              className="flex-1"
            >
              Full Month (৳{monthlyPrice})
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({ ...formData, amount: dueAmount.toString() })}
              className="flex-1"
            >
              Clear Due (৳{dueAmount})
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
