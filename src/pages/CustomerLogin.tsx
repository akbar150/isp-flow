import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Wifi, Loader2, User, KeyRound, UserPlus } from "lucide-react";
import { z } from "zod";
import { useIspSettings } from "@/hooks/useIspSettings";

const loginSchema = z.object({
  login_id: z.string().min(1, "User ID / PPPoE Username / Email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z.string().min(10, "Enter a valid phone number"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  confirm_password: z.string(),
  address: z.string().optional(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

const resetSchema = z.object({
  login_id: z.string().min(1, "User ID / PPPoE Username / Email is required"),
  phone: z.string().min(10, "Phone number is required"),
});

interface CustomerData {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address: string;
  status: string;
  expiry_date: string;
  total_due: number;
  package: {
    name: string;
    speed_mbps: number;
    monthly_price: number;
  } | null;
}

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { ispName, loading: settingsLoading } = useIspSettings();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Show loading placeholder while settings load to prevent "Smart ISP" flash
  const displayName = settingsLoading ? "Loading..." : ispName;
  // Login state
  const [loginData, setLoginData] = useState({ login_id: "", password: "" });

  // Register state
  const [registerData, setRegisterData] = useState({
    full_name: "",
    phone: "",
    password: "",
    confirm_password: "",
    address: "",
  });

  // Reset state
  const [resetData, setResetData] = useState({ login_id: "", phone: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-auth", {
        body: { action: "login", user_id: loginData.login_id, password: loginData.password },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Store customer session in localStorage
      localStorage.setItem("customer_session", JSON.stringify(data.customer));
      localStorage.setItem("customer_token", data.session_token);

      toast({ title: "Login successful", description: `Welcome back, ${data.customer.full_name}!` });
      navigate("/customer-portal");
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const result = registerSchema.safeParse(registerData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-auth", {
        body: {
          action: "register",
          full_name: registerData.full_name,
          phone: registerData.phone,
          password: registerData.password,
          address: registerData.address,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Registration Successful!",
        description: data.message,
      });

      // Switch to login tab
      setActiveTab("login");
      setLoginData({ login_id: data.customer.user_id, password: "" });
      setRegisterData({ full_name: "", phone: "", password: "", confirm_password: "", address: "" });
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const result = resetSchema.safeParse(resetData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("customer-auth", {
        body: { action: "reset_password", user_id: resetData.login_id, phone: resetData.phone },
      });

      if (error) throw error;

      toast({
        title: "Password Reset",
        description: data.message,
      });

      // If temp password was returned (dev mode), show it
      if (data.temp_password) {
        toast({
          title: "Temporary Password",
          description: `Your temporary password is: ${data.temp_password}`,
        });
      }

      setActiveTab("login");
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <Wifi className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{displayName}</CardTitle>
          <CardDescription>
            Customer Portal - Access your internet account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login" className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                Register
              </TabsTrigger>
              <TabsTrigger value="reset" className="flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Reset
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-user-id">User ID / PPPoE Username / Email</Label>
                  <Input
                    id="login-user-id"
                    placeholder="ISP00001, PPPoE username, or email"
                    value={loginData.login_id}
                    onChange={(e) => setLoginData({ ...loginData, login_id: e.target.value })}
                    required
                  />
                  {errors.login_id && <p className="text-sm text-destructive">{errors.login_id}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <Input
                    id="reg-name"
                    placeholder="Your full name"
                    value={registerData.full_name}
                    onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                    required
                  />
                  {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Phone Number</Label>
                  <Input
                    id="reg-phone"
                    placeholder="01XXXXXXXXX"
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                    required
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-address">Address (Optional)</Label>
                  <Input
                    id="reg-address"
                    placeholder="Your address"
                    value={registerData.address}
                    onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password (min 12 chars)</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••••••"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    required
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm">Confirm Password</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    placeholder="••••••••••••"
                    value={registerData.confirm_password}
                    onChange={(e) => setRegisterData({ ...registerData, confirm_password: e.target.value })}
                    required
                  />
                  {errors.confirm_password && <p className="text-sm text-destructive">{errors.confirm_password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset" className="mt-4">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-user-id">User ID / PPPoE Username / Email</Label>
                  <Input
                    id="reset-user-id"
                    placeholder="ISP00001, PPPoE username, or email"
                    value={resetData.login_id}
                    onChange={(e) => setResetData({ ...resetData, login_id: e.target.value })}
                    required
                  />
                  {errors.login_id && <p className="text-sm text-destructive">{errors.login_id}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-phone">Registered Phone</Label>
                  <Input
                    id="reset-phone"
                    placeholder="01XXXXXXXXX"
                    value={resetData.phone}
                    onChange={(e) => setResetData({ ...resetData, phone: e.target.value })}
                    required
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset Password
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  A temporary password will be sent to your registered phone number.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <a href="/auth" className="text-sm text-muted-foreground hover:text-primary">
              Staff/Admin login →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
