import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { EmailButton } from "@/components/EmailButton";
import { CredentialsModal } from "@/components/CredentialsModal";
import { CustomerEditDialog } from "@/components/CustomerEditDialog";
import { CustomerViewDialog } from "@/components/CustomerViewDialog";
import { QuickCallRecord } from "@/components/QuickCallRecord";
import { QuickPaymentRecord } from "@/components/QuickPaymentRecord";
import { BulkCustomerUpload } from "@/components/BulkCustomerUpload";
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
import { Plus, Search, Eye, EyeOff, RefreshCw, MoreHorizontal, Edit, Trash2, UserCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, addDays } from "date-fns";
import { calculateBillingInfo } from "@/lib/billingUtils";

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
  packages: Package | null;
  areas: Area | null;
  routers: Router | null;
  mikrotik_users: MikrotikUser[] | null;
}

type SortDirection = 'asc' | 'desc' | null;

export default function Customers() {
  const { isSuperAdmin } = useAuth();
  const { canRead, canUpdate, canDelete } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dateSortDirection, setDateSortDirection] = useState<SortDirection>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  
  // Credentials modal state (secure password display)
  const [credentialsModal, setCredentialsModal] = useState({
    open: false,
    userId: "",
    password: "",
    pppoeUsername: "",
    pppoePassword: "",
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
    pppoe_username: "",
    pppoe_password: "",
  });
  const [showPppoePassword, setShowPppoePassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, packagesRes, areasRes, routersRes] = await Promise.all([
        supabase.from('customers_safe').select('*, packages(*), areas(*), routers(*), mikrotik_users:mikrotik_users_safe(id, username, status)').order('created_at', { ascending: false }),
        supabase.from('packages').select('*').eq('is_active', true),
        supabase.from('areas').select('*'),
        supabase.from('routers').select('*').eq('is_active', true),
      ]);

      if (customersRes.error) throw customersRes.error;
      setCustomers(customersRes.data as unknown as Customer[] || []);
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

  const generateUserId = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_customer_user_id');
    if (error) throw new Error('Failed to generate user ID');
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.full_name || formData.full_name.trim().length < 3) {
        throw new Error('Full name must be at least 3 characters');
      }
      if (formData.full_name.length > 100) {
        throw new Error('Full name too long (max 100 characters)');
      }

      const phoneRegex = /^(\+?880)?[0-9]{10,11}$/;
      const cleanPhone = formData.phone.replace(/[\s-]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        throw new Error('Invalid phone number format');
      }

      if (formData.alt_phone && formData.alt_phone.trim()) {
        const cleanAltPhone = formData.alt_phone.replace(/[\s-]/g, '');
        if (!phoneRegex.test(cleanAltPhone)) {
          throw new Error('Invalid alternative phone number format');
        }
      }

      if (!formData.address || formData.address.trim().length < 10) {
        throw new Error('Address must be at least 10 characters');
      }
      if (formData.address.length > 500) {
        throw new Error('Address too long (max 500 characters)');
      }

      if (formData.password.length < 6) {
        throw new Error('Portal password must be at least 6 characters');
      }
      if (!/^[a-zA-Z0-9]+$/.test(formData.password)) {
        throw new Error('Portal password can only contain letters and numbers');
      }

      if (!formData.pppoe_username || formData.pppoe_username.trim().length < 3) {
        throw new Error('PPPoE Username must be at least 3 characters');
      }
      if (!formData.pppoe_password || formData.pppoe_password.length < 4) {
        throw new Error('PPPoE Password must be at least 4 characters');
      }
      if (!/^[a-zA-Z0-9]+$/.test(formData.pppoe_password)) {
        throw new Error('PPPoE Password can only contain letters and numbers');
      }
      
      const selectedPackage = packages.find(p => p.id === formData.package_id);
      if (!selectedPackage) throw new Error('Please select a package');

      const userId = await generateUserId();
      const today = new Date();
      const expiryDate = addDays(today, selectedPackage.validity_days);

      const { data: hashedPassword, error: hashError } = await supabase
        .rpc('hash_password', { raw_password: formData.password });
      
      if (hashError) throw new Error('Failed to secure password');

      const { data: hashedPppoePassword, error: pppoeHashError } = await supabase
        .rpc('hash_password', { raw_password: formData.pppoe_password });
      
      if (pppoeHashError) throw new Error('Failed to secure PPPoE password');

      const { data: newCustomer, error } = await supabase.from('customers').insert({
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
      }).select('id').single();

      if (error) throw error;

      const { error: mikrotikError } = await supabase.from('mikrotik_users').insert({
        customer_id: newCustomer.id,
        username: formData.pppoe_username,
        password_encrypted: hashedPppoePassword,
        router_id: formData.router_id || null,
        profile: selectedPackage.name,
        status: 'enabled',
      });

      if (mikrotikError) {
        console.error('Failed to create PPPoE user:', mikrotikError);
      }

      setCredentialsModal({
        open: true,
        userId: userId,
        password: formData.password,
        pppoeUsername: formData.pppoe_username,
        pppoePassword: formData.pppoe_password,
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
        pppoe_username: "",
        pppoe_password: "",
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

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to delete ${customer.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);

      if (error) throw error;

      toast({ title: "Customer deleted successfully" });
      fetchData();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error",
        description: "Failed to delete customer. They may have associated records.",
        variant: "destructive",
      });
    }
  };

  const toggleDateSort = () => {
    if (dateSortDirection === null) {
      setDateSortDirection('asc');
    } else if (dateSortDirection === 'asc') {
      setDateSortDirection('desc');
    } else {
      setDateSortDirection(null);
    }
  };

  const filteredCustomers = customers
    .filter(customer => {
      const pppoeUsername = customer.mikrotik_users?.[0]?.username || '';
      const matchesSearch = 
        customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pppoeUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm);
      
      const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (dateSortDirection === null) return 0;
      
      const dateA = new Date(a.expiry_date).getTime();
      const dateB = new Date(b.expiry_date).getTime();
      
      return dateSortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });

  // Permission-based access control
  const canViewDetails = isSuperAdmin || canRead("customers");
  const canEditCustomer = isSuperAdmin || canUpdate("customers");
  const canDeleteCustomer = isSuperAdmin || canDelete("customers");

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
        <div className="flex gap-2">
          <BulkCustomerUpload
            packages={packages}
            areas={areas}
            routers={routers}
            onSuccess={fetchData}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Customer</span>
                <span className="sm:hidden">Add</span>
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
                  <Label>Portal Password *</Label>
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
                    <Button type="button" variant="outline" onClick={() => generatePassword('password')}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min 6 characters, letters and numbers only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>PPPoE Username *</Label>
                  <Input
                    value={formData.pppoe_username}
                    onChange={(e) => setFormData({ ...formData, pppoe_username: e.target.value })}
                    placeholder="e.g., customer_pppoe"
                    required
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
                        required
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
                  <p className="text-xs text-muted-foreground">
                    Min 4 characters, letters and numbers only
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
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, PPPoE username, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
              <th className="hidden sm:table-cell">PPPoE Username</th>
              <th>Name</th>
              <th className="hidden md:table-cell">Phone</th>
              <th className="hidden lg:table-cell">Package</th>
              <th>
                <button 
                  onClick={toggleDateSort}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Billing Date
                  {dateSortDirection === null && <ArrowUpDown className="h-3 w-3" />}
                  {dateSortDirection === 'asc' && <ArrowUp className="h-3 w-3" />}
                  {dateSortDirection === 'desc' && <ArrowDown className="h-3 w-3" />}
                </button>
              </th>
              <th>Due</th>
              <th className="hidden sm:table-cell">Status</th>
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
              filteredCustomers.map((customer) => {
                const billingInfo = calculateBillingInfo(
                  new Date(customer.expiry_date),
                  customer.total_due,
                  customer.status,
                  customer.packages?.monthly_price || 0
                );
                const pppoeUsername = customer.mikrotik_users?.[0]?.username;
                
                return (
                  <tr key={customer.id}>
                    <td className="font-mono text-sm hidden sm:table-cell">
                      {pppoeUsername || <span className="text-muted-foreground">Not set</span>}
                    </td>
                    <td>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setViewingCustomer(customer);
                            setViewDialogOpen(true);
                          }}
                          className="font-medium text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                        >
                          {customer.full_name}
                        </button>
                        <p className="text-xs text-muted-foreground sm:hidden font-mono">{pppoeUsername}</p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">{customer.phone}</td>
                    <td className="hidden lg:table-cell">{customer.packages?.name || 'N/A'}</td>
                    <td>
                      <div className="flex flex-col">
                        <span>{format(new Date(customer.expiry_date), 'dd MMM yyyy')}</span>
                        <span className="text-xs text-muted-foreground">{billingInfo.statusLabel}</span>
                      </div>
                    </td>
                    <td className={billingInfo.displayDue > 0 ? "amount-due" : "amount-positive"}>
                      ৳{billingInfo.displayDue}
                    </td>
                    <td className="hidden sm:table-cell">
                      <StatusBadge status={billingInfo.status} />
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {/* View Details */}
                          {canViewDetails && (
                            <DropdownMenuItem
                              onClick={() => {
                                setViewingCustomer(customer);
                                setViewDialogOpen(true);
                              }}
                            >
                              <UserCircle className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          )}
                          
                          {canViewDetails && <DropdownMenuSeparator />}
                          
                          {/* Quick Actions */}
                          <QuickCallRecord
                            customerId={customer.id}
                            customerName={customer.full_name}
                            onSuccess={fetchData}
                            variant="dropdown"
                          />
                          <QuickPaymentRecord
                            customerId={customer.id}
                            customerName={customer.full_name}
                            dueAmount={customer.total_due}
                            monthlyPrice={customer.packages?.monthly_price || 0}
                            onSuccess={fetchData}
                            variant="dropdown"
                          />
                          
                          <DropdownMenuSeparator />
                          
                          {/* Communication */}
                          <WhatsAppButton
                            phone={customer.phone}
                            customerName={customer.full_name}
                            userId={customer.user_id}
                            packageName={customer.packages?.name || 'Internet'}
                            expiryDate={new Date(customer.expiry_date)}
                            amount={customer.packages?.monthly_price || customer.total_due}
                            variant="dropdown"
                            pppoeUsername={pppoeUsername}
                          />
                          <EmailButton
                            phone={customer.phone}
                            customerName={customer.full_name}
                            userId={customer.user_id}
                            packageName={customer.packages?.name || 'Internet'}
                            expiryDate={new Date(customer.expiry_date)}
                            amount={customer.packages?.monthly_price || customer.total_due}
                            variant="dropdown"
                            pppoeUsername={pppoeUsername}
                          />
                          
                          {/* Edit/Delete - only for users with permission */}
                          {(canEditCustomer || canDeleteCustomer) && <DropdownMenuSeparator />}
                          
                          {canEditCustomer && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingCustomer(customer);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Quick Edit
                            </DropdownMenuItem>
                          )}
                          
                          {canDeleteCustomer && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(customer)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
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

      {/* View Customer Dialog */}
      <CustomerViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        customer={viewingCustomer}
        packages={packages}
        areas={areas}
        routers={routers}
        onSuccess={fetchData}
        canEdit={canEditCustomer}
      />

      {/* Edit Customer Dialog */}
      <CustomerEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customer={editingCustomer}
        packages={packages}
        areas={areas}
        routers={routers}
        onSuccess={fetchData}
      />

      {/* Secure Credentials Modal */}
      <CredentialsModal
        open={credentialsModal.open}
        onOpenChange={(open) => setCredentialsModal({ ...credentialsModal, open })}
        userId={credentialsModal.userId}
        password={credentialsModal.password}
        pppoeUsername={credentialsModal.pppoeUsername}
        pppoePassword={credentialsModal.pppoePassword}
        onConfirm={() => {
          toast({
            title: "Customer created successfully",
            description: `PPPoE Username: ${credentialsModal.pppoeUsername}`,
          });
        }}
      />
    </DashboardLayout>
  );
}
