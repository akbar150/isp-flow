import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, AlertTriangle, Shield } from "lucide-react";
import { format } from "date-fns";

interface DataType {
  key: string;
  label: string;
  table: string;
  dateColumn: string;
  description: string;
  /** Lower number deletes first (children first) to avoid FK constraint failures */
  deleteOrder: number;
}

const DATA_TYPES: DataType[] = [
  // Invoices
  { key: "invoice_items", label: "Invoice Items", table: "invoice_items", dateColumn: "created_at", description: "Line items attached to invoices", deleteOrder: 0 },
  { key: "invoices", label: "Invoices", table: "invoices", dateColumn: "issue_date", description: "Invoices generated for customers", deleteOrder: 1 },

  // Customers & billing
  { key: "payments", label: "Payments", table: "payments", dateColumn: "payment_date", description: "Payment collection records", deleteOrder: 2 },
  { key: "billing_records", label: "Billing Records", table: "billing_records", dateColumn: "billing_date", description: "Customer billing cycle records", deleteOrder: 3 },
  { key: "customers", label: "Customers", table: "customers", dateColumn: "created_at", description: "Customer accounts created on selected date", deleteOrder: 9 },

  // Assets / inventory / stock
  { key: "asset_assignments", label: "Assign Asset Records", table: "asset_assignments", dateColumn: "assigned_date", description: "Assigned/returned assets for customers", deleteOrder: 4 },
  { key: "metered_usage_logs", label: "Product Usage / Quantity Logs", table: "metered_usage_logs", dateColumn: "usage_date", description: "Quantity used/consumed logs", deleteOrder: 5 },
  { key: "inventory_items", label: "Inventory Items (Stock)", table: "inventory_items", dateColumn: "created_at", description: "Individual stock items (serial/MAC/etc)", deleteOrder: 6 },
  { key: "products", label: "Products", table: "products", dateColumn: "created_at", description: "Product master list with quantities", deleteOrder: 7 },
  { key: "product_categories", label: "Product Categories", table: "product_categories", dateColumn: "created_at", description: "Product category definitions", deleteOrder: 8 },

  // Operations
  { key: "call_records", label: "Call Records", table: "call_records", dateColumn: "call_date", description: "Customer call logs", deleteOrder: 10 },
  { key: "reminder_logs", label: "Reminder Logs", table: "reminder_logs", dateColumn: "sent_at", description: "Sent reminder notifications", deleteOrder: 11 },
  { key: "transactions", label: "Financial Transaction Records", table: "transactions", dateColumn: "transaction_date", description: "Accounting transactions", deleteOrder: 12 },
  { key: "activity_logs", label: "Activity Logs", table: "activity_logs", dateColumn: "created_at", description: "System activity logs", deleteOrder: 13 },
  { key: "attendance", label: "Attendance", table: "attendance", dateColumn: "date", description: "Employee attendance records", deleteOrder: 14 },
];

const TIMESTAMP_COLUMNS = new Set(["created_at", "sent_at", "call_date"]);

function isTimestampColumn(column: string) {
  return TIMESTAMP_COLUMNS.has(column);
}

function getOrderedSelectedTypes(selectedTypes: string[]) {
  return selectedTypes
    .map((key) => DATA_TYPES.find((t) => t.key === key))
    .filter((t): t is DataType => !!t)
    .sort((a, b) => a.deleteOrder - b.deleteOrder);
}

