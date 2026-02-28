import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wifi, Loader2, Store } from "lucide-react";
import { useIspSettings } from "@/hooks/useIspSettings";

export default function ResellerLogin() {
  const navigate = useNavigate();
  const { ispName, loading: settingsLoading } = useIspSettings();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ reseller_code: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reseller_code || !formData.password) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("reseller-auth", {
        body: { action: "login", reseller_code: formData.reseller_code, password: formData.password },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      localStorage.setItem("reseller_session", JSON.stringify(data.reseller));
      localStorage.setItem("reseller_token", data.session_token);

      toast({ title: "Login successful", description: `Welcome, ${data.reseller.name}!` });
      navigate("/reseller-portal");
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

  const displayName = settingsLoading ? "Loading..." : ispName;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <Store className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{displayName}</CardTitle>
          <CardDescription>Reseller Portal - Manage your customers</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reseller-code">Reseller Code</Label>
              <Input
                id="reseller-code"
                placeholder="RSL0001"
                value={formData.reseller_code}
                onChange={(e) => setFormData({ ...formData, reseller_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reseller-password">Password</Label>
              <Input
                id="reseller-password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <a href="/customer-login" className="text-sm text-muted-foreground hover:text-primary block">
              Customer login →
            </a>
            <a href="/auth" className="text-sm text-muted-foreground hover:text-primary block">
              Staff/Admin login →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
