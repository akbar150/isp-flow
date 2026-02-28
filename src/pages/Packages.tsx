import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Edit2, Trash2, MoreVertical } from "lucide-react";

interface Package {
  id: string;
  name: string;
  speed_mbps: number;
  monthly_price: number;
  validity_days: number;
  description: string | null;
  is_active: boolean;
  customer_count?: number;
}

export default function Packages() {
  const { isSuperAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    speed_mbps: "",
    monthly_price: "",
    validity_days: "30",
    description: "",
    is_active: true,
  });

  // Permission checks
  const canCreatePackage = isSuperAdmin || canCreate("packages");
  const canEditPackage = isSuperAdmin || canUpdate("packages");
  const canDeletePackage = isSuperAdmin || canDelete("packages");

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const [pkgRes, countRes] = await Promise.all([
        supabase.from('packages').select('*').order('monthly_price', { ascending: true }),
        supabase.from('customers').select('package_id'),
      ]);

      if (pkgRes.error) throw pkgRes.error;

      // Count customers per package
      const countMap: Record<string, number> = {};
      (countRes.data || []).forEach((c: { package_id: string | null }) => {
        if (c.package_id) countMap[c.package_id] = (countMap[c.package_id] || 0) + 1;
      });

      const packagesWithCount = (pkgRes.data || []).map(p => ({
        ...p,
        customer_count: countMap[p.id] || 0,
      }));

      setPackages(packagesWithCount);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Input validation
      const speedMbps = parseInt(formData.speed_mbps);
      const monthlyPrice = parseFloat(formData.monthly_price);
      const validityDays = parseInt(formData.validity_days);

      if (!formData.name || formData.name.trim().length < 3) {
        throw new Error('Package name must be at least 3 characters');
      }
      if (formData.name.length > 50) {
        throw new Error('Package name too long (max 50 characters)');
      }

      if (isNaN(speedMbps) || speedMbps <= 0 || speedMbps > 10000) {
        throw new Error('Speed must be between 1 and 10,000 Mbps');
      }

      if (isNaN(monthlyPrice) || monthlyPrice <= 0 || monthlyPrice > 999999) {
        throw new Error('Price must be between ৳1 and ৳999,999');
      }

      if (isNaN(validityDays) || validityDays <= 0 || validityDays > 365) {
        throw new Error('Validity must be between 1 and 365 days');
      }

      const packageData = {
        name: formData.name.trim(),
        speed_mbps: speedMbps,
        monthly_price: monthlyPrice,
        validity_days: validityDays,
        description: formData.description || null,
        is_active: formData.is_active,
      };

      if (editingPackage) {
        const { error } = await supabase
          .from('packages')
          .update(packageData)
          .eq('id', editingPackage.id);

        if (error) throw error;
        toast({ title: "Package updated successfully" });
      } else {
        const { error } = await supabase.from('packages').insert(packageData);
        if (error) throw error;
        toast({ title: "Package created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save package",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (pkg: Package) => {
    if (!canEditPackage) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to edit packages",
        variant: "destructive",
      });
      return;
    }
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      speed_mbps: String(pkg.speed_mbps),
      monthly_price: String(pkg.monthly_price),
      validity_days: String(pkg.validity_days),
      description: pkg.description || "",
      is_active: pkg.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDeletePackage) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to delete packages",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Are you sure you want to delete this package?")) return;

    try {
      const { error } = await supabase.from('packages').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Package deleted" });
      fetchPackages();
    } catch (error) {
      toast({
        title: "Error",
        description: "Cannot delete package (may be in use)",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingPackage(null);
    setFormData({
      name: "",
      speed_mbps: "",
      monthly_price: "",
      validity_days: "30",
      description: "",
      is_active: true,
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading packages...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Internet Packages</h1>
          <p className="page-description">Manage your service packages and pricing</p>
        </div>
        {canCreatePackage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Package
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPackage ? "Edit Package" : "Add New Package"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Package Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Plan"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Speed (Mbps) *</Label>
                    <Input
                      type="number"
                      value={formData.speed_mbps}
                      onChange={(e) => setFormData({ ...formData, speed_mbps: e.target.value })}
                      placeholder="20"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Price (৳) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.monthly_price}
                      onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                      placeholder="500"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Validity Days *</Label>
                  <Input
                    type="number"
                    value={formData.validity_days}
                    onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Package features and details..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPackage ? "Update" : "Create"} Package
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No packages yet. Create your first package to get started.
          </div>
        ) : (
          packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`form-section relative ${!pkg.is_active ? 'opacity-60' : ''}`}
            >
              {/* Actions dropdown - only show if user has edit or delete permission */}
              {(canEditPackage || canDeletePackage) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEditPackage && (
                      <DropdownMenuItem onClick={() => handleEdit(pkg)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDeletePackage && (
                      <>
                        {canEditPackage && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(pkg.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {!pkg.is_active && (
                <span className="absolute top-3 left-3 text-xs bg-muted px-2 py-1 rounded">
                  Inactive
                </span>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{pkg.name}</h3>
                <p className="text-3xl font-bold text-primary mt-2">
                  ৳{pkg.monthly_price}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <p>🚀 Speed: {pkg.speed_mbps} Mbps</p>
                <p>📅 Validity: {pkg.validity_days} days</p>
                <p>👥 Customers: <span className="font-semibold text-foreground">{pkg.customer_count || 0}</span></p>
                {pkg.description && <p>📋 {pkg.description}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}