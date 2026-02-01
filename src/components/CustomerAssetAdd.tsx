import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InventoryItem {
  id: string;
  product_id: string;
  serial_number: string | null;
  mac_address: string | null;
  status: string;
  purchase_price: number | null;
  products: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    purchase_price: number;
    selling_price: number;
  } | null;
}

interface CustomerAssetAddProps {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const conditionOptions = ["New", "Good", "Fair", "Refurbished"];

export function CustomerAssetAdd({
  customerId,
  customerName,
  open,
  onOpenChange,
  onSuccess,
}: CustomerAssetAddProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  
  const [selectedItemId, setSelectedItemId] = useState("");
  const [accountType, setAccountType] = useState<"free" | "paid">("free");
  const [condition, setCondition] = useState("New");
  const [sellingPrice, setSellingPrice] = useState(0);
  const [technicianName, setTechnicianName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      fetchAvailableItems();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedItemId("");
    setAccountType("free");
    setCondition("New");
    setSellingPrice(0);
    setTechnicianName("");
    setNotes("");
  };

  const fetchAvailableItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, product_id, serial_number, mac_address, status, purchase_price, products(id, name, brand, model, purchase_price, selling_price)")
        .eq("status", "in_stock")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvailableItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      toast({
        title: "Error",
        description: "Failed to load available items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = availableItems.find((i) => i.id === selectedItemId);

  useEffect(() => {
    if (selectedItem?.products?.selling_price) {
      setSellingPrice(selectedItem.products.selling_price);
    }
  }, [selectedItemId, selectedItem]);

  const handleSubmit = async () => {
    if (!selectedItemId) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const purchasePrice = selectedItem?.purchase_price || selectedItem?.products?.purchase_price || 0;

      // Create asset assignment
      const { error: assignmentError } = await supabase
        .from("asset_assignments")
        .insert({
          customer_id: customerId,
          inventory_item_id: selectedItemId,
          assigned_date: new Date().toISOString().split("T")[0],
          condition_on_assign: condition,
          item_condition: condition,
          technician_name: technicianName || null,
          notes: notes || null,
          account_type: accountType,
          selling_price: accountType === "paid" ? sellingPrice : 0,
          purchase_price_at_assign: purchasePrice,
        });

      if (assignmentError) throw assignmentError;

      // Update inventory item status
      const { error: itemError } = await supabase
        .from("inventory_items")
        .update({ status: "assigned" })
        .eq("id", selectedItemId);

      if (itemError) throw itemError;

      // Update product stock quantity
      if (selectedItem?.product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", selectedItem.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ stock_quantity: Math.max(0, product.stock_quantity - 1) })
            .eq("id", selectedItem.product_id);
        }
      }

      // If paid, create invoice
      if (accountType === "paid" && sellingPrice > 0) {
        const { data: invoiceNum } = await supabase.rpc("generate_invoice_number");

        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            customer_id: customerId,
            invoice_number: invoiceNum || `INV-${Date.now()}`,
            issue_date: new Date().toISOString().split("T")[0],
            due_date: new Date().toISOString().split("T")[0],
            subtotal: sellingPrice,
            total: sellingPrice,
            status: "sent",
            notes: `Asset assignment: ${selectedItem?.products?.name || "Product"}`,
          })
          .select()
          .single();

        if (!invoiceError && invoice) {
          await supabase.from("invoice_items").insert({
            invoice_id: invoice.id,
            description: `${selectedItem?.products?.name || "Product"} (${selectedItem?.mac_address || selectedItem?.serial_number || "N/A"})`,
            quantity: 1,
            unit_price: sellingPrice,
            total: sellingPrice,
          });

          // Add to customer's total due
          await supabase
            .from("customers")
            .update({ total_due: supabase.rpc ? undefined : sellingPrice })
            .eq("id", customerId);

          // Actually increment due
          const { data: customer } = await supabase
            .from("customers")
            .select("total_due")
            .eq("id", customerId)
            .single();

          if (customer) {
            await supabase
              .from("customers")
              .update({ total_due: (customer.total_due || 0) + sellingPrice })
              .eq("id", customerId);
          }

          // Create income transaction
          const profit = sellingPrice - purchasePrice;
          await supabase.from("transactions").insert({
            type: "income",
            amount: sellingPrice,
            description: `Asset sold to ${customerName}: ${selectedItem?.products?.name}`,
            payment_method: "due",
            transaction_date: new Date().toISOString().split("T")[0],
            reference_id: invoice.id,
          });
        }
      }

      toast({ title: "Product assigned successfully" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error assigning product:", error);
      toast({
        title: "Error",
        description: "Failed to assign product",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const purchasePrice = selectedItem?.purchase_price || selectedItem?.products?.purchase_price || 0;
  const profit = sellingPrice - purchasePrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Product to {customerName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableItems.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground">No available items in stock.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add items in the Inventory module first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Product *</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an item..." />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.products?.name} - {item.mac_address || item.serial_number || "N/A"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedItem && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selectedItem.products?.name}</p>
                <p className="text-muted-foreground">
                  {selectedItem.products?.brand} {selectedItem.products?.model}
                </p>
                <p className="text-muted-foreground font-mono text-xs mt-1">
                  {selectedItem.mac_address || selectedItem.serial_number}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as "free" | "paid")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (No Invoice)</SelectItem>
                    <SelectItem value="paid">Paid (Generate Invoice)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {accountType === "paid" && (
              <div className="space-y-3 p-3 border rounded-lg bg-card">
                <div className="space-y-2">
                  <Label>Selling Price (৳)</Label>
                  <Input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    min={0}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Purchase:</span>
                    <span className="ml-1 font-medium">৳{purchasePrice}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profit:</span>
                    <span className={`ml-1 font-medium ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                      ৳{profit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Technician Name</Label>
              <Input
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Name of installing technician"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !selectedItemId || availableItems.length === 0}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