export function DataResetPanel() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [affectedCounts, setAffectedCounts] = useState<Record<string, number>>({});
  const [confirmText, setConfirmText] = useState("");
  const [productResetStock, setProductResetStock] = useState(false);
  const [productResetPrices, setProductResetPrices] = useState(false);
  const [showProductConfirm, setShowProductConfirm] = useState(false);
  const [productConfirmText, setProductConfirmText] = useState("");
  const [productResetting, setProductResetting] = useState(false);
  const [productCount, setProductCount] = useState(0);

  if (!isSuperAdmin) {
    return (
      <div className="p-6 bg-muted rounded-lg border border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="h-5 w-5" />
          <span>Only Super Admins can access data reset functionality</span>
        </div>
      </div>
    );
  }

  const toggleDataType = (key: string) => {
    setSelectedTypes(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handlePreviewReset = async () => {
    if (!dateFrom || !dateTo || selectedTypes.length === 0) {
      toast({ 
        title: "Selection Required", 
        description: "Please select a date range and at least one data type",
        variant: "destructive" 
      });
      return;
    }

    const orderedTypes = getOrderedSelectedTypes(selectedTypes);

    // Get counts for each selected type
    const counts: Record<string, number> = {};
    
    for (const dataType of orderedTypes) {

      try {
        // Build appropriate query based on column type
        let query = supabase.from(dataType.table as any).select('id', { count: 'exact', head: true });
        
        if (isTimestampColumn(dataType.dateColumn)) {
          query = query.gte(dataType.dateColumn, `${dateFrom}T00:00:00`).lte(dataType.dateColumn, `${dateTo}T23:59:59`);
        } else {
          query = query.gte(dataType.dateColumn, dateFrom).lte(dataType.dateColumn, dateTo);
        }

        const { count, error } = await query;
        
          if (!error) {
            counts[dataType.key] = count || 0;
        }
      } catch (err) {
          console.error(`Error counting ${dataType.key}:`, err);
          counts[dataType.key] = 0;
      }
      }

    setAffectedCounts(counts);
    setShowConfirmDialog(true);
  };

  const handleConfirmReset = async () => {
    if (confirmText !== "RESET") {
      toast({ 
        title: "Confirmation Required", 
        description: "Please type RESET to confirm",
        variant: "destructive" 
      });
      return;
    }

    setResetting(true);
    let deletedTotal = 0;
    const errors: string[] = [];

    const orderedTypes = getOrderedSelectedTypes(selectedTypes);

    for (const dataType of orderedTypes) {

      try {
        let query = supabase.from(dataType.table as any).delete();
        
        if (isTimestampColumn(dataType.dateColumn)) {
          query = query.gte(dataType.dateColumn, `${dateFrom}T00:00:00`).lte(dataType.dateColumn, `${dateTo}T23:59:59`);
        } else {
          query = query.gte(dataType.dateColumn, dateFrom).lte(dataType.dateColumn, dateTo);
        }

        const { error } = await query;
        
        if (error) {
          errors.push(`${dataType.label}: ${error.message}`);
        } else {
          deletedTotal += affectedCounts[dataType.key] || 0;
        }
      } catch (err) {
        errors.push(`${dataType.label}: Unknown error`);
      }
    }

    setResetting(false);
    setShowConfirmDialog(false);
    setConfirmText("");
    setSelectedTypes([]);
    setDateFrom("");
    setDateTo("");

    if (errors.length > 0) {
      toast({ 
        title: "Partial Reset Complete", 
        description: `Deleted ${deletedTotal} records. Errors: ${errors.join(", ")}`,
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Data Reset Complete", 
        description: `Successfully deleted ${deletedTotal} records for ${format(new Date(dateFrom), 'dd MMM yyyy')} - ${format(new Date(dateTo), 'dd MMM yyyy')}`
      });
    }
  };

  const totalAffected = Object.values(affectedCounts).reduce((sum, count) => sum + count, 0);


  const handleProductPreview = async () => {
    if (!productResetStock && !productResetPrices) {
      toast({ title: "Selection Required", description: "Select at least one option to reset", variant: "destructive" });
      return;
    }
    const { count, error } = await supabase.from("products" as any).select("id", { count: "exact", head: true });
    if (!error) setProductCount(count || 0);
    setShowProductConfirm(true);
  };

  const handleProductReset = async () => {
    if (productConfirmText !== "RESET") {
      toast({ title: "Confirmation Required", description: "Please type RESET to confirm", variant: "destructive" });
      return;
    }
    setProductResetting(true);
    const errors: string[] = [];

    if (productResetStock) {
      const { error } = await supabase.from("products" as any).update({ stock_quantity: 0, metered_quantity: 0 }).gte("id", "00000000-0000-0000-0000-000000000000");
      if (error) errors.push(`Stock: ${error.message}`);
    }
    if (productResetPrices) {
      const { error } = await supabase.from("products" as any).update({ purchase_price: 0, selling_price: 0 }).gte("id", "00000000-0000-0000-0000-000000000000");
      if (error) errors.push(`Prices: ${error.message}`);
    }

    setProductResetting(false);
    setShowProductConfirm(false);
    setProductConfirmText("");
    setProductResetStock(false);
    setProductResetPrices(false);

    if (errors.length > 0) {
      toast({ title: "Partial Reset", description: errors.join(", "), variant: "destructive" });
    } else {
      toast({ title: "Product Data Reset Complete", description: `Successfully reset data for ${productCount} products` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h4 className="font-medium text-destructive">Danger Zone</h4>
            <p className="text-sm text-muted-foreground">
              This action will permanently delete data for the selected date. This cannot be undone.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select Date Range to Reset</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            All selected data types within this date range will be deleted
          </p>
        </div>

        <div className="space-y-2">
          <Label>Select Data Types to Reset</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {DATA_TYPES.map((dataType) => (
              <div
                key={dataType.key}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedTypes.includes(dataType.key) 
                    ? "border-destructive bg-destructive/5" 
                    : "border-border hover:border-muted-foreground"
                }`}
                onClick={() => toggleDataType(dataType.key)}
              >
                <Checkbox
                  checked={selectedTypes.includes(dataType.key)}
                  onCheckedChange={() => toggleDataType(dataType.key)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{dataType.label}</div>
                  <div className="text-xs text-muted-foreground">{dataType.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button 
          variant="destructive" 
          onClick={handlePreviewReset}
          disabled={!dateFrom || !dateTo || selectedTypes.length === 0}
          className="w-full sm:w-auto"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Preview Reset
        </Button>
      </div>

      {/* Product Data Reset Section */}
      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg mt-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h4 className="font-medium text-destructive">Reset Product Data</h4>
            <p className="text-sm text-muted-foreground">
              Reset stock quantities and/or prices for all products to zero. Products themselves will not be deleted.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              productResetStock ? "border-destructive bg-destructive/5" : "border-border hover:border-muted-foreground"
            }`}
            onClick={() => setProductResetStock(!productResetStock)}
          >
            <Checkbox checked={productResetStock} onCheckedChange={() => setProductResetStock(!productResetStock)} className="mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm">Reset Stock Quantities</div>
              <div className="text-xs text-muted-foreground">Sets stock_quantity and metered_quantity to 0 for all products</div>
            </div>
          </div>
          <div
            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              productResetPrices ? "border-destructive bg-destructive/5" : "border-border hover:border-muted-foreground"
            }`}
            onClick={() => setProductResetPrices(!productResetPrices)}
          >
            <Checkbox checked={productResetPrices} onCheckedChange={() => setProductResetPrices(!productResetPrices)} className="mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm">Reset Prices</div>
              <div className="text-xs text-muted-foreground">Sets purchase_price and selling_price to 0 for all products</div>
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          onClick={handleProductPreview}
          disabled={!productResetStock && !productResetPrices}
          className="w-full sm:w-auto"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Preview Product Reset
        </Button>
      </div>

      {/* Date-range confirm dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Reset
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You are about to permanently delete <strong>{totalAffected} records</strong> for{" "}
                <strong>{dateFrom && format(new Date(dateFrom), 'dd MMM yyyy')} - {dateTo && format(new Date(dateTo), 'dd MMM yyyy')}</strong>
              </p>
              
              <div className="bg-muted p-3 rounded-lg space-y-1">
                {getOrderedSelectedTypes(selectedTypes).map((dataType) => (
                  <div key={dataType.key} className="flex justify-between text-sm">
                    <span>{dataType.label}</span>
                    <span className="font-mono">{affectedCounts[dataType.key] || 0} records</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-text">Type <strong>RESET</strong> to confirm</Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={confirmText !== "RESET" || resetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {resetting ? "Resetting..." : "Delete Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Product reset confirm dialog */}
      <AlertDialog open={showProductConfirm} onOpenChange={setShowProductConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Product Data Reset
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>You are about to reset data for <strong>{productCount} products</strong>:</p>
              <div className="bg-muted p-3 rounded-lg space-y-1">
                {productResetStock && (
                  <div className="text-sm">• Stock quantities → 0</div>
                )}
                {productResetPrices && (
                  <div className="text-sm">• Purchase & selling prices → 0</div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-confirm-text">Type <strong>RESET</strong> to confirm</Label>
                <Input
                  id="product-confirm-text"
                  value={productConfirmText}
                  onChange={(e) => setProductConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleProductReset}
              disabled={productConfirmText !== "RESET" || productResetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {productResetting ? "Resetting..." : "Reset Product Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
