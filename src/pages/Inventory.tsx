import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
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
  products?: Product | null;
}

const statusColors: Record<string, string> = {
  in_stock: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  returned: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  damaged: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  sold: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function Inventory() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
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
    serial_number: "",
    mac_address: "",
    purchase_date: "",
    purchase_price: 0,
    warranty_end_date: "",
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
      const [categoriesRes, productsRes, itemsRes] = await Promise.all([
        supabase.from("product_categories").select("*").order("name"),
        supabase.from("products").select("*, product_categories(*)").order("name"),
        supabase.from("inventory_items").select("*, products(*, product_categories(*))").order("created_at", { ascending: false }),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setCategories(categoriesRes.data || []);
      setProducts(productsRes.data || []);
      setInventoryItems(itemsRes.data || []);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      toast({ title: "Error", description: "Failed to load inventory data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const handleSaveCategory = async () => {
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("product_categories")
          .update(categoryForm)
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast({ title: "Success", description: "Category updated" });
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert([categoryForm]);
        if (error) throw error;
        toast({ title: "Success", description: "Category created" });
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    try {
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
    try {
      const data = {
        product_id: itemForm.product_id,
        serial_number: itemForm.serial_number || null,
        mac_address: itemForm.mac_address || null,
        purchase_date: itemForm.purchase_date || null,
        purchase_price: itemForm.purchase_price || null,
        warranty_end_date: itemForm.warranty_end_date || null,
        notes: itemForm.notes || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from("inventory_items")
          .update(data)
          .eq("id", editingItem.id);
        if (error) throw error;
        toast({ title: "Success", description: "Item updated" });
      } else {
        const { error } = await supabase.from("inventory_items").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Item added to stock" });
      }
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemForm({
        product_id: "",
        serial_number: "",
        mac_address: "",
        purchase_date: "",
        purchase_price: 0,
        warranty_end_date: "",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
                      serial_number: "",
                      mac_address: "",
                      purchase_date: "",
                      purchase_price: 0,
                      warranty_end_date: "",
                      notes: "",
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Stock Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Product *</Label>
                      <Select
                        value={itemForm.product_id}
                        onValueChange={(v) => setItemForm({ ...itemForm, product_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Serial Number</Label>
                        <Input
                          value={itemForm.serial_number}
                          onChange={(e) => setItemForm({ ...itemForm, serial_number: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>MAC Address</Label>
                        <Input
                          value={itemForm.mac_address}
                          onChange={(e) => setItemForm({ ...itemForm, mac_address: e.target.value })}
                          placeholder="XX:XX:XX:XX:XX:XX"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Purchase Date</Label>
                        <Input
                          type="date"
                          value={itemForm.purchase_date}
                          onChange={(e) => setItemForm({ ...itemForm, purchase_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Purchase Price</Label>
                        <Input
                          type="number"
                          value={itemForm.purchase_price}
                          onChange={(e) => setItemForm({ ...itemForm, purchase_price: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Warranty End Date</Label>
                      <Input
                        type="date"
                        value={itemForm.warranty_end_date}
                        onChange={(e) => setItemForm({ ...itemForm, warranty_end_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={itemForm.notes}
                        onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSaveItem} className="w-full">
                      {editingItem ? "Update" : "Add"} Item
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
                  <th>Status</th>
                  <th>Warranty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No stock items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.products?.name || "N/A"}</td>
                      <td className="font-mono text-sm">{item.serial_number || "-"}</td>
                      <td className="font-mono text-sm">{item.mac_address || "-"}</td>
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
                                  serial_number: item.serial_number || "",
                                  mac_address: item.mac_address || "",
                                  purchase_date: item.purchase_date || "",
                                  purchase_price: item.purchase_price || 0,
                                  warranty_end_date: item.warranty_end_date || "",
                                  notes: item.notes || "",
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
                      <Label>Product Name *</Label>
                      <Input
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={productForm.category_id}
                        onValueChange={(v) => setProductForm({ ...productForm, category_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <Button onClick={handleSaveProduct} className="w-full">
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
                    setCategoryForm({ name: "", description: "" });
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
                    <Button onClick={handleSaveCategory} className="w-full">
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
                              description: category.description || "" 
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
                <p className="text-sm mt-2">
                  {products.filter(p => p.category_id === category.id).length} products
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
