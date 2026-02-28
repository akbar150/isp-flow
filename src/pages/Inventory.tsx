import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { 
  Plus, 
  Search, 
  Package, 
  Boxes,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tag,
  AlertTriangle,
  Loader2,
  Building2,
  ShoppingCart,
  Eye,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle,
  Download,
  FileText,
  RotateCcw,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  requires_serial: boolean;
  requires_mac: boolean;
  is_metered: boolean;
  unit_of_measure: string | null;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean | null;
}

interface Product {
  id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  metered_quantity: number | null;
  min_stock_level: number;
  is_active: boolean;
  product_categories?: ProductCategory | null;
}

interface InventoryItem {
  id: string;
  product_id: string;
  serial_number: string | null;
  mac_address: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  warranty_end_date: string | null;
  status: 'in_stock' | 'assigned' | 'returned' | 'damaged' | 'sold';
  notes: string | null;
  supplier_id: string | null;
  core_count: number | null;
  cable_color: string | null;
  cable_length_m: number | null;
  products?: Product | null;
  suppliers?: Supplier | null;
}

interface AssetAssignment {
  id: string;
  inventory_item_id: string;
  customer_id: string;
  account_type: string | null;
  assigned_date: string;
  returned_date: string | null;
  customers?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
}

const statusColors: Record<string, string> = {
  in_stock: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  returned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  sold: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const cableColors = ["Blue", "Orange", "Green", "Brown", "White", "Yellow", "Red", "Black"];

const PAGE_SIZE = 25;

// Warranty helper
function getWarrantyInfo(warrantyEndDate: string | null) {
  if (!warrantyEndDate) return { label: "N/A", color: "" };
  const daysLeft = differenceInDays(new Date(warrantyEndDate), new Date());
  if (daysLeft < 0) return { label: "Expired", color: "text-red-600 bg-red-50 dark:bg-red-900/20" };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: "text-red-600 bg-red-50 dark:bg-red-900/20" };
  if (daysLeft <= 90) return { label: `${daysLeft}d left`, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" };
  return { label: format(new Date(warrantyEndDate), "dd MMM yyyy"), color: "text-green-600 bg-green-50 dark:bg-green-900/20" };
}

export default function Inventory() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [assetAssignments, setAssetAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockSearchTerm, setStockSearchTerm] = useState("");
  const [stockSearchFilter, setStockSearchFilter] = useState<"all" | "serial" | "supplier" | "product">("all");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<{ id: string; full_name: string; phone: string } | null>(null);
  
  // New: Status filter + pagination
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // New: Bulk selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkActionSaving, setBulkActionSaving] = useState(false);

  // New: Return workflow
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returningItem, setReturningItem] = useState<InventoryItem | null>(null);
  const [returnForm, setReturnForm] = useState({ condition: "good", notes: "" });

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [viewItemsDialogOpen, setViewItemsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({ 
    name: "", 
    description: "",
    requires_serial: false,
    requires_mac: false,
    is_metered: false,
    unit_of_measure: "piece",
  });
  const [productForm, setProductForm] = useState({
    category_id: "",
    name: "",
    brand: "",
    model: "",
    description: "",
    purchase_price: 0,
    selling_price: 0,
    min_stock_level: 0,
  });
  const [itemForm, setItemForm] = useState({
    product_id: "",
    supplier_id: "",
    quantity: 1,
    serial_numbers: [""],
    mac_addresses: [""],
    purchase_date: "",
    purchase_price: 0,
    warranty_end_date: "",
    notes: "",
    core_count: 0,
    cable_color: "",
    cable_length_m: 0,
    metered_quantity: 0,
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });
  const [sellForm, setSellForm] = useState({
    item_id: "",
    selling_price: 0,
    buyer_name: "",
    notes: "",
  });

  const canManage = isSuperAdmin || canCreate("inventory");
  const canEdit = isSuperAdmin || canUpdate("inventory");
  const canRemove = isSuperAdmin || canDelete("inventory");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [categoriesRes, productsRes, itemsRes, suppliersRes, assignmentsRes] = await Promise.all([
        supabase.from("product_categories").select("*").order("name"),
        supabase.from("products").select("*, product_categories(*)").order("name"),
        supabase.from("inventory_items").select("*, products(*, product_categories(*)), suppliers(id, name, contact_person, phone, email, address, is_active)").order("created_at", { ascending: false }),
        supabase.from("suppliers").select("*").eq("is_active", true).order("name"),
        supabase.from("asset_assignments").select("id, inventory_item_id, customer_id, account_type, assigned_date, returned_date, customers(id, full_name, phone)"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
      setInventoryItems(itemsRes.data as unknown as InventoryItem[] || []);
      setSuppliers(suppliersRes.data || []);
      setAssetAssignments((assignmentsRes.data as unknown as AssetAssignment[]) || []);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      toast({ title: "Error", description: "Failed to load inventory data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Get customer assigned to an inventory item
  const getItemCustomer = (itemId: string) => {
    const assignment = assetAssignments.find(a => a.inventory_item_id === itemId && !a.returned_date);
    return assignment?.customers || null;
  };

  // Get assignment for an item
  const getItemAssignment = (itemId: string) => {
    return assetAssignments.find(a => a.inventory_item_id === itemId && !a.returned_date) || null;
  };

  // Calculate actual available stock per product
  const getProductStock = (productId: string) => {
    const items = inventoryItems.filter(item => item.product_id === productId);
    const inStock = items.filter(item => item.status === 'in_stock').length;
    const assigned = items.filter(item => item.status === 'assigned').length;
    const sold = items.filter(item => item.status === 'sold').length;
    const damaged = items.filter(item => item.status === 'damaged').length;
    const returned = items.filter(item => item.status === 'returned').length;
    return { inStock, assigned, sold, damaged, returned, total: items.length };
  };

  // Get available items for a product
  const getAvailableItemsForProduct = (productId: string) => {
    return inventoryItems.filter(item => item.product_id === productId && item.status === 'in_stock');
  };

  // Get selected product's category requirements
  const getProductCategory = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.product_categories || null;
  };

  const selectedCategory = itemForm.product_id ? getProductCategory(itemForm.product_id) : null;
  const requiresSerial = selectedCategory?.requires_serial || false;
  const requiresMac = selectedCategory?.requires_mac || false;
  const isMeteredProduct = selectedCategory?.is_metered || false;
  const meteredUnit = selectedCategory?.unit_of_measure || "meter";
  const isCableProduct = !isMeteredProduct && (
    selectedCategory?.name?.toLowerCase().includes("cable") || 
    selectedCategory?.name?.toLowerCase().includes("fibre") ||
    selectedCategory?.name?.toLowerCase().includes("fiber")
  );

  // Update quantity and arrays
  const handleQuantityChange = (qty: number) => {
    const newQty = Math.max(1, qty);
    const serials = [...itemForm.serial_numbers];
    const macs = [...itemForm.mac_addresses];
    
    while (serials.length < newQty) serials.push("");
    while (macs.length < newQty) macs.push("");
    serials.length = newQty;
    macs.length = newQty;
    
    setItemForm({ ...itemForm, quantity: newQty, serial_numbers: serials, mac_addresses: macs });
  };

  // Category handlers
  const handleSaveCategory = async () => {
    setSaving(true);
    try {
      const data = {
        name: categoryForm.name,
        description: categoryForm.description || null,
        requires_serial: categoryForm.is_metered ? false : categoryForm.requires_serial,
        requires_mac: categoryForm.is_metered ? false : categoryForm.requires_mac,
        is_metered: categoryForm.is_metered,
        unit_of_measure: categoryForm.is_metered ? categoryForm.unit_of_measure : "piece",
      };

      if (editingCategory) {
        const { error } = await supabase.from("product_categories").update(data).eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Success", description: "Category updated" });
      } else {
        const { error } = await supabase.from("product_categories").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Category created" });
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", requires_serial: false, requires_mac: false, is_metered: false, unit_of_measure: "piece" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Category deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Product handlers
  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      if (!productForm.category_id) throw new Error("Please select a category");

      const data = { ...productForm, category_id: productForm.category_id || null };
      
      if (editingProduct) {
        const { error } = await supabase.from("products").update(data).eq("id", editingProduct.id);
        if (error) throw error;
        toast({ title: "Success", description: "Product updated" });
      } else {
        const { error } = await supabase.from("products").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Product created" });
      }
      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm({ category_id: "", name: "", brand: "", model: "", description: "", purchase_price: 0, selling_price: 0, min_stock_level: 0 });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Product deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Inventory item handlers
  const handleSaveItem = async () => {
    setSaving(true);
    try {
      if (!itemForm.product_id) throw new Error("Please select a product");
      if (!itemForm.supplier_id) throw new Error("Please select a supplier");

      const product = products.find(p => p.id === itemForm.product_id);
      const category = product?.product_categories;
      const isMetered = category?.is_metered || false;
      const unit = category?.unit_of_measure || "meter";

      if (isMetered) {
        if (itemForm.metered_quantity <= 0) throw new Error(`Please enter quantity in ${unit}s`);
        const currentQty = product?.metered_quantity || 0;
        const { error } = await supabase
          .from("products")
          .update({ metered_quantity: currentQty + itemForm.metered_quantity })
          .eq("id", itemForm.product_id);
        if (error) throw error;
        toast({ title: "Success", description: `Added ${itemForm.metered_quantity} ${unit}(s) to stock` });
      } else {
        if (requiresSerial) {
          const emptySerials = itemForm.serial_numbers.filter(s => !s.trim());
          if (emptySerials.length > 0) throw new Error(`Please enter all ${itemForm.quantity} serial numbers`);
        }
        if (requiresMac) {
          const emptyMacs = itemForm.mac_addresses.filter(m => !m.trim());
          if (emptyMacs.length > 0) throw new Error(`Please enter all ${itemForm.quantity} MAC addresses`);
        }

        if (editingItem) {
          const data = {
            product_id: itemForm.product_id,
            supplier_id: itemForm.supplier_id || null,
            serial_number: itemForm.serial_numbers[0] || null,
            mac_address: itemForm.mac_addresses[0] || null,
            purchase_date: itemForm.purchase_date || null,
            purchase_price: itemForm.purchase_price || null,
            warranty_end_date: itemForm.warranty_end_date || null,
            notes: itemForm.notes || null,
            core_count: isCableProduct ? itemForm.core_count || null : null,
            cable_color: isCableProduct ? itemForm.cable_color || null : null,
            cable_length_m: isCableProduct ? itemForm.cable_length_m || null : null,
          };

          const { error } = await supabase.from("inventory_items").update(data).eq("id", editingItem.id);
          if (error) throw error;
          toast({ title: "Success", description: "Item updated" });
        } else {
          const items = [];
          for (let i = 0; i < itemForm.quantity; i++) {
            items.push({
              product_id: itemForm.product_id,
              supplier_id: itemForm.supplier_id || null,
              serial_number: requiresSerial ? itemForm.serial_numbers[i] : null,
              mac_address: requiresMac ? itemForm.mac_addresses[i] : null,
              purchase_date: itemForm.purchase_date || null,
              purchase_price: itemForm.purchase_price || null,
              warranty_end_date: itemForm.warranty_end_date || null,
              notes: itemForm.notes || null,
              core_count: isCableProduct ? itemForm.core_count || null : null,
              cable_color: isCableProduct ? itemForm.cable_color || null : null,
              cable_length_m: isCableProduct ? itemForm.cable_length_m || null : null,
              status: 'in_stock',
            });
          }

          const { error } = await supabase.from("inventory_items").insert(items);
          if (error) throw error;

          if (product) {
            await supabase.from("products").update({ stock_quantity: product.stock_quantity + itemForm.quantity }).eq("id", product.id);
          }

          toast({ title: "Success", description: `${itemForm.quantity} item(s) added to stock` });
        }
      }
      
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemForm({ product_id: "", supplier_id: "", quantity: 1, serial_numbers: [""], mac_addresses: [""], purchase_date: "", purchase_price: 0, warranty_end_date: "", notes: "", core_count: 0, cable_color: "", cable_length_m: 0, metered_quantity: 0 });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Delete this inventory item?")) return;
    try {
      const item = inventoryItems.find(i => i.id === id);
      
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      
      if (item && item.status === 'in_stock') {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase.from("products").update({ stock_quantity: Math.max(0, product.stock_quantity - 1) }).eq("id", product.id);
        }
      }
      
      toast({ title: "Success", description: "Item deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Sell item handler
  const handleSellItem = async () => {
    setSaving(true);
    try {
      if (!sellForm.item_id) throw new Error("Please select an item to sell");
      if (!sellForm.selling_price) throw new Error("Please enter selling price");

      const item = inventoryItems.find(i => i.id === sellForm.item_id);
      if (!item) throw new Error("Item not found");

      const { error: itemError } = await supabase
        .from("inventory_items")
        .update({ status: 'sold' })
        .eq("id", sellForm.item_id);
      
      if (itemError) throw itemError;

      const product = products.find(p => p.id === item.product_id);
      if (product) {
        await supabase
          .from("products")
          .update({ stock_quantity: Math.max(0, product.stock_quantity - 1) })
          .eq("id", product.id);
      }

      const profit = sellForm.selling_price - (item.purchase_price || product?.purchase_price || 0);
      await supabase.from("transactions").insert({
        type: 'income',
        amount: sellForm.selling_price,
        payment_method: 'cash',
        description: `Product sale: ${product?.name || "Unknown"} - ${sellForm.buyer_name || "Direct Sale"}`,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      });

      toast({ 
        title: "Success", 
        description: `Item sold for ৳${sellForm.selling_price}. Profit: ৳${profit}` 
      });
      
      setSellDialogOpen(false);
      setSellingProduct(null);
      setSellForm({ item_id: "", selling_price: 0, buyer_name: "", notes: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ========== RETURN WORKFLOW ==========
  const handleReturnItem = async () => {
    if (!returningItem) return;
    setSaving(true);
    try {
      const assignment = getItemAssignment(returningItem.id);
      if (!assignment) throw new Error("No active assignment found for this item");

      const newStatus = returnForm.condition === "damaged" ? "damaged" : "in_stock";

      // Update asset_assignments
      await supabase
        .from("asset_assignments")
        .update({
          returned_date: format(new Date(), "yyyy-MM-dd"),
          condition_on_return: returnForm.condition,
        })
        .eq("id", assignment.id);

      // Update inventory_items status
      await supabase
        .from("inventory_items")
        .update({ status: newStatus })
        .eq("id", returningItem.id);

      // Update product stock if re-stocked
      if (newStatus === "in_stock") {
        const product = products.find(p => p.id === returningItem.product_id);
        if (product) {
          await supabase.from("products").update({ stock_quantity: product.stock_quantity + 1 }).eq("id", product.id);
        }
      }

      // Log stock movement
      await supabase.from("stock_movements").insert({
        inventory_item_id: returningItem.id,
        from_status: "assigned",
        to_status: newStatus,
        movement_type: "returned",
        notes: `Returned in ${returnForm.condition} condition. ${returnForm.notes}`.trim(),
      });

      const customer = getItemCustomer(returningItem.id);
      toast({
        title: "Item Returned",
        description: `${returningItem.products?.name} returned from ${customer?.full_name || "customer"} in ${returnForm.condition} condition → ${newStatus === "in_stock" ? "Re-stocked" : "Marked damaged"}`,
      });

      setReturnDialogOpen(false);
      setReturningItem(null);
      setReturnForm({ condition: "good", notes: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ========== BULK STATUS UPDATES ==========
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Change status of ${selectedItems.size} item(s) to "${newStatus.replace("_", " ")}"?`)) return;
    
    setBulkActionSaving(true);
    try {
      const ids = Array.from(selectedItems);
      
      // Update all selected items
      const { error } = await supabase
        .from("inventory_items")
        .update({ status: newStatus as "in_stock" | "assigned" | "returned" | "damaged" | "sold" })
        .in("id", ids);
      
      if (error) throw error;

      // Log stock movements for each
      const movements = ids.map(id => {
        const item = inventoryItems.find(i => i.id === id);
        return {
          inventory_item_id: id,
          from_status: item?.status || "unknown",
          to_status: newStatus,
          movement_type: "status_change",
          notes: "Bulk status update",
        };
      });
      await supabase.from("stock_movements").insert(movements);

      toast({
        title: "Bulk Update Complete",
        description: `${ids.length} item(s) changed to "${newStatus.replace("_", " ")}"`,
      });

      setSelectedItems(new Set());
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBulkActionSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Are you sure you want to DELETE ${selectedItems.size} item(s)? This cannot be undone.`)) return;
    
    setBulkActionSaving(true);
    try {
      const ids = Array.from(selectedItems);
      const { error } = await supabase.from("inventory_items").delete().in("id", ids);
      if (error) throw error;

      toast({
        title: "Bulk Delete Complete",
        description: `${ids.length} item(s) deleted`,
      });

      setSelectedItems(new Set());
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBulkActionSaving(false);
    }
  };

  // Supplier handlers
  const handleSaveSupplier = async () => {
    setSaving(true);
    try {
      const data = {
        name: supplierForm.name,
        contact_person: supplierForm.contact_person || null,
        phone: supplierForm.phone || null,
        email: supplierForm.email || null,
        address: supplierForm.address || null,
      };

      if (editingSupplier) {
        const { error } = await supabase.from("suppliers").update(data).eq("id", editingSupplier.id);
        if (error) throw error;
        toast({ title: "Success", description: "Supplier updated" });
      } else {
        const { error } = await supabase.from("suppliers").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Supplier created" });
      }
      setSupplierDialogOpen(false);
      setEditingSupplier(null);
      setSupplierForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Supplier deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ========== EXPORT HANDLERS ==========
  const handleExportProducts = (type: "csv" | "pdf") => {
    const headers = [
      { key: "name", label: "Product Name" },
      { key: "category", label: "Category" },
      { key: "brand", label: "Brand" },
      { key: "model", label: "Model" },
      { key: "purchase_price", label: "Purchase Price" },
      { key: "selling_price", label: "Selling Price" },
      { key: "stock", label: "Stock" },
    ];
    const data = products.map(p => ({
      name: p.name,
      category: p.product_categories?.name || "N/A",
      brand: p.brand || "",
      model: p.model || "",
      purchase_price: `৳${p.purchase_price}`,
      selling_price: `৳${p.selling_price}`,
      stock: p.product_categories?.is_metered ? `${p.metered_quantity || 0} ${p.product_categories.unit_of_measure || "unit"}` : String(getProductStock(p.id).inStock),
    }));
    if (type === "csv") exportToCSV(data, headers, "inventory-products");
    else exportToPDF(data, headers, "Inventory Products", "inventory-products");
  };

  const handleExportStockItems = (type: "csv" | "pdf") => {
    const headers = [
      { key: "product", label: "Product" },
      { key: "serial", label: "Serial" },
      { key: "mac", label: "MAC" },
      { key: "supplier", label: "Supplier" },
      { key: "status", label: "Status" },
      { key: "price", label: "Purchase Price" },
      { key: "warranty", label: "Warranty End" },
    ];
    const data = getFilteredStockItems().map(i => ({
      product: i.products?.name || "N/A",
      serial: i.serial_number || "-",
      mac: i.mac_address || "-",
      supplier: i.suppliers?.name || "-",
      status: i.status.replace("_", " "),
      price: `৳${i.purchase_price || i.products?.purchase_price || 0}`,
      warranty: i.warranty_end_date ? format(new Date(i.warranty_end_date), "dd MMM yyyy") : "-",
    }));
    if (type === "csv") exportToCSV(data, headers, "stock-items");
    else exportToPDF(data, headers, "Stock Items", "stock-items");
  };

  const handleExportSuppliers = (type: "csv" | "pdf") => {
    const headers = [
      { key: "name", label: "Name" },
      { key: "contact", label: "Contact Person" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Address" },
    ];
    const data = suppliers.map(s => ({
      name: s.name,
      contact: s.contact_person || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
    }));
    if (type === "csv") exportToCSV(data, headers, "suppliers");
    else exportToPDF(data, headers, "Suppliers", "suppliers");
  };

  // Calculate summary stats
  const totalProducts = products.length;
  const totalItems = inventoryItems.length;
  const totalInStock = inventoryItems.filter(i => i.status === 'in_stock').length;
  const totalAssigned = inventoryItems.filter(i => i.status === 'assigned').length;
  const totalSold = inventoryItems.filter(i => i.status === 'sold').length;
  const lowStockProducts = products.filter(p => {
    const stock = getProductStock(p.id);
    return stock.inStock <= p.min_stock_level;
  });
  const totalStockValue = inventoryItems
    .filter(i => i.status === 'in_stock')
    .reduce((sum, i) => sum + (i.purchase_price || i.products?.purchase_price || 0), 0);

  // Warranty expiring soon count
  const warrantyExpiringSoon = inventoryItems.filter(i => {
    if (!i.warranty_end_date || i.status === 'sold') return false;
    const daysLeft = differenceInDays(new Date(i.warranty_end_date), new Date());
    return daysLeft >= 0 && daysLeft <= 30;
  });

  // Filtered products for display
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ========== FILTERED STOCK ITEMS (with status filter + search + warranty filter) ==========
  const getFilteredStockItems = () => {
    return inventoryItems.filter((item) => {
      // Status filter
      if (statusFilter === "expiring_soon") {
        if (!item.warranty_end_date) return false;
        const daysLeft = differenceInDays(new Date(item.warranty_end_date), new Date());
        if (daysLeft < 0 || daysLeft > 30) return false;
      } else if (statusFilter !== "all") {
        if (item.status !== statusFilter) return false;
      }

      // Search filter
      if (!stockSearchTerm) return true;
      const search = stockSearchTerm.toLowerCase();
      
      if (stockSearchFilter === "serial") {
        return (item.serial_number?.toLowerCase().includes(search) || 
                item.mac_address?.toLowerCase().includes(search));
      }
      if (stockSearchFilter === "supplier") {
        return item.suppliers?.name?.toLowerCase().includes(search);
      }
      if (stockSearchFilter === "product") {
        return item.products?.name?.toLowerCase().includes(search);
      }
      return (
        item.serial_number?.toLowerCase().includes(search) ||
        item.mac_address?.toLowerCase().includes(search) ||
        item.suppliers?.name?.toLowerCase().includes(search) ||
        item.products?.name?.toLowerCase().includes(search) ||
        item.products?.brand?.toLowerCase().includes(search)
      );
    });
  };

  const filteredStockItems = getFilteredStockItems();
  const totalPages = Math.max(1, Math.ceil(filteredStockItems.length / PAGE_SIZE));
  const paginatedItems = filteredStockItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set());
  }, [statusFilter, stockSearchTerm, stockSearchFilter]);

  // Toggle selection
  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map(i => i.id)));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Boxes className="h-6 w-6" />
            Inventory Management
          </h1>
          <p className="page-description">Manage products, stock, suppliers and assets</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Package className="h-4 w-4" />
              Products
            </div>
            <p className="text-2xl font-bold mt-1">{totalProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              In Stock
            </div>
            <p className="text-2xl font-bold mt-1">{totalInStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <TrendingUp className="h-4 w-4" />
              Assigned
            </div>
            <p className="text-2xl font-bold mt-1">{totalAssigned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 text-sm">
              <ShoppingCart className="h-4 w-4" />
              Sold
            </div>
            <p className="text-2xl font-bold mt-1">{totalSold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Stock Value
            </div>
            <p className="text-2xl font-bold mt-1">৳{totalStockValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={lowStockProducts.length > 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Low Stock
            </div>
            <p className="text-2xl font-bold mt-1">{lowStockProducts.length}</p>
          </CardContent>
        </Card>
        <Card className={warrantyExpiringSoon.length > 0 ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <Shield className="h-4 w-4" />
              Warranty Alert
            </div>
            <p className="text-2xl font-bold mt-1">{warrantyExpiringSoon.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Low Stock Alert:</span>
            <span>{lowStockProducts.map(p => `${p.name} (${getProductStock(p.id).inStock} left)`).join(", ")}</span>
          </div>
        </div>
      )}

      {/* Warranty Expiry Alert */}
      {warrantyExpiringSoon.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
            <Shield className="h-5 w-5" />
            <span className="font-medium">Warranty Expiring Soon ({warrantyExpiringSoon.length} items):</span>
            <span className="text-sm">{warrantyExpiringSoon.slice(0, 5).map(i => `${i.products?.name} (${i.serial_number || i.id.slice(0, 8)})`).join(", ")}{warrantyExpiringSoon.length > 5 ? ` +${warrantyExpiringSoon.length - 5} more` : ""}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <Boxes className="h-4 w-4" /> Stock Items
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="h-4 w-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Building2 className="h-4 w-4" /> Suppliers
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExportProducts("csv")}>
                    <FileText className="h-4 w-4 mr-2" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportProducts("pdf")}>
                    <FileText className="h-4 w-4 mr-2" /> Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canManage && (
                <Button onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ category_id: "", name: "", brand: "", model: "", description: "", purchase_price: 0, selling_price: 0, min_stock_level: 0 });
                  setProductDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" /> Add Product
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No products found
              </div>
            ) : (
              filteredProducts.map((product) => {
                const stock = getProductStock(product.id);
                const isMetered = product.product_categories?.is_metered || false;
                const mUnit = product.product_categories?.unit_of_measure || "meter";
                const meteredQty = product.metered_quantity || 0;
                const isLowStock = isMetered 
                  ? meteredQty <= product.min_stock_level 
                  : stock.inStock <= product.min_stock_level;
                const potentialProfit = isMetered 
                  ? meteredQty * (product.selling_price - product.purchase_price)
                  : stock.inStock * (product.selling_price - product.purchase_price);
                
                return (
                  <Card key={product.id} className={cn("relative overflow-hidden", isLowStock && "border-yellow-500")}>
                    {isLowStock && (
                      <div className="absolute top-0 right-0 bg-yellow-500 text-white text-xs px-2 py-1 rounded-bl">
                        Low Stock
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <CardDescription>
                            {product.brand && `${product.brand} `}
                            {product.model && `• ${product.model}`}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isMetered && (
                              <DropdownMenuItem onClick={() => {
                                setViewingProduct(product);
                                setViewItemsDialogOpen(true);
                              }}>
                                <Eye className="h-4 w-4 mr-2" /> View Items
                              </DropdownMenuItem>
                            )}
                            {!isMetered && stock.inStock > 0 && (
                              <DropdownMenuItem onClick={() => {
                                setSellingProduct(product);
                                setSellForm({
                                  item_id: "",
                                  selling_price: product.selling_price,
                                  buyer_name: "",
                                  notes: "",
                                });
                                setSellDialogOpen(true);
                              }}>
                                <ShoppingCart className="h-4 w-4 mr-2" /> Sell Item
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canEdit && (
                              <DropdownMenuItem onClick={() => {
                                setEditingProduct(product);
                                setProductForm({
                                  category_id: product.category_id || "",
                                  name: product.name,
                                  brand: product.brand || "",
                                  model: product.model || "",
                                  description: product.description || "",
                                  purchase_price: product.purchase_price,
                                  selling_price: product.selling_price,
                                  min_stock_level: product.min_stock_level,
                                });
                                setProductDialogOpen(true);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canRemove && (
                              <DropdownMenuItem onClick={() => handleDeleteProduct(product.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">
                          {product.product_categories?.name || "Uncategorized"}
                        </Badge>
                        {isMetered && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {mUnit}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isMetered ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded text-center">
                            <p className="text-xs text-muted-foreground">Available Stock</p>
                            <p className="text-2xl font-bold text-green-600">
                              {meteredQty.toLocaleString()} {mUnit}
                            </p>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2">
                            <div>
                              <p className="text-muted-foreground">Price/{mUnit}</p>
                              <p className="font-medium">৳{product.selling_price}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Cost/{mUnit}</p>
                              <p className="font-medium">৳{product.purchase_price}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Stock Value</p>
                              <p className="font-medium text-green-600">৳{(meteredQty * product.purchase_price).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-5 gap-1 text-center mb-3">
                            <div className="p-1">
                              <p className="text-xs text-muted-foreground">Stock</p>
                              <p className="font-bold text-green-600">{stock.inStock}</p>
                            </div>
                            <div className="p-1">
                              <p className="text-xs text-muted-foreground">Assigned</p>
                              <p className="font-bold text-blue-600">{stock.assigned}</p>
                            </div>
                            <div className="p-1">
                              <p className="text-xs text-muted-foreground">Sold</p>
                              <p className="font-bold text-purple-600">{stock.sold}</p>
                            </div>
                            <div className="p-1">
                              <p className="text-xs text-muted-foreground">Returned</p>
                              <p className="font-bold text-yellow-600">{stock.returned}</p>
                            </div>
                            <div className="p-1">
                              <p className="text-xs text-muted-foreground">Damaged</p>
                              <p className="font-bold text-red-600">{stock.damaged}</p>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2">
                            <div>
                              <p className="text-muted-foreground">Purchase</p>
                              <p className="font-medium">৳{product.purchase_price}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Selling</p>
                              <p className="font-medium">৳{product.selling_price}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Potential</p>
                              <p className="font-medium text-green-600">৳{potentialProfit}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Stock Items Tab - ENHANCED with status filter, pagination, warranty, bulk */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search stock items..." 
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={stockSearchFilter} onValueChange={(value: "all" | "serial" | "supplier" | "product") => setStockSearchFilter(value)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  <SelectItem value="serial">Serial / MAC</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="product">Product Name</SelectItem>
                </SelectContent>
              </Select>
              {/* NEW: Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="expiring_soon">⚠ Warranty Expiring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExportStockItems("csv")}>
                    <FileText className="h-4 w-4 mr-2" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportStockItems("pdf")}>
                    <FileText className="h-4 w-4 mr-2" /> Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canManage && (
                <Button onClick={() => {
                  setEditingItem(null);
                  setItemForm({ product_id: "", supplier_id: "", quantity: 1, serial_numbers: [""], mac_addresses: [""], purchase_date: "", purchase_price: 0, warranty_end_date: "", notes: "", core_count: 0, cable_color: "", cable_length_m: 0, metered_quantity: 0 });
                  setItemDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" /> Add Stock
                </Button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredStockItems.length} items
            {statusFilter !== "all" && ` (filtered: ${statusFilter.replace("_", " ")})`}
          </div>

          <div className="form-section overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {/* Bulk select checkbox */}
                  {canManage && (
                    <th className="w-10">
                      <Checkbox
                        checked={paginatedItems.length > 0 && selectedItems.size === paginatedItems.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>Product</th>
                  <th>Serial / MAC</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Purchase Price</th>
                  <th>Warranty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      {stockSearchTerm || statusFilter !== "all" ? "No items match your filters" : "No stock items found"}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const customer = getItemCustomer(item.id);
                    const warranty = getWarrantyInfo(item.warranty_end_date);
                    
                    return (
                      <tr key={item.id} className={selectedItems.has(item.id) ? "bg-primary/5" : ""}>
                        {canManage && (
                          <td>
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItemSelection(item.id)}
                            />
                          </td>
                        )}
                        <td>
                          <div className="font-medium">{item.products?.name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">{item.products?.brand}</div>
                        </td>
                        <td className="font-mono text-sm">
                          <div>{item.serial_number || "-"}</div>
                          <div className="text-muted-foreground">{item.mac_address || "-"}</div>
                        </td>
                        <td>{item.suppliers?.name || "-"}</td>
                        <td>
                          {(item.status === 'assigned' || item.status === 'sold') && customer ? (
                            <button
                              onClick={() => {
                                setViewingCustomer(customer);
                                setCustomerDialogOpen(true);
                              }}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <Badge className={cn(statusColors[item.status], "cursor-pointer")}>
                                {item.status === 'assigned' ? '→ ' : '✓ '}{customer.full_name}
                              </Badge>
                            </button>
                          ) : (
                            <Badge className={statusColors[item.status]}>
                              {item.status.replace("_", " ")}
                            </Badge>
                          )}
                        </td>
                        <td>৳{item.purchase_price || item.products?.purchase_price || 0}</td>
                        <td>
                          {warranty.label !== "N/A" ? (
                            <span className={cn("text-xs px-2 py-1 rounded", warranty.color)}>
                              {warranty.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {/* Return action for assigned items */}
                              {canEdit && item.status === 'assigned' && (
                                <DropdownMenuItem onClick={() => {
                                  setReturningItem(item);
                                  setReturnForm({ condition: "good", notes: "" });
                                  setReturnDialogOpen(true);
                                }}>
                                  <RotateCcw className="h-4 w-4 mr-2" /> Return Item
                                </DropdownMenuItem>
                              )}
                              {canEdit && item.status === 'in_stock' && (
                                <DropdownMenuItem onClick={() => {
                                  setEditingItem(item);
                                  setItemForm({
                                    product_id: item.product_id,
                                    supplier_id: item.supplier_id || "",
                                    quantity: 1,
                                    serial_numbers: [item.serial_number || ""],
                                    mac_addresses: [item.mac_address || ""],
                                    purchase_date: item.purchase_date || "",
                                    purchase_price: item.purchase_price || 0,
                                    warranty_end_date: item.warranty_end_date || "",
                                    notes: item.notes || "",
                                    core_count: item.core_count || 0,
                                    cable_color: item.cable_color || "",
                                    cable_length_m: item.cable_length_m || 0,
                                    metered_quantity: 0,
                                  });
                                  setItemDialogOpen(true);
                                }}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                              )}
                              {canRemove && (
                                <DropdownMenuItem onClick={() => handleDeleteItem(item.id)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className="w-9"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedItems.size > 0 && canManage && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border-2 border-primary shadow-xl rounded-lg px-6 py-3 flex items-center gap-4">
              <span className="font-medium text-sm">{selectedItems.size} selected</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={bulkActionSaving}>
                    {bulkActionSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Change Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange("in_stock")}>In Stock</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange("damaged")}>Damaged</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatusChange("returned")}>Returned</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canRemove && (
                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkActionSaving}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedItems(new Set())}>
                Cancel
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Button onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: "", description: "", requires_serial: false, requires_mac: false, is_metered: false, unit_of_measure: "piece" });
                setCategoryDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" /> Add Category
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      {category.description && (
                        <CardDescription>{category.description}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => {
                            setEditingCategory(category);
                            setCategoryForm({
                              name: category.name,
                              description: category.description || "",
                              requires_serial: category.requires_serial,
                              requires_mac: category.requires_mac,
                              is_metered: category.is_metered || false,
                              unit_of_measure: category.unit_of_measure || "piece",
                            });
                            setCategoryDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem onClick={() => handleDeleteCategory(category.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {category.is_metered && (
                      <Badge variant="default" className="bg-primary">
                        Metered ({category.unit_of_measure || "meter"})
                      </Badge>
                    )}
                    {category.requires_serial && (
                      <Badge variant="secondary">Serial Required</Badge>
                    )}
                    {category.requires_mac && (
                      <Badge variant="secondary">MAC Required</Badge>
                    )}
                    {!category.is_metered && !category.requires_serial && !category.requires_mac && (
                      <Badge variant="outline">Standard</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExportSuppliers("csv")}>
                  <FileText className="h-4 w-4 mr-2" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportSuppliers("pdf")}>
                  <FileText className="h-4 w-4 mr-2" /> Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage && (
              <Button onClick={() => {
                setEditingSupplier(null);
                setSupplierForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
                setSupplierDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" /> Add Supplier
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier) => (
              <Card key={supplier.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{supplier.name}</CardTitle>
                      {supplier.contact_person && (
                        <CardDescription>{supplier.contact_person}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => {
                            setEditingSupplier(supplier);
                            setSupplierForm({
                              name: supplier.name,
                              contact_person: supplier.contact_person || "",
                              phone: supplier.phone || "",
                              email: supplier.email || "",
                              address: supplier.address || "",
                            });
                            setSupplierDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem onClick={() => handleDeleteSupplier(supplier.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {supplier.phone && <p>📞 {supplier.phone}</p>}
                  {supplier.email && <p>✉️ {supplier.email}</p>}
                  {supplier.address && <p>📍 {supplier.address}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              <Select value={productForm.category_id} onValueChange={(v) => setProductForm({ ...productForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Name *</Label>
                <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
              </div>
              <div>
                <Label>Brand</Label>
                <Input value={productForm.brand} onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Model</Label>
                <Input value={productForm.model} onChange={(e) => setProductForm({ ...productForm, model: e.target.value })} />
              </div>
              <div>
                <Label>Min Stock Level</Label>
                <Input type="number" value={productForm.min_stock_level} onChange={(e) => setProductForm({ ...productForm, min_stock_level: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Purchase Price (৳)</Label>
                <Input type="number" value={productForm.purchase_price} onChange={(e) => setProductForm({ ...productForm, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Selling Price (৳)</Label>
                <Input type="number" value={productForm.selling_price} onChange={(e) => setProductForm({ ...productForm, selling_price: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleSaveProduct} className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category Name *</Label>
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} />
            </div>
            
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_metered"
                  checked={categoryForm.is_metered}
                  onCheckedChange={(v) => setCategoryForm({ 
                    ...categoryForm, 
                    is_metered: v as boolean,
                    requires_serial: v ? false : categoryForm.requires_serial,
                    requires_mac: v ? false : categoryForm.requires_mac,
                  })}
                />
                <Label htmlFor="is_metered" className="font-medium">Metered Product (e.g., Cable, Wire)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Metered products are tracked by quantity (meters, kg, etc.) instead of individual serial numbers.
              </p>
              
              {categoryForm.is_metered && (
                <div>
                  <Label>Unit of Measure</Label>
                  <Select 
                    value={categoryForm.unit_of_measure} 
                    onValueChange={(v) => setCategoryForm({ ...categoryForm, unit_of_measure: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meter">Meter (m)</SelectItem>
                      <SelectItem value="feet">Feet (ft)</SelectItem>
                      <SelectItem value="kg">Kilogram (kg)</SelectItem>
                      <SelectItem value="liter">Liter (L)</SelectItem>
                      <SelectItem value="roll">Roll</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!categoryForm.is_metered && (
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requires_serial"
                    checked={categoryForm.requires_serial}
                    onCheckedChange={(v) => setCategoryForm({ ...categoryForm, requires_serial: v as boolean })}
                  />
                  <Label htmlFor="requires_serial">Requires Serial Number</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requires_mac"
                    checked={categoryForm.requires_mac}
                    onCheckedChange={(v) => setCategoryForm({ ...categoryForm, requires_mac: v as boolean })}
                  />
                  <Label htmlFor="requires_mac">Requires MAC Address</Label>
                </div>
              </div>
            )}

            <Button onClick={handleSaveCategory} className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCategory ? "Update Category" : "Add Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Stock Item" : "Add Stock Items"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product *</Label>
                <Select value={itemForm.product_id} onValueChange={(v) => setItemForm({ ...itemForm, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.brand || "N/A"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supplier *</Label>
                <Select value={itemForm.supplier_id} onValueChange={(v) => setItemForm({ ...itemForm, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCategory && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="font-medium">Category: {selectedCategory.name}</span>
                {isMeteredProduct ? (
                  <div className="mt-1 text-muted-foreground">
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Metered Product ({meteredUnit})
                    </Badge>
                  </div>
                ) : (
                  <div className="flex gap-4 mt-1 text-muted-foreground">
                    <span>Serial: {selectedCategory.requires_serial ? "Required" : "Optional"}</span>
                    <span>MAC: {selectedCategory.requires_mac ? "Required" : "Optional"}</span>
                  </div>
                )}
              </div>
            )}

            {isMeteredProduct && !editingItem && (
              <div className="p-4 border-2 border-primary/30 rounded-lg bg-primary/5 space-y-3">
                <Label className="text-base font-medium">Quantity to Add ({meteredUnit}s)</Label>
                <Input 
                  type="number" 
                  min={1} 
                  value={itemForm.metered_quantity} 
                  onChange={(e) => setItemForm({ ...itemForm, metered_quantity: Number(e.target.value) })} 
                  placeholder={`Enter ${meteredUnit}s to add`}
                  className="text-lg"
                />
                {itemForm.metered_quantity > 0 && itemForm.purchase_price > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total cost: ৳{(itemForm.metered_quantity * itemForm.purchase_price).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {!isMeteredProduct && !editingItem && (
              <div>
                <Label>Quantity</Label>
                <Input type="number" min={1} value={itemForm.quantity} onChange={(e) => handleQuantityChange(Number(e.target.value))} />
              </div>
            )}

            {!isMeteredProduct && (requiresSerial || requiresMac) && itemForm.quantity > 0 && (
              <div className="space-y-3 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                <Label>Enter {requiresSerial ? "Serial Numbers" : ""} {requiresSerial && requiresMac ? "&" : ""} {requiresMac ? "MAC Addresses" : ""}</Label>
                {Array.from({ length: editingItem ? 1 : itemForm.quantity }).map((_, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Unit {idx + 1}:</span>
                    {requiresSerial && (
                      <Input
                        placeholder="Serial Number"
                        value={itemForm.serial_numbers[idx] || ""}
                        onChange={(e) => {
                          const arr = [...itemForm.serial_numbers];
                          arr[idx] = e.target.value;
                          setItemForm({ ...itemForm, serial_numbers: arr });
                        }}
                      />
                    )}
                    {requiresMac && (
                      <Input
                        placeholder="MAC Address"
                        value={itemForm.mac_addresses[idx] || ""}
                        onChange={(e) => {
                          const arr = [...itemForm.mac_addresses];
                          arr[idx] = e.target.value;
                          setItemForm({ ...itemForm, mac_addresses: arr });
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {isCableProduct && (
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label>Core Count</Label>
                  <Input type="number" value={itemForm.core_count} onChange={(e) => setItemForm({ ...itemForm, core_count: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Color</Label>
                  <Select value={itemForm.cable_color} onValueChange={(v) => setItemForm({ ...itemForm, cable_color: v })}>
                    <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                    <SelectContent>
                      {cableColors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Length (m)</Label>
                  <Input type="number" value={itemForm.cable_length_m} onChange={(e) => setItemForm({ ...itemForm, cable_length_m: Number(e.target.value) })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Purchase Date</Label>
                <Input type="date" value={itemForm.purchase_date} onChange={(e) => setItemForm({ ...itemForm, purchase_date: e.target.value })} />
              </div>
              <div>
                <Label>{isMeteredProduct ? `Price per ${meteredUnit} (৳)` : "Unit Price (৳)"}</Label>
                <Input type="number" value={itemForm.purchase_price} onChange={(e) => setItemForm({ ...itemForm, purchase_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Warranty End</Label>
                <Input type="date" value={itemForm.warranty_end_date} onChange={(e) => setItemForm({ ...itemForm, warranty_end_date: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} rows={2} />
            </div>

            <Button onClick={handleSaveItem} className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem 
                ? "Update Item" 
                : isMeteredProduct 
                  ? `Add ${itemForm.metered_quantity} ${meteredUnit}(s) to Stock`
                  : `Add ${itemForm.quantity} Item(s) to Stock`
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Supplier Name *</Label>
              <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input value={supplierForm.contact_person} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleSaveSupplier} className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSupplier ? "Update Supplier" : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Items Dialog */}
      <Dialog open={viewItemsDialogOpen} onOpenChange={setViewItemsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewingProduct?.name} - Stock Items
            </DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <p className="text-xs">In Stock</p>
                  <p className="font-bold text-green-600">{getProductStock(viewingProduct.id).inStock}</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <p className="text-xs">Assigned</p>
                  <p className="font-bold text-blue-600">{getProductStock(viewingProduct.id).assigned}</p>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <p className="text-xs">Sold</p>
                  <p className="font-bold text-purple-600">{getProductStock(viewingProduct.id).sold}</p>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <p className="text-xs">Returned</p>
                  <p className="font-bold text-yellow-600">{getProductStock(viewingProduct.id).returned}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Serial / MAC</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems
                      .filter(i => i.product_id === viewingProduct.id)
                      .map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2 font-mono">
                            {item.serial_number || item.mac_address || "N/A"}
                          </td>
                          <td className="p-2">
                            <Badge className={statusColors[item.status]}>
                              {item.status.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="p-2">{item.suppliers?.name || "-"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sell {sellingProduct?.name}</DialogTitle>
          </DialogHeader>
          {sellingProduct && (
            <div className="space-y-4">
              <div>
                <Label>Select Item to Sell *</Label>
                <Select value={sellForm.item_id} onValueChange={(v) => setSellForm({ ...sellForm, item_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available item" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableItemsForProduct(sellingProduct.id).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.serial_number || item.mac_address || item.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Selling Price (৳) *</Label>
                <Input
                  type="number"
                  value={sellForm.selling_price}
                  onChange={(e) => setSellForm({ ...sellForm, selling_price: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default: ৳{sellingProduct.selling_price} | Purchase: ৳{sellingProduct.purchase_price}
                </p>
              </div>
              <div>
                <Label>Buyer Name</Label>
                <Input
                  value={sellForm.buyer_name}
                  onChange={(e) => setSellForm({ ...sellForm, buyer_name: e.target.value })}
                  placeholder="Optional - buyer name or company"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={sellForm.notes}
                  onChange={(e) => setSellForm({ ...sellForm, notes: e.target.value })}
                  placeholder="Sale notes..."
                  rows={2}
                />
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Expected Profit:</span>{" "}
                  <span className="text-green-600 font-bold">
                    ৳{(sellForm.selling_price - sellingProduct.purchase_price).toLocaleString()}
                  </span>
                </p>
              </div>
              <Button onClick={handleSellItem} className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Complete Sale
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Item Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Item</DialogTitle>
          </DialogHeader>
          {returningItem && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <p className="font-medium">{returningItem.products?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {returningItem.serial_number && `Serial: ${returningItem.serial_number}`}
                  {returningItem.mac_address && ` | MAC: ${returningItem.mac_address}`}
                </p>
                {(() => {
                  const customer = getItemCustomer(returningItem.id);
                  return customer ? (
                    <p className="text-sm">Assigned to: <span className="font-medium">{customer.full_name}</span></p>
                  ) : null;
                })()}
              </div>

              <div>
                <Label>Condition on Return *</Label>
                <Select value={returnForm.condition} onValueChange={(v) => setReturnForm({ ...returnForm, condition: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Return Notes</Label>
                <Textarea
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="Notes about the return..."
                  rows={3}
                />
              </div>

              <div className={cn(
                "p-3 rounded-lg text-sm",
                returnForm.condition === "damaged"
                  ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                  : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
              )}>
                {returnForm.condition === "damaged"
                  ? "⚠️ Item will be marked as DAMAGED and will NOT be re-stocked."
                  : "✅ Item will be returned to stock and marked as IN STOCK."}
              </div>

              <Button onClick={handleReturnItem} className="w-full" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Process Return
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Details Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">Customer Name</Label>
                <p className="font-medium text-lg">{viewingCustomer.full_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Phone</Label>
                <p className="font-medium">{viewingCustomer.phone}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`tel:${viewingCustomer.phone}`, '_self')}
                >
                  📞 Call
                </Button>
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={() => {
                    setCustomerDialogOpen(false);
                    window.location.href = `/customers?search=${encodeURIComponent(viewingCustomer.full_name)}`;
                  }}
                >
                  View Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
