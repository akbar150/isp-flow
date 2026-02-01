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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Cable, Package } from "lucide-react";

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

interface MeteredProduct {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  purchase_price: number;
  selling_price: number;
  metered_quantity: number | null;
  product_categories: {
    id: string;
    name: string;
    is_metered: boolean;
    unit_of_measure: string | null;
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
  const [meteredProducts, setMeteredProducts] = useState<MeteredProduct[]>([]);
  const [activeTab, setActiveTab] = useState<"discrete" | "metered">("discrete");
  
  // Discrete item form
  const [selectedItemId, setSelectedItemId] = useState("");
  const [accountType, setAccountType] = useState<"free" | "paid">("free");
  const [condition, setCondition] = useState("New");
  const [sellingPrice, setSellingPrice] = useState(0);
  const [technicianName, setTechnicianName] = useState("");
  const [notes, setNotes] = useState("");

  // Metered product form
  const [selectedMeteredProductId, setSelectedMeteredProductId] = useState("");
  const [metersToAssign, setMetersToAssign] = useState(0);
  const [meteredAccountType, setMeteredAccountType] = useState<"free" | "paid">("free");
  const [meteredTechnicianName, setMeteredTechnicianName] = useState("");
  const [meteredNotes, setMeteredNotes] = useState("");

  useEffect(() => {
    if (open) {
      fetchData();
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
    setSelectedMeteredProductId("");
    setMetersToAssign(0);
    setMeteredAccountType("free");
    setMeteredTechnicianName("");
    setMeteredNotes("");
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch discrete inventory items - include in_stock items
      // Note: Returned items in Good/Fair condition are set to "in_stock" status
      const { data: items, error: itemsError } = await supabase
        .from("inventory_items")
        .select("id, product_id, serial_number, mac_address, status, purchase_price, products(id, name, brand, model, purchase_price, selling_price)")
        .eq("status", "in_stock")
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;
      setAvailableItems(items || []);

      // Fetch metered products with stock > 0
      const { data: metered, error: meteredError } = await supabase
        .from("products")
        .select("id, name, brand, model, purchase_price, selling_price, metered_quantity, product_categories(id, name, is_metered, unit_of_measure)")
        .eq("product_categories.is_metered", true)
        .gt("metered_quantity", 0);

      if (meteredError) throw meteredError;
      setMeteredProducts((metered || []).filter(p => p.product_categories?.is_metered));
    } catch (error) {
      console.error("Error fetching data:", error);
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
  const selectedMeteredProduct = meteredProducts.find((p) => p.id === selectedMeteredProductId);
  const meteredUnit = selectedMeteredProduct?.product_categories?.unit_of_measure || "meter";
  const availableMeters = selectedMeteredProduct?.metered_quantity || 0;
  const pricePerUnit = selectedMeteredProduct?.selling_price || 0;
  const costPerUnit = selectedMeteredProduct?.purchase_price || 0;
  const totalPrice = metersToAssign * pricePerUnit;
  const totalCost = metersToAssign * costPerUnit;
  const profit = totalPrice - totalCost;

  useEffect(() => {
    if (selectedItem?.products?.selling_price) {
      setSellingPrice(selectedItem.products.selling_price);
    }
  }, [selectedItemId, selectedItem]);

  // Handle discrete item assignment
  const handleSubmitDiscrete = async () => {
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
        await createInvoiceForAssignment(
          selectedItem?.products?.name || "Product",
          selectedItem?.mac_address || selectedItem?.serial_number || "N/A",
          sellingPrice,
          purchasePrice
        );
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

  // Handle metered product assignment (e.g., 400 meters of cable)
  const handleSubmitMetered = async () => {
    if (!selectedMeteredProductId) {
      toast({ title: "Error", description: "Please select a product", variant: "destructive" });
      return;
    }
    if (metersToAssign <= 0) {
      toast({ title: "Error", description: `Please enter ${meteredUnit}s to assign`, variant: "destructive" });
      return;
    }
    if (metersToAssign > availableMeters) {
      toast({ title: "Error", description: `Only ${availableMeters} ${meteredUnit}(s) available`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Log the metered usage with account_type and selling_price
      const { error: usageError } = await supabase
        .from("metered_usage_logs")
        .insert({
          product_id: selectedMeteredProductId,
          customer_id: customerId,
          quantity_used: metersToAssign,
          usage_type: "assignment",
          technician_name: meteredTechnicianName || null,
          notes: meteredNotes || null,
          usage_date: new Date().toISOString().split("T")[0],
          account_type: meteredAccountType,
          selling_price: meteredAccountType === "paid" ? totalPrice : 0,
        });

      if (usageError) throw usageError;

      // Deduct from product's metered_quantity
      const { error: updateError } = await supabase
        .from("products")
        .update({ metered_quantity: availableMeters - metersToAssign })
        .eq("id", selectedMeteredProductId);

      if (updateError) throw updateError;

      // If paid, create invoice
      if (meteredAccountType === "paid" && totalPrice > 0) {
        await createInvoiceForAssignment(
          `${selectedMeteredProduct?.name} (${metersToAssign} ${meteredUnit})`,
          `${metersToAssign} ${meteredUnit}`,
          totalPrice,
          totalCost
        );
      }

      toast({ title: `${metersToAssign} ${meteredUnit}(s) assigned successfully` });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error assigning metered product:", error);
      toast({
        title: "Error",
        description: "Failed to assign product",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createInvoiceForAssignment = async (
    productName: string,
    identifier: string,
    sellingAmount: number,
    purchaseAmount: number
  ) => {
    const { data: invoiceNum } = await supabase.rpc("generate_invoice_number");

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        customer_id: customerId,
        invoice_number: invoiceNum || `INV-${Date.now()}`,
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        subtotal: sellingAmount,
        total: sellingAmount,
        status: "sent",
        notes: `Asset assignment: ${productName}`,
      })
      .select()
      .single();

    if (!invoiceError && invoice) {
      await supabase.from("invoice_items").insert({
        invoice_id: invoice.id,
        description: `${productName} (${identifier})`,
        quantity: 1,
        unit_price: sellingAmount,
        total: sellingAmount,
      });

      // Increment customer's total due
      const { data: customer } = await supabase
        .from("customers")
        .select("total_due")
        .eq("id", customerId)
        .single();

      if (customer) {
        await supabase
          .from("customers")
          .update({ total_due: (customer.total_due || 0) + sellingAmount })
          .eq("id", customerId);
      }

      // Calculate profit and create income transaction for actual profit only
      const actualProfit = sellingAmount - purchaseAmount;
      
      // Create income transaction for PROFIT (not selling price)
      // This reflects actual earnings, not revenue
      await supabase.from("transactions").insert({
        type: "income",
        amount: actualProfit,
        description: `Asset profit from ${customerName}: ${productName} (Sold: ৳${sellingAmount}, Cost: ৳${purchaseAmount})`,
        payment_method: "due",
        transaction_date: new Date().toISOString().split("T")[0],
        reference_id: invoice.id,
      });
    }
  };

  const discretePurchasePrice = selectedItem?.purchase_price || selectedItem?.products?.purchase_price || 0;
  const discreteProfit = sellingPrice - discretePurchasePrice;

  const hasDiscreteItems = availableItems.length > 0;
  const hasMeteredProducts = meteredProducts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Product to {customerName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasDiscreteItems && !hasMeteredProducts ? (
          <div className="py-6 text-center">
            <p className="text-muted-foreground">No available items in stock.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add items in the Inventory module first.
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "discrete" | "metered")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="discrete" className="gap-2" disabled={!hasDiscreteItems}>
                <Package className="h-4 w-4" />
                Devices ({availableItems.length})
              </TabsTrigger>
              <TabsTrigger value="metered" className="gap-2" disabled={!hasMeteredProducts}>
                <Cable className="h-4 w-4" />
                Cable/Metered ({meteredProducts.length})
              </TabsTrigger>
            </TabsList>

            {/* DISCRETE ITEMS TAB */}
            <TabsContent value="discrete" className="space-y-4 mt-4">
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
                      <span className="ml-1 font-medium">৳{discretePurchasePrice}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Profit:</span>
                      <span className={`ml-1 font-medium ${discreteProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                        ৳{discreteProfit}
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
            </TabsContent>

            {/* METERED PRODUCTS TAB */}
            <TabsContent value="metered" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Cable/Metered Product *</Label>
                <Select value={selectedMeteredProductId} onValueChange={setSelectedMeteredProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {meteredProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {product.metered_quantity} {product.product_categories?.unit_of_measure || "meter"} available
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMeteredProduct && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{selectedMeteredProduct.name}</p>
                  <p className="text-muted-foreground">
                    {selectedMeteredProduct.brand} {selectedMeteredProduct.model}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {availableMeters} {meteredUnit} available
                    </Badge>
                    <Badge variant="outline">
                      ৳{pricePerUnit}/{meteredUnit}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="p-4 border-2 border-primary/30 rounded-lg bg-primary/5 space-y-3">
                <Label className="text-base font-medium">{meteredUnit}s to Assign *</Label>
                <Input
                  type="number"
                  min={1}
                  max={availableMeters}
                  value={metersToAssign}
                  onChange={(e) => setMetersToAssign(Number(e.target.value))}
                  placeholder={`Enter ${meteredUnit}s to assign`}
                  className="text-lg"
                />
                {metersToAssign > availableMeters && (
                  <p className="text-sm text-destructive">
                    Only {availableMeters} {meteredUnit}(s) available!
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select value={meteredAccountType} onValueChange={(v) => setMeteredAccountType(v as "free" | "paid")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (No Invoice)</SelectItem>
                    <SelectItem value="paid">Paid (Generate Invoice)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {meteredAccountType === "paid" && metersToAssign > 0 && (
                <div className="space-y-2 p-3 border rounded-lg bg-card">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Price:</span>
                      <p className="font-medium text-lg">৳{totalPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost:</span>
                      <p className="font-medium">৳{totalCost.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Profit:</span>
                      <p className={`font-medium text-lg ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                        ৳{profit.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metersToAssign} {meteredUnit} × ৳{pricePerUnit}/{meteredUnit}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Technician Name</Label>
                <Input
                  value={meteredTechnicianName}
                  onChange={(e) => setMeteredTechnicianName(e.target.value)}
                  placeholder="Name of installing technician"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={meteredNotes}
                  onChange={(e) => setMeteredNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === "discrete" ? (
            <Button
              onClick={handleSubmitDiscrete}
              disabled={saving || !selectedItemId || !hasDiscreteItems}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign Product
            </Button>
          ) : (
            <Button
              onClick={handleSubmitMetered}
              disabled={saving || !selectedMeteredProductId || metersToAssign <= 0 || metersToAssign > availableMeters}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign {metersToAssign} {meteredUnit}(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
