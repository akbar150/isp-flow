import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { Plus, Trash2, Eye, EyeOff, RefreshCw, Loader2 } from "lucide-react";
import { normalizePhone, isValidBDPhone } from "@/lib/phoneUtils";

interface Package {
  id: string;
  name: string;
  speed_mbps: number;
  monthly_price: number;
  validity_days: number;
}

interface Area {
  id: string;
  name: string;
}

interface Router {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  product_id: string;
  serial_number: string | null;
  mac_address: string | null;
  status: string;
  products: {
    id: string;
    name: string;
    brand: string | null;
  } | null;
}

interface ProductAssignment {
  inventory_item_id: string;
  condition: string;
  notes: string;
  account_type: 'free' | 'paid';
}

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: Package[];
  areas: Area[];
  routers: Router[];
  onSuccess: (credentials: {
    userId: string;
    password: string;
    pppoeUsername: string;
    pppoePassword: string;
  }) => void;
}

const conditionOptions = ["New", "Good", "Fair", "Refurbished"];

export function AddCustomerDialog({
  open,
  onOpenChange,
  packages,
  areas,
  routers,
  onSuccess,
}: AddCustomerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  
  // Form data
  const [formData, setFormData] = useState({
    // Basic Info
    full_name: "",
    phone: "",
    alt_phone: "",
    package_id: "",
    password: "",
    pppoe_username: "",
    pppoe_password: "",
    // Location & GPS
    address: "",
    area_id: "",
    router_id: "",
    connection_type: "pppoe",
    billing_cycle: "monthly",
    latitude: "",
    longitude: "",
    // Products
    technician_name: "",
  });

  const [productAssignments, setProductAssignments] = useState<ProductAssignment[]>([]);

  useEffect(() => {
    if (open) {
      fetchAvailableItems();
    }
  }, [open]);

  const fetchAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, product_id, serial_number, mac_address, status, products(id, name, brand)")
        .eq("status", "in_stock")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAvailableItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
    }
  };

  const generatePassword = (forField: 'password' | 'pppoe_password' = 'password') => {
    const length = forField === 'pppoe_password' ? 6 : 8;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    setFormData({ ...formData, [forField]: password });
  };

  const addProductAssignment = () => {
    setProductAssignments([...productAssignments, { inventory_item_id: "", condition: "New", notes: "", account_type: "free" }]);
  };

  const removeProductAssignment = (index: number) => {
    setProductAssignments(productAssignments.filter((_, i) => i !== index));
  };

  const updateProductAssignment = (index: number, field: keyof ProductAssignment, value: string) => {
    const updated = [...productAssignments];
    updated[index] = { ...updated[index], [field]: value };
    setProductAssignments(updated);
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      alt_phone: "",
      package_id: "",
      password: "",
      pppoe_username: "",
      pppoe_password: "",
      address: "",
      area_id: "",
      router_id: "",
      connection_type: "pppoe",
      billing_cycle: "monthly",
      latitude: "",
      longitude: "",
      technician_name: "",
    });
    setProductAssignments([]);
    setActiveTab("basic");
  };

  const handleSubmit = async () => {
    setSaving(true);
    
    try {
      // Validations
      if (!formData.full_name || formData.full_name.trim().length < 3) {
        throw new Error('Full name must be at least 3 characters');
      }

      if (!isValidBDPhone(formData.phone)) {
        throw new Error('Phone must start with 880 (e.g., 8801701377315)');
      }

      if (formData.alt_phone && formData.alt_phone.trim() && !isValidBDPhone(formData.alt_phone)) {
        throw new Error('Alternative phone must start with 880 (e.g., 8801701377315)');
      }

      if (!formData.address || formData.address.trim().length < 10) {
        throw new Error('Address must be at least 10 characters');
      }

      if (formData.password.length < 6) {
        throw new Error('Portal password must be at least 6 characters');
      }

      if (!formData.pppoe_username || formData.pppoe_username.trim().length < 3) {
        throw new Error('PPPoE Username must be at least 3 characters');
      }

      if (!formData.pppoe_password || formData.pppoe_password.length < 4) {
        throw new Error('PPPoE Password must be at least 4 characters');
      }
      
      const selectedPackage = packages.find(p => p.id === formData.package_id);
      if (!selectedPackage) throw new Error('Please select a package');

      // Generate user ID
      const { data: userId, error: userIdError } = await supabase.rpc('generate_customer_user_id');
      if (userIdError) throw new Error('Failed to generate user ID');

      // Hash passwords
      const { data: hashedPassword, error: hashError } = await supabase
        .rpc('hash_password', { raw_password: formData.password });
      if (hashError) throw new Error('Failed to secure password');

      const { data: hashedPppoePassword, error: pppoeHashError } = await supabase
        .rpc('hash_password', { raw_password: formData.pppoe_password });
      if (pppoeHashError) throw new Error('Failed to secure PPPoE password');

      const today = new Date();
      const expiryDate = addDays(today, selectedPackage.validity_days);

      // Create customer
      const { data: newCustomer, error: customerError } = await supabase.from('customers').insert({
        user_id: userId,
        full_name: formData.full_name,
        phone: normalizePhone(formData.phone),
        alt_phone: formData.alt_phone ? normalizePhone(formData.alt_phone) : null,
        address: formData.address,
        area_id: formData.area_id || null,
        router_id: formData.router_id || null,
        package_id: formData.package_id,
        password_hash: hashedPassword,
        billing_start_date: format(today, 'yyyy-MM-dd'),
        expiry_date: format(expiryDate, 'yyyy-MM-dd'),
        status: 'active',
        total_due: selectedPackage.monthly_price,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        connection_type: formData.connection_type as any,
        billing_cycle: formData.billing_cycle as any,
      }).select('id').single();

      if (customerError) throw customerError;

      // Create Mikrotik user
      await supabase.from('mikrotik_users').insert({
        customer_id: newCustomer.id,
        username: formData.pppoe_username,
        password_encrypted: hashedPppoePassword,
        router_id: formData.router_id || null,
        profile: selectedPackage.name,
        status: 'enabled',
      });

      // Create asset assignments
      if (productAssignments.length > 0) {
        const validAssignments = productAssignments.filter(pa => pa.inventory_item_id);
        
        for (const assignment of validAssignments) {
          // Get item details for pricing
          const { data: itemData } = await supabase
            .from('inventory_items')
            .select('product_id, purchase_price, products(purchase_price, selling_price)')
            .eq('id', assignment.inventory_item_id)
            .single();

          // Create assignment with account type and pricing
          await supabase.from('asset_assignments').insert({
            customer_id: newCustomer.id,
            inventory_item_id: assignment.inventory_item_id,
            condition_on_assign: assignment.condition,
            item_condition: assignment.condition,
            technician_name: formData.technician_name || null,
            notes: assignment.notes || null,
            account_type: assignment.account_type,
            purchase_price_at_assign: itemData?.purchase_price || (itemData?.products as any)?.purchase_price || 0,
            selling_price: assignment.account_type === 'paid' ? (itemData?.products as any)?.selling_price || 0 : 0,
          });

          // Update inventory item status
          await supabase
            .from('inventory_items')
            .update({ status: 'assigned' })
            .eq('id', assignment.inventory_item_id);

          // Update product stock quantity (decrease by 1)
          if (itemData?.product_id) {
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', itemData.product_id)
              .single();
            
            if (product) {
              await supabase
                .from('products')
                .update({ stock_quantity: Math.max(0, product.stock_quantity - 1) })
                .eq('id', itemData.product_id);
            }
          }

          // If paid, create a transaction for accounting
          if (assignment.account_type === 'paid' && itemData?.products) {
            const profit = ((itemData.products as any).selling_price || 0) - ((itemData.products as any).purchase_price || 0);
            
            // Record as income transaction
            await supabase.from('transactions').insert({
              type: 'income',
              amount: (itemData.products as any).selling_price || 0,
              payment_method: 'cash',
              description: `Product sale: ${assignment.inventory_item_id.slice(0, 8)} to ${formData.full_name}`,
              transaction_date: format(today, 'yyyy-MM-dd'),
            });
          }
        }
      }

      onSuccess({
        userId,
        password: formData.password,
        pppoeUsername: formData.pppoe_username,
        pppoePassword: formData.pppoe_password,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create customer",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get items not already selected
  const getAvailableItemsForSelect = (currentIndex: number) => {
    const selectedIds = productAssignments
      .map((pa, i) => i !== currentIndex ? pa.inventory_item_id : null)
      .filter(Boolean);
    return availableItems.filter(item => !selectedIds.includes(item.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="location">Location & GPS</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>

          {/* Tab 1: Basic Info */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Customer full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone (WhatsApp) *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="8801XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Alternative Phone</Label>
                <Input
                  value={formData.alt_phone}
                  onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Package *</Label>
                <Select
                  value={formData.package_id}
                  onValueChange={(value) => setFormData({ ...formData, package_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} - {pkg.speed_mbps} Mbps (৳{pkg.monthly_price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Portal Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={() => generatePassword('password')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Min 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label>PPPoE Username *</Label>
                <Input
                  value={formData.pppoe_username}
                  onChange={(e) => setFormData({ ...formData, pppoe_username: e.target.value })}
                  placeholder="e.g., customer_pppoe"
                />
              </div>
              <div className="space-y-2">
                <Label>PPPoE Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPppoePassword ? "text" : "password"}
                      value={formData.pppoe_password}
                      onChange={(e) => setFormData({ ...formData, pppoe_password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPppoePassword(!showPppoePassword)}
                    >
                      {showPppoePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={() => generatePassword('pppoe_password')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Min 4 characters</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setActiveTab("location")}>
                Next: Location & GPS
              </Button>
            </div>
          </TabsContent>

          {/* Tab 2: Location & GPS */}
          <TabsContent value="location" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address (min 10 characters)"
                />
              </div>

              <div className="space-y-2">
                <Label>Area/Zone</Label>
                <Select
                  value={formData.area_id}
                  onValueChange={(value) => setFormData({ ...formData, area_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((area) => (
                      <SelectItem key={area.id} value={area.id}>
                        {area.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Router</Label>
                <Select
                  value={formData.router_id}
                  onValueChange={(value) => setFormData({ ...formData, router_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select router" />
                  </SelectTrigger>
                  <SelectContent>
                    {routers.map((router) => (
                      <SelectItem key={router.id} value={router.id}>
                        {router.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Connection Type</Label>
                <Select
                  value={formData.connection_type}
                  onValueChange={(value) => setFormData({ ...formData, connection_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pppoe">PPPoE</SelectItem>
                    <SelectItem value="static">Static IP</SelectItem>
                    <SelectItem value="dhcp">DHCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select
                  value={formData.billing_cycle}
                  onValueChange={(value) => setFormData({ ...formData, billing_cycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="e.g., 23.8103"
                />
              </div>

              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="e.g., 90.4125"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("basic")}>
                Back
              </Button>
              <Button onClick={() => setActiveTab("products")}>
                Next: Assign Products
              </Button>
            </div>
          </TabsContent>

          {/* Tab 3: Products */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Technician Name</Label>
              <Input
                value={formData.technician_name}
                onChange={(e) => setFormData({ ...formData, technician_name: e.target.value })}
                placeholder="Name of installing technician"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Assign Products (Optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addProductAssignment}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>

              {productAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  No products assigned. Click "Add Product" to assign devices to this customer.
                </p>
              ) : (
                <div className="space-y-3">
                  {productAssignments.map((assignment, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Product {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProductAssignment(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Select Item</Label>
                          <Select
                            value={assignment.inventory_item_id}
                            onValueChange={(v) => updateProductAssignment(index, "inventory_item_id", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableItemsForSelect(index).map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.products?.name} - {item.mac_address || item.serial_number || "N/A"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Condition</Label>
                          <Select
                            value={assignment.condition}
                            onValueChange={(v) => updateProductAssignment(index, "condition", v)}
                          >
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

                        <div>
                          <Label className="text-xs">Account Type *</Label>
                          <Select
                            value={assignment.account_type}
                            onValueChange={(v) => updateProductAssignment(index, "account_type", v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free (No Invoice)</SelectItem>
                              <SelectItem value="paid">Paid (Generate Invoice)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Notes</Label>
                          <Input
                            value={assignment.notes}
                            onChange={(e) => updateProductAssignment(index, "notes", e.target.value)}
                            placeholder="Optional notes"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setActiveTab("location")}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Customer
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
