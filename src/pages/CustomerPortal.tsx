import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Wifi, LogOut, User, CreditCard, Calendar, Package, Phone, MapPin,
  Clock, AlertTriangle, CheckCircle, Loader2, Lock, History, WifiOff, Gauge, ArrowUpDown, Gift, FileText
} from "lucide-react";
import SpeedTest from "@/components/portal/SpeedTest";
import PackageChange from "@/components/portal/PackageChange";
import ReferralProgram from "@/components/portal/ReferralProgram";
import BkashPayment from "@/components/portal/BkashPayment";
import ContractView from "@/components/portal/ContractView";
import { useIspSettings } from "@/hooks/useIspSettings";

interface CustomerData {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address: string;
  status: string;
  expiry_date: string;
  total_due: number;
  package_id: string | null;
  package: {
    name: string;
    speed_mbps: number;
    monthly_price: number;
  } | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  transaction_id: string | null;
}

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { ispName, loading: settingsLoading } = useIspSettings();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeOutages, setActiveOutages] = useState<{ id: string; title: string; description: string | null; estimated_restore: string | null }[]>([]);
  
  // Show loading placeholder while settings load to prevent "Smart ISP" flash
  const displayName = settingsLoading ? "Loading..." : ispName;

  // Profile update state
  const [profileData, setProfileData] = useState({
    phone: "",
    address: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("customer_session");
    if (!stored) {
      navigate("/customer-login");
      return;
    }

    try {
      const customerData = JSON.parse(stored) as CustomerData;
      setCustomer(customerData);
      setProfileData({
        ...profileData,
        phone: customerData.phone,
        address: customerData.address,
      });
      fetchPayments(customerData.id);
      fetchActiveOutages();
    } catch {
      navigate("/customer-login");
    }
  }, [navigate]);

  const fetchPayments = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, payment_date, method, transaction_id")
        .eq("customer_id", customerId)
        .order("payment_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveOutages = async () => {
    try {
      const { data } = await supabase
        .from("network_outages")
        .select("id, title, description, estimated_restore")
        .eq("status", "active");
      setActiveOutages((data || []) as any[]);
    } catch (error) {
      console.error("Error fetching outages:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("customer_session");
    localStorage.removeItem("customer_token");
    navigate("/customer-login");
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    if (profileData.new_password && profileData.new_password !== profileData.confirm_password) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" });
      return;
    }

    if (profileData.new_password && profileData.new_password.length < 12) {
      toast({ title: "Error", description: "New password must be at least 12 characters", variant: "destructive" });
      return;
    }

    if (!profileData.current_password) {
      toast({ title: "Error", description: "Current password is required to make changes", variant: "destructive" });
      return;
    }

    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-auth", {
        body: {
          action: "update_profile",
          user_id: customer.user_id,
          password: profileData.current_password,
          phone: profileData.phone !== customer.phone ? profileData.phone : undefined,
          address: profileData.address !== customer.address ? profileData.address : undefined,
          new_password: profileData.new_password || undefined,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Update local storage
      const updatedCustomer = {
        ...customer,
        phone: profileData.phone,
        address: profileData.address,
      };
      localStorage.setItem("customer_session", JSON.stringify(updatedCustomer));
      setCustomer(updatedCustomer);

      toast({ title: "Success", description: "Profile updated successfully" });
      setProfileData({ ...profileData, current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "expiring":
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Expiring Soon</Badge>;
      case "expired":
        return <Badge className="bg-red-500"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
      case "suspended":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDaysUntilExpiry = () => {
    if (!customer) return 0;
    const today = new Date();
    const expiry = new Date(customer.expiry_date);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const daysLeft = getDaysUntilExpiry();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Wifi className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">{displayName}</h1>
              <p className="text-xs text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {customer.full_name} ({customer.user_id})
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Active Outage Banners */}
        {activeOutages.length > 0 && (
          <div className="mb-6 space-y-3">
            {activeOutages.map(outage => (
              <div key={outage.id} className="p-4 bg-[hsl(var(--status-expiring)/0.1)] border border-[hsl(var(--status-expiring)/0.3)] rounded-lg flex items-start gap-3">
                <WifiOff className="h-5 w-5 text-[hsl(var(--status-expiring))] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{outage.title}</p>
                  {outage.description && <p className="text-xs text-muted-foreground mt-0.5">{outage.description}</p>}
                  {outage.estimated_restore && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Estimated restore: {new Date(outage.estimated_restore).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status Banner */}
        {customer.status !== "active" && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm">
              {customer.status === "suspended" && "Your account is suspended. Please contact support."}
              {customer.status === "expired" && "Your subscription has expired. Please renew to continue service."}
              {customer.status === "expiring" && `Your subscription expires in ${daysLeft} days. Please renew soon.`}
            </p>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Account Status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getStatusBadge(customer.status)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Current Package
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{customer.package?.name || "No package"}</p>
              {customer.package && (
                <p className="text-sm text-muted-foreground">{customer.package.speed_mbps} Mbps</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Expires On
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{new Date(customer.expiry_date).toLocaleDateString()}</p>
              <p className={`text-sm ${daysLeft <= 3 ? "text-destructive" : daysLeft <= 7 ? "text-yellow-600" : "text-muted-foreground"}`}>
                {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Total Due
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`font-semibold text-lg ${customer.total_due > 0 ? "text-destructive" : "text-green-600"}`}>
                ৳{customer.total_due.toLocaleString()}
              </p>
              {customer.package && (
                <p className="text-sm text-muted-foreground">৳{customer.package.monthly_price}/month</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pay" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Pay Now
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Payment History
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="package" className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Change Package
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contracts
            </TabsTrigger>
            <TabsTrigger value="speedtest" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Speed Test
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pay">
            <BkashPayment
              customerId={customer.id}
              userId={customer.user_id}
              totalDue={customer.total_due}
              monthlyPrice={customer.package?.monthly_price || 0}
            />
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your contact information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input value={customer.user_id} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={customer.full_name} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Contact support to change your name</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">
                      <MapPin className="h-4 w-4 inline mr-2" />
                      Address
                    </Label>
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="current-password">Current Password (required to save)</Label>
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="Enter current password to save changes"
                      value={profileData.current_password}
                      onChange={(e) => setProfileData({ ...profileData, current_password: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={updating}>
                    {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Your recent payments</CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No payment records found</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">৳{payment.amount.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(payment.payment_date).toLocaleDateString()} • {payment.method}
                          </p>
                          {payment.transaction_id && (
                            <p className="text-xs text-muted-foreground">TXN: {payment.transaction_id}</p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="sec-current">Current Password</Label>
                    <Input
                      id="sec-current"
                      type="password"
                      value={profileData.current_password}
                      onChange={(e) => setProfileData({ ...profileData, current_password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sec-new">New Password (min 12 characters)</Label>
                    <Input
                      id="sec-new"
                      type="password"
                      value={profileData.new_password}
                      onChange={(e) => setProfileData({ ...profileData, new_password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sec-confirm">Confirm New Password</Label>
                    <Input
                      id="sec-confirm"
                      type="password"
                      value={profileData.confirm_password}
                      onChange={(e) => setProfileData({ ...profileData, confirm_password: e.target.value })}
                    />
                  </div>
                  <Button type="submit" disabled={updating || !profileData.new_password}>
                    {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="package">
            <PackageChange
              customerId={customer.id}
              userId={customer.user_id}
              currentPackageId={customer.package_id}
              currentPackageName={customer.package?.name || null}
              currentPackageSpeed={customer.package?.speed_mbps || null}
              currentPackagePrice={customer.package?.monthly_price || null}
              daysRemaining={daysLeft}
            />
          </TabsContent>

          <TabsContent value="referrals">
            <ReferralProgram
              customerId={customer.id}
              customerName={customer.full_name}
            />
          </TabsContent>

          <TabsContent value="contracts">
            <ContractView customerId={customer.id} />
          </TabsContent>

          <TabsContent value="speedtest">
            <SpeedTest packageSpeedMbps={customer.package?.speed_mbps} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
