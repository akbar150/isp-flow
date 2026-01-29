import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { CredentialsModal } from "@/components/CredentialsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Eye, EyeOff, RefreshCw } from "lucide-react";
import { format, addDays } from "date-fns";

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
  packages: Package | null;
  areas: Area | null;
  routers: Router | null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Credentials modal state (secure password display)
  const [credentialsModal, setCredentialsModal] = useState({
    open: false,
    userId: "",
    password: "",
  });

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    alt_phone: "",
    address: "",
    area_id: "",
    router_id: "",
    package_id: "",
    password: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, packagesRes, areasRes, routersRes] = await Promise.all([
        // Use customers_safe view to prevent password_hash exposure
        supabase.from('customers_safe').select('*, packages(*), areas(*), routers(*)').order('created_at', { ascending: false }),
        supabase.from('packages').select('*').eq('is_active', true),
        supabase.from('areas').select('*'),
        supabase.from('routers').select('*').eq('is_active', true),
      ]);

      if (customersRes.error) throw customersRes.error;
      setCustomers(customersRes.data as Customer[] || []);
      setPackages(packagesRes.data || []);
      setAreas(areasRes.data || []);
      setRouters(routersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    // Cryptographically secure password generation
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
    setFormData({ ...formData, password });
  };

  const generateUserId = async (): Promise<string> => {
    // Use database function with sequence to prevent race conditions
    const { data, error } = await supabase.rpc('generate_customer_user_id');
    if (error) throw new Error('Failed to generate user ID');
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Comprehensive input validation
      if (!formData.full_name || formData.full_name.trim().length < 3) {
        throw new Error('Full name must be at least 3 characters');
      }
      if (formData.full_name.length > 100) {
        throw new Error('Full name too long (max 100 characters)');
      }

      // Phone validation (Bangladesh format or international)
      const phoneRegex = /^(\+?880)?[0-9]{10,11}$/;
      const cleanPhone = formData.phone.replace(/[\s-]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        throw new Error('Invalid phone number format');
      }

      // Alt phone validation if provided
      if (formData.alt_phone && formData.alt_phone.trim()) {
        const cleanAltPhone = formData.alt_phone.replace(/[\s-]/g, '');
        if (!phoneRegex.test(cleanAltPhone)) {
          throw new Error('Invalid alternative phone number format');
        }
      }

      // Address validation
      if (!formData.address || formData.address.trim().length < 10) {
        throw new Error('Address must be at least 10 characters');
      }
      if (formData.address.length > 500) {
        throw new Error('Address too long (max 500 characters)');
      }

      // Validate password strength
      if (formData.password.length < 12) {
        throw new Error('Password must be at least 12 characters long');
      }
      
      const selectedPackage = packages.find(p => p.id === formData.package_id);
      if (!selectedPackage) throw new Error('Please select a package');

      const userId = await generateUserId();
      const today = new Date();
      const expiryDate = addDays(today, selectedPackage.validity_days);

      // Hash password using database function (bcrypt)
      const { data: hashedPassword, error: hashError } = await supabase
        .rpc('hash_password', { raw_password: formData.password });
      
      if (hashError) throw new Error('Failed to secure password');

      const { error } = await supabase.from('customers').insert({
        user_id: userId,
        full_name: formData.full_name,
        phone: formData.phone,
        alt_phone: formData.alt_phone || null,
        address: formData.address,
        area_id: formData.area_id || null,
        router_id: formData.router_id || null,
        package_id: formData.package_id,
        password_hash: hashedPassword,
        billing_start_date: format(today, 'yyyy-MM-dd'),
        expiry_date: format(expiryDate, 'yyyy-MM-dd'),
        status: 'active',
        total_due: selectedPackage.monthly_price,
      });

      if (error) throw error;

      // Show secure credentials modal instead of toast
      setCredentialsModal({
        open: true,
        userId: userId,
        password: formData.password,
      });

      setDialogOpen(false);
      setFormData({
        full_name: "",
        phone: "",
        alt_phone: "",
        address: "",
        area_id: "",
        router_id: "",
        package_id: "",
        password: "",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create customer",
        variant: "destructive",
      });
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading customers...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-description">Manage your ISP customers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
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
                  <Label>Phone (WhatsApp) *</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+8801XXXXXXXXX"
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Password *</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
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
                    <Button type="button" variant="outline" onClick={generatePassword}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This password will only be shown once during creation
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Customer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Table */}
      <div className="form-section overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Package</th>
              <th>Expiry</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  No customers found
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-mono text-sm">{customer.user_id}</td>
                  <td className="font-medium">{customer.full_name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.packages?.name || 'N/A'}</td>
                  <td>{format(new Date(customer.expiry_date), 'dd MMM yyyy')}</td>
                  <td className={customer.total_due > 0 ? "amount-due" : "amount-positive"}>
                    ৳{customer.total_due}
                  </td>
                  <td>
                    <StatusBadge status={customer.status} />
                  </td>
                  <td>
                    <WhatsAppButton
                      phone={customer.phone}
                      customerName={customer.full_name}
                      userId={customer.user_id}
                      packageName={customer.packages?.name || 'Internet'}
                      expiryDate={new Date(customer.expiry_date)}
                      amount={customer.packages?.monthly_price || customer.total_due}
                      variant="icon"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Secure Credentials Modal */}
      <CredentialsModal
        open={credentialsModal.open}
        onOpenChange={(open) => setCredentialsModal({ ...credentialsModal, open })}
        userId={credentialsModal.userId}
        password={credentialsModal.password}
        onConfirm={() => {
          toast({
            title: "Customer created successfully",
            description: `User ID: ${credentialsModal.userId}`,
          });
        }}
      />
    </DashboardLayout>
  );
}
