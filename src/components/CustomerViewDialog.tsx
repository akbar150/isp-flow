import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, User, Phone, MapPin, Package, Calendar as CalendarIconAlt, CreditCard, Wifi, Key, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerCallRecords } from "./CustomerCallRecords";
import { CustomerBillingHistory } from "./CustomerBillingHistory";
import { StatusBadge } from "./StatusBadge";

interface Package {
  id: string;
  name: string;
  speed_mbps: number;
  monthly_price: number;
}

interface Area {
  id: string;
  name: string;
}

interface Router {
  id: string;
  name: string;
}

interface MikrotikUser {
  id: string;
  username: string;
  status: 'enabled' | 'disabled';
}

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  address: string;
  area_id: string | null;
  router_id: string | null;
  package_id: string | null;
  billing_start_date: string;
  expiry_date: string;
  status: 'active' | 'expiring' | 'expired' | 'suspended';
  total_due: number;
  packages?: Package | null;
  areas?: Area | null;
  routers?: Router | null;
  mikrotik_users?: MikrotikUser[] | null;
}

interface CustomerViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  packages: Package[];
  areas: Area[];
  routers: Router[];
  onSuccess: () => void;
  canEdit: boolean;
}

export function CustomerViewDialog({
  open,
  onOpenChange,
  customer,
  packages,
  areas,
  routers,
  onSuccess,
  canEdit,
}: CustomerViewDialogProps) {
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    alt_phone: "",
    address: "",
    area_id: "",
    router_id: "",
    package_id: "",
    status: "active" as Customer["status"],
    billing_start_date: new Date(),
    expiry_date: new Date(),
  });
  
  // Credential editing
  const [credentialData, setCredentialData] = useState({
    pppoe_username: "",
    pppoe_password: "",
    user_password: "",
  });
  const [savingCredentials, setSavingCredentials] = useState(false);

  useEffect(() => {
    if (customer) {
      setFormData({
        full_name: customer.full_name,
        phone: customer.phone,
        alt_phone: customer.alt_phone || "",
        address: customer.address,
        area_id: customer.area_id || "",
        router_id: customer.router_id || "",
        package_id: customer.package_id || "",
        status: customer.status,
        billing_start_date: new Date(customer.billing_start_date),
        expiry_date: new Date(customer.expiry_date),
      });
      setCredentialData({
        pppoe_username: customer.mikrotik_users?.[0]?.username || "",
        pppoe_password: "",
        user_password: "",
      });
      setIsEditing(false);
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          alt_phone: formData.alt_phone || null,
          address: formData.address,
          area_id: formData.area_id || null,
          router_id: formData.router_id || null,
          package_id: formData.package_id || null,
          status: formData.status,
          billing_start_date: format(formData.billing_start_date, "yyyy-MM-dd"),
          expiry_date: format(formData.expiry_date, "yyyy-MM-dd"),
        })
        .eq("id", customer.id);

      if (error) throw error;

      toast({ title: "Customer updated successfully" });
      setIsEditing(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast({
        title: "Error",
        description: "Failed to update customer",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!customer) return;
    
    setSavingCredentials(true);
    try {
      // Update PPPoE username if changed
      if (credentialData.pppoe_username && credentialData.pppoe_username !== customer.mikrotik_users?.[0]?.username) {
        const mikrotikUser = customer.mikrotik_users?.[0];
        if (mikrotikUser) {
          const { error: pppoeError } = await supabase
            .from("mikrotik_users")
            .update({ username: credentialData.pppoe_username })
            .eq("id", mikrotikUser.id);
          
          if (pppoeError) throw pppoeError;
        }
      }

      // Update PPPoE password if provided
      if (credentialData.pppoe_password) {
        const mikrotikUser = customer.mikrotik_users?.[0];
        if (mikrotikUser) {
          // Hash the password using the database function
          const { data: hashData, error: hashError } = await supabase.rpc('hash_password', {
            raw_password: credentialData.pppoe_password
          });
          
          if (hashError) throw hashError;
          
          const { error: pppoePassError } = await supabase
            .from("mikrotik_users")
            .update({ password_encrypted: hashData })
            .eq("id", mikrotikUser.id);
          
          if (pppoePassError) throw pppoePassError;
        }
      }

      // Update user/portal password if provided
      if (credentialData.user_password) {
        // Hash the password using the database function
        const { data: hashData, error: hashError } = await supabase.rpc('hash_password', {
          raw_password: credentialData.user_password
        });
        
        if (hashError) throw hashError;
        
        const { error: userPassError } = await supabase
          .from("customers")
          .update({ password_hash: hashData })
          .eq("id", customer.id);
        
        if (userPassError) throw userPassError;
      }

      toast({ title: "Credentials updated successfully" });
      setCredentialData({ 
        ...credentialData, 
        pppoe_password: "", 
        user_password: "" 
      });
      onSuccess();
    } catch (error) {
      console.error("Error updating credentials:", error);
      toast({
        title: "Error",
        description: "Failed to update credentials",
        variant: "destructive",
      });
    } finally {
      setSavingCredentials(false);
    }
  };

  if (!customer) return null;

  const pppoeUsername = customer.mikrotik_users?.[0]?.username || "Not set";
  const selectedPackage = packages.find(p => p.id === customer.package_id);
  const selectedArea = areas.find(a => a.id === customer.area_id);
  const selectedRouter = routers.find(r => r.id === customer.router_id);
  
  const today = startOfDay(new Date());
  const expiryDate = startOfDay(new Date(customer.expiry_date));
  const daysRemaining = differenceInDays(expiryDate, today);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Details: {pppoeUsername}
          </DialogTitle>
          <DialogDescription>
            View and manage customer information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {!isEditing ? (
              // View Mode
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PPPoE Username */}
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Wifi className="h-4 w-4" />
                      PPPoE Username
                    </div>
                    <p className="font-mono font-medium">{pppoeUsername}</p>
                  </div>

                  {/* Customer ID */}
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <User className="h-4 w-4" />
                      Customer ID
                    </div>
                    <p className="font-mono font-medium">{customer.user_id}</p>
                  </div>

                  {/* Full Name */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <User className="h-4 w-4" />
                      Full Name
                    </div>
                    <p className="font-medium">{customer.full_name}</p>
                  </div>

                  {/* Phone */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Phone className="h-4 w-4" />
                      Phone
                    </div>
                    <p className="font-medium">{customer.phone}</p>
                    {customer.alt_phone && (
                      <p className="text-sm text-muted-foreground">Alt: {customer.alt_phone}</p>
                    )}
                  </div>

                  {/* Package */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Package className="h-4 w-4" />
                      Package
                    </div>
                    <p className="font-medium">
                      {selectedPackage ? `${selectedPackage.name} (${selectedPackage.speed_mbps} Mbps)` : "N/A"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ৳{selectedPackage?.monthly_price || 0}/month
                    </p>
                  </div>

                  {/* Status */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      Status
                    </div>
                    <StatusBadge status={customer.status} />
                  </div>

                  {/* Address */}
                  <div className="p-4 border rounded-lg md:col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <MapPin className="h-4 w-4" />
                      Address
                    </div>
                    <p className="font-medium">{customer.address}</p>
                    <p className="text-sm text-muted-foreground">
                      Area: {selectedArea?.name || "N/A"} | Router: {selectedRouter?.name || "N/A"}
                    </p>
                  </div>

                  {/* Billing Start Date */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <CalendarIconAlt className="h-4 w-4" />
                      Billing Start Date
                    </div>
                    <p className="font-medium">{format(new Date(customer.billing_start_date), "dd MMM yyyy")}</p>
                  </div>

                  {/* Next Billing Date / Expiry */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <CalendarIconAlt className="h-4 w-4" />
                      Next Billing Date
                    </div>
                    <p className="font-medium">{format(new Date(customer.expiry_date), "dd MMM yyyy")}</p>
                    <p className={cn(
                      "text-sm",
                      daysRemaining < 0 ? "text-destructive" : daysRemaining <= 3 ? "text-yellow-600" : "text-muted-foreground"
                    )}>
                      {daysRemaining < 0 
                        ? `${Math.abs(daysRemaining)} days overdue` 
                        : daysRemaining === 0 
                          ? "Today" 
                          : `${daysRemaining} days remaining`}
                    </p>
                  </div>

                  {/* Total Due */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <CreditCard className="h-4 w-4" />
                      Total Due
                    </div>
                    <p className={cn(
                      "text-xl font-bold",
                      customer.total_due > 0 ? "text-destructive" : "text-green-600"
                    )}>
                      ৳{customer.total_due.toLocaleString()}
                    </p>
                  </div>

                  {/* Created At */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <CalendarIconAlt className="h-4 w-4" />
                      Account Created
                    </div>
                    <p className="font-medium">{format(new Date(customer.billing_start_date), "dd MMM yyyy")}</p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={() => setIsEditing(true)}>
                      Edit Customer
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              // Edit Mode
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
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
                    <Label>Package</Label>
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
                    <Label>Address *</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
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
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as Customer["status"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expiring">Expiring</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.billing_start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.billing_start_date
                            ? format(formData.billing_start_date, "dd MMM yyyy")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.billing_start_date}
                          onSelect={(date) => date && setFormData({ ...formData, billing_start_date: date })}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Next Billing Date (Expiry)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.expiry_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.expiry_date
                            ? format(formData.expiry_date, "dd MMM yyyy")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.expiry_date}
                          onSelect={(date) => date && setFormData({ ...formData, expiry_date: date })}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>

          <TabsContent value="credentials" className="space-y-6 mt-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Security Note:</strong> Password fields are blank for security. 
                Enter a new password only if you want to change it.
              </p>
            </div>

            <div className="space-y-4">
              {/* PPPoE Username */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  PPPoE Username
                </Label>
                <Input
                  value={credentialData.pppoe_username}
                  onChange={(e) => setCredentialData({ ...credentialData, pppoe_username: e.target.value })}
                  placeholder="PPPoE username"
                  disabled={!canEdit}
                />
              </div>

              {/* PPPoE Password */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  PPPoE Password
                </Label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={credentialData.pppoe_password}
                    onChange={(e) => setCredentialData({ ...credentialData, pppoe_password: e.target.value })}
                    placeholder="Enter new password to change"
                    disabled={!canEdit}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 4 characters</p>
              </div>

              {/* User/Portal Password */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Portal Password (Customer Login)
                </Label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={credentialData.user_password}
                    onChange={(e) => setCredentialData({ ...credentialData, user_password: e.target.value })}
                    placeholder="Enter new password to change"
                    disabled={!canEdit}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
              </div>

              {canEdit && (
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSaveCredentials} 
                    disabled={savingCredentials || (!credentialData.pppoe_username && !credentialData.pppoe_password && !credentialData.user_password)}
                  >
                    {savingCredentials && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Credentials
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <CustomerBillingHistory 
              customerId={customer.id} 
              customerName={customer.full_name} 
            />
          </TabsContent>

          <TabsContent value="calls" className="mt-4">
            <CustomerCallRecords 
              customerId={customer.id} 
              customerName={customer.full_name} 
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
