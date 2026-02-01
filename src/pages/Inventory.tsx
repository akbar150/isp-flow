import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
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
} from "lucide-react";
import { format } from "date-fns";

interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  requires_serial: boolean;
  requires_mac: boolean;
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

const statusColors: Record<string, string> = {
  in_stock: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  returned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  sold: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const cableColors = ["Blue", "Orange", "Green", "Brown", "White", "Yellow", "Red", "Black"];

export default function Inventory() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({ 
    name: "", 
    description: "",
    requires_serial: false,
    requires_mac: false,
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
    // Cable specific
    core_count: 0,
    cable_color: "",
    cable_length_m: 0,
  });
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
  });

  const canManage = isSuperAdmin || canCreate("inventory");
  const canEdit = isSuperAdmin || canUpdate("inventory");
  const canRemove = isSuperAdmin || canDelete("inventory");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [categoriesRes, productsRes, itemsRes, suppliersRes] = await Promise.all([
        supabase.from("product_categories").select("*").order("name"),
        supabase.from("products").select("*, product_categories(*)").order("name"),
        supabase.from("inventory_items").select("*, products(*, product_categories(*)), suppliers(id, name, contact_person, phone, email, address, is_active)").order("created_at", { ascending: false }),
        supabase.from("suppliers").select("*").eq("is_active", true).order("name"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
      setInventoryItems(itemsRes.data as unknown as InventoryItem[] || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      toast({ title: "Error", description: "Failed to load inventory data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Get selected product's category requirements
  const getProductCategory = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.product_categories || null;
  };

  const selectedCategory = itemForm.product_id ? getProductCategory(itemForm.product_id) : null;
  const requiresSerial = selectedCategory?.requires_serial || false;
  const requiresMac = selectedCategory?.requires_mac || false;
  const isCableProduct = selectedCategory?.name?.toLowerCase().includes("cable") || 
                         selectedCategory?.name?.toLowerCase().includes("fibre") ||
                         selectedCategory?.name?.toLowerCase().includes("fiber");

  // Update quantity and arrays
  const handleQuantityChange = (qty: number) => {
    const newQty = Math.max(1, qty);
    const serials = [...itemForm.serial_numbers];
    const macs = [...itemForm.mac_addresses];
    
    // Adjust arrays to match quantity
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
        requires_serial: categoryForm.requires_serial,
        requires_mac: categoryForm.requires_mac,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from("product_categories")
          .update(data)
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Success", description: "Category updated" });
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Category created" });
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", requires_serial: false, requires_mac: false });
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
      if (!productForm.category_id) {
        throw new Error("Please select a category");
      }

      const data = {
        ...productForm,
        category_id: productForm.category_id || null,
      };
      
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(data)
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast({ title: "Success", description: "Product updated" });
      } else {
        const { error } = await supabase.from("products").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Product created" });
      }
      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm({
        category_id: "",
        name: "",
        brand: "",
        model: "",
        description: "",
        purchase_price: 0,
        selling_price: 0,
        min_stock_level: 0,
      });
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

  // Inventory item handlers - BULK ADD
  const handleSaveItem = async () => {
    setSaving(true);
    try {
      // Validate
      if (!itemForm.product_id) throw new Error("Please select a product");
      if (!itemForm.supplier_id) throw new Error("Please select a supplier");

      // Validate serial/MAC based on category requirements
      if (requiresSerial) {
        const emptySerials = itemForm.serial_numbers.filter(s => !s.trim());
        if (emptySerials.length > 0) {
          throw new Error(`Please enter all ${itemForm.quantity} serial numbers`);
        }
      }
      if (requiresMac) {
        const emptyMacs = itemForm.mac_addresses.filter(m => !m.trim());
        if (emptyMacs.length > 0) {
          throw new Error(`Please enter all ${itemForm.quantity} MAC addresses`);
        }
      }

      if (editingItem) {
        // Single item update
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

        const { error } = await supabase
          .from("inventory_items")
          .update(data)
          .eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Success", description: "Item updated" });
      } else {
        // Bulk insert
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

        // Update product stock quantity
        const product = products.find(p => p.id === itemForm.product_id);
        if (product) {
          await supabase
            .from("products")
            .update({ stock_quantity: product.stock_quantity + itemForm.quantity })
            .eq("id", product.id);
        }

        toast({ title: "Success", description: `${itemForm.quantity} item(s) added to stock` });
      }
      
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemForm({
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
      });
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
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Item deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
        const { error } = await supabase
          .from("suppliers")
          .update(data)
          .eq("id", editingSupplier.id);
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

  // Low stock products
  const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock_level);

  // Filtered items
  const filteredItems = inventoryItems.filter(item =>
    item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.mac_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.products?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading inventory...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Management</h1>
          <p className="page-description">Manage products, stock and assets</p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Low Stock Alert:</span>
            <span>{lowStockProducts.map(p => p.name).join(", ")}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="items" className="gap-2">
            <Boxes className="h-4 w-4" /> Stock Items
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tag className="h-4 w-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2">
            <Building2 className="h-4 w-4" /> Suppliers
          </TabsTrigger>
        </TabsList>

        {/* Stock Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by serial, MAC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {canManage && (
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingItem(null);
                    setItemForm({
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
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Stock
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Edit Stock Item" : "Add Stock Items"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Product *</Label>
                        <Select
                          value={itemForm.product_id}
                          onValueChange={(v) => {
                            setItemForm({ ...itemForm, product_id: v });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.brand || "N/A"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Supplier *</Label>
                        <Select
                          value={itemForm.supplier_id}
                          onValueChange={(v) => setItemForm({ ...itemForm, supplier_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Show category requirements info */}
                    {selectedCategory && (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <span className="font-medium">Category: {selectedCategory.name}</span>
                        <div className="flex gap-4 mt-1 text-muted-foreground">
                          <span>Serial Number: {selectedCategory.requires_serial ? "Required" : "Optional"}</span>
                          <span>MAC Address: {selectedCategory.requires_mac ? "Required" : "Optional"}</span>
                        </div>
                      </div>
                    )}

                    {!editingItem && (
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={itemForm.quantity}
                          onChange={(e) => handleQuantityChange(Number(e.target.value))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Number of units to add to stock
                        </p>
                      </div>
                    )}

                    {/* Serial/MAC entries for each unit */}
                    {(requiresSerial || requiresMac) && itemForm.quantity > 0 && (
                      <div className="space-y-3 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                        <Label>Enter {requiresSerial ? "Serial Numbers" : ""} {requiresSerial && requiresMac ? "&" : ""} {requiresMac ? "MAC Addresses" : ""} for each unit</Label>
                        {Array.from({ length: editingItem ? 1 : itemForm.quantity }).map((_, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-2 items-center">
                            <span className="text-sm text-muted-foreground">Unit {idx + 1}:</span>
                            <div className="col-span-1 grid grid-cols-2 gap-2">
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
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cable-specific fields */}
                    {isCableProduct && (
                      <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                        <div>
                          <Label>Core Count</Label>
                          <Input
                            type="number"
                            value={itemForm.core_count}
                            onChange={(e) => setItemForm({ ...itemForm, core_count: Number(e.target.value) })}
                            placeholder="e.g., 2, 4, 8"
                          />
                        </div>
                        <div>
                          <Label>Cable Color</Label>
                          <Select
                            value={itemForm.cable_color}
                            onValueChange={(v) => setItemForm({ ...itemForm, cable_color: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                            <SelectContent>
                              {cableColors.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Length (meters)</Label>
                          <Input
                            type="number"
                            value={itemForm.cable_length_m}
                            onChange={(e) => setItemForm({ ...itemForm, cable_length_m: Number(e.target.value) })}
                            placeholder="e.g., 500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Purchase Date</Label>
                        <Input
                          type="date"
                          value={itemForm.purchase_date}
                          onChange={(e) => setItemForm({ ...itemForm, purchase_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Unit Price (৳)</Label>
                        <Input
                          type="number"
                          value={itemForm.purchase_price}
                          onChange={(e) => setItemForm({ ...itemForm, purchase_price: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Warranty End</Label>
                        <Input
                          type="date"
                          value={itemForm.warranty_end_date}
                          onChange={(e) => setItemForm({ ...itemForm, warranty_end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={itemForm.notes}
                        onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={2}
                      />
                    </div>

                    <Button onClick={handleSaveItem} className="w-full" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingItem ? "Update Item" : `Add ${itemForm.quantity} Item(s) to Stock`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Serial Number</th>
                  <th>MAC Address</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Warranty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No stock items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.products?.name || "N/A"}</div>
                        {item.cable_length_m && (
                          <div className="text-xs text-muted-foreground">
                            {item.core_count} core, {item.cable_color}, {item.cable_length_m}m
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-sm">{item.serial_number || "-"}</td>
                      <td className="font-mono text-sm">{item.mac_address || "-"}</td>
                      <td>{item.suppliers?.name || "-"}</td>
                      <td>
                        <Badge className={statusColors[item.status]}>
                          {item.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        {item.warranty_end_date 
                          ? format(new Date(item.warranty_end_date), "dd MMM yyyy")
                          : "-"
                        }
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
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
                                });
                                setItemDialogOpen(true);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canRemove && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingProduct(null);
                    setProductForm({
                      category_id: "",
                      name: "",
                      brand: "",
                      model: "",
                      description: "",
                      purchase_price: 0,
                      selling_price: 0,
                      min_stock_level: 0,
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                      <Label>Category *</Label>
                      <Select
                        value={productForm.category_id}
                        onValueChange={(v) => setProductForm({ ...productForm, category_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              {(c.requires_serial || c.requires_mac) && (
                                <span className="text-muted-foreground ml-2">
                                  ({c.requires_serial ? "Serial" : ""}{c.requires_serial && c.requires_mac ? "/" : ""}{c.requires_mac ? "MAC" : ""})
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Product Name *</Label>
                      <Input
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Brand</Label>
                        <Input
                          value={productForm.brand}
                          onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Model</Label>
                        <Input
                          value={productForm.model}
                          onChange={(e) => setProductForm({ ...productForm, model: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Purchase Price</Label>
                        <Input
                          type="number"
                          value={productForm.purchase_price}
                          onChange={(e) => setProductForm({ ...productForm, purchase_price: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Selling Price</Label>
                        <Input
                          type="number"
                          value={productForm.selling_price}
                          onChange={(e) => setProductForm({ ...productForm, selling_price: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Min Stock Level</Label>
                      <Input
                        type="number"
                        value={productForm.min_stock_level}
                        onChange={(e) => setProductForm({ ...productForm, min_stock_level: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSaveProduct} className="w-full" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingProduct ? "Update" : "Add"} Product
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div key={product.id} className="card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {product.brand} {product.model}
                    </p>
                  </div>
                  {(canEdit || canRemove) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
                          <DropdownMenuItem 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Stock</p>
                    <p className={`font-medium ${product.stock_quantity <= product.min_stock_level ? "text-red-600" : ""}`}>
                      {product.stock_quantity} units
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium">৳{product.selling_price}</p>
                  </div>
                </div>
                {product.product_categories && (
                  <Badge variant="outline" className="mt-2">
                    {product.product_categories.name}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingCategory(null);
                    setCategoryForm({ name: "", description: "", requires_serial: false, requires_mac: false });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Category Name *</Label>
                      <Input
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      />
                    </div>
                    
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Tracking Requirements</Label>
                      <p className="text-xs text-muted-foreground">
                        Specify what information is required when adding stock items in this category
                      </p>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="requires_serial"
                          checked={categoryForm.requires_serial}
                          onCheckedChange={(checked) => 
                            setCategoryForm({ ...categoryForm, requires_serial: checked as boolean })
                          }
                        />
                        <label htmlFor="requires_serial" className="text-sm cursor-pointer">
                          Requires Serial Number
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="requires_mac"
                          checked={categoryForm.requires_mac}
                          onCheckedChange={(checked) => 
                            setCategoryForm({ ...categoryForm, requires_mac: checked as boolean })
                          }
                        />
                        <label htmlFor="requires_mac" className="text-sm cursor-pointer">
                          Requires MAC Address
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Example: ONU/Router needs both. Cable/Consumables need neither.
                      </p>
                    </div>

                    <Button onClick={handleSaveCategory} className="w-full" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingCategory ? "Update" : "Add"} Category
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.description || "No description"}</p>
                  </div>
                  {(canEdit || canRemove) && (
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
                            });
                            setCategoryDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {category.requires_serial && (
                    <Badge variant="outline" className="text-xs">Serial Required</Badge>
                  )}
                  {category.requires_mac && (
                    <Badge variant="outline" className="text-xs">MAC Required</Badge>
                  )}
                  {!category.requires_serial && !category.requires_mac && (
                    <Badge variant="secondary" className="text-xs">No Tracking</Badge>
                  )}
                </div>
                <p className="text-sm mt-2">
                  {products.filter(p => p.category_id === category.id).length} products
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingSupplier(null);
                    setSupplierForm({ name: "", contact_person: "", phone: "", email: "", address: "" });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Supplier Name *</Label>
                      <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Contact Person</Label>
                      <Input value={supplierForm.contact_person} onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Phone</Label>
                        <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Textarea value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} rows={2} />
                    </div>
                    <Button onClick={handleSaveSupplier} className="w-full" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingSupplier ? "Update" : "Add"} Supplier
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
              ) : (
                suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contact_person || "-"}</TableCell>
                    <TableCell>{supplier.phone || "-"}</TableCell>
                    <TableCell>{supplier.email || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => {
                              setEditingSupplier(supplier);
                              setSupplierForm({ name: supplier.name, contact_person: supplier.contact_person || "", phone: supplier.phone || "", email: supplier.email || "", address: supplier.address || "" });
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
