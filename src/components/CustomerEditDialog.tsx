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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface CustomerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  packages: Package[];
  areas: Area[];
  routers: Router[];
  onSuccess: () => void;
}

export function CustomerEditDialog({
  open,
  onOpenChange,
  customer,
  packages,
  areas,
  routers,
  onSuccess,
}: CustomerEditDialogProps) {
  const [saving, setSaving] = useState(false);
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
      onOpenChange(false);
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

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer: {customer.user_id}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
