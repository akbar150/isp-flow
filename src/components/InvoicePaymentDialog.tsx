import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign } from "lucide-react";

interface InvoicePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    customer_id: string;
    total: number;
    amount_paid: number;
  };
  customerName: string;
  onSuccess: () => void;
}

export function InvoicePaymentDialog({
  open,
  onOpenChange,
  invoice,
  customerName,
  onSuccess,
}: InvoicePaymentDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: (invoice.total - invoice.amount_paid).toString(),
    method: "cash" as "bkash" | "cash" | "bank_transfer",
    transaction_id: "",
    notes: "",
  });

  const balanceDue = invoice.total - invoice.amount_paid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const { data: userData } = await supabase.auth.getUser();
      const newAmountPaid = invoice.amount_paid + amount;
      const newStatus = newAmountPaid >= invoice.total ? "paid" : "partial";

      // 1. Update invoice status and amount_paid
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      // 2. Update the linked transaction's payment method (if exists)
      await supabase
        .from("transactions")
        .update({ payment_method: formData.method })
        .eq("reference_id", invoice.id);

      // 3. Create a payment record for tracking
      const { error: paymentError } = await supabase.from("payments").insert({
        customer_id: invoice.customer_id,
        amount: amount,
        method: formData.method,
        transaction_id: formData.transaction_id || null,
        notes: formData.notes || `Payment for Invoice #${invoice.invoice_number}`,
        created_by: userData.user?.id,
        remaining_due: Math.max(0, balanceDue - amount),
      });

      if (paymentError) throw paymentError;

      // 4. Update customer's total_due
      const { data: customer } = await supabase
        .from("customers")
        .select("total_due")
        .eq("id", invoice.customer_id)
        .single();

      if (customer) {
        await supabase
          .from("customers")
          .update({ total_due: Math.max(0, (customer.total_due || 0) - amount) })
          .eq("id", invoice.customer_id);
      }

      toast({
        title: "Payment recorded",
        description: `৳${amount.toLocaleString()} collected via ${formData.method.replace("_", " ")}`,
      });

      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            Record payment for Invoice #{invoice.invoice_number} from {customerName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Invoice Total</p>
              <p className="text-lg font-bold">৳{invoice.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance Due</p>
              <p className="text-lg font-bold text-destructive">৳{balanceDue.toLocaleString()}</p>
            </div>
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
                min="0"
                max={balanceDue}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(value: "bkash" | "cash" | "bank_transfer") =>
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

          {(formData.method === "bkash" || formData.method === "bank_transfer") && (
            <div className="space-y-2">
              <Label>Transaction ID (optional)</Label>
              <Input
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                placeholder={formData.method === "bkash" ? "bKash TrxID" : "Bank Reference"}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
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
              onClick={() => setFormData({ ...formData, amount: balanceDue.toString() })}
              className="flex-1"
            >
              Full Amount (৳{balanceDue.toLocaleString()})
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
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
