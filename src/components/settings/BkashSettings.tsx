import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Smartphone } from "lucide-react";
import { decodeSettingValue } from "@/lib/settingsValue";

export default function BkashSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    app_key: "",
    app_secret: "",
    username: "",
    password: "",
    is_sandbox: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["bkash_app_key", "bkash_app_secret", "bkash_username", "bkash_password", "bkash_sandbox"]);

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s) => {
          map[s.key] = decodeSettingValue(s.value);
        });
        setConfig({
          app_key: map.bkash_app_key || "",
          app_secret: map.bkash_app_secret || "",
          username: map.bkash_username || "",
          password: map.bkash_password || "",
          is_sandbox: map.bkash_sandbox === "true" || !map.bkash_sandbox,
        });
      }
    } catch (err) {
      console.error("Error fetching bKash settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = [
        { key: "bkash_app_key", value: config.app_key },
        { key: "bkash_app_secret", value: config.app_secret },
        { key: "bkash_username", value: config.username },
        { key: "bkash_password", value: config.password },
        { key: "bkash_sandbox", value: config.is_sandbox ? "true" : "false" },
      ];

      await Promise.all(
        settings.map((s) =>
          supabase.from("system_settings").upsert(
            { key: s.key, value: s.value, updated_at: new Date().toISOString() },
            { onConflict: "key" }
          )
        )
      );

      toast({ title: "bKash settings saved successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save bKash settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="form-section max-w-xl">
      <h3 className="form-section-title flex items-center gap-2">
        <Smartphone className="h-5 w-5" />
        bKash Payment Gateway (Super Admin Only)
      </h3>
      <CardDescription className="mb-4">
        Configure bKash Tokenized Checkout credentials for online payments in the Customer Portal.
      </CardDescription>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label>Sandbox Mode</Label>
            <p className="text-xs text-muted-foreground">Use sandbox for testing, disable for live payments</p>
          </div>
          <Switch
            checked={config.is_sandbox}
            onCheckedChange={(checked) => setConfig({ ...config, is_sandbox: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label>App Key</Label>
          <Input
            type="password"
            value={config.app_key}
            onChange={(e) => setConfig({ ...config, app_key: e.target.value })}
            placeholder="bKash App Key"
          />
        </div>

        <div className="space-y-2">
          <Label>App Secret</Label>
          <Input
            type="password"
            value={config.app_secret}
            onChange={(e) => setConfig({ ...config, app_secret: e.target.value })}
            placeholder="bKash App Secret"
          />
        </div>

        <div className="space-y-2">
          <Label>Username</Label>
          <Input
            value={config.username}
            onChange={(e) => setConfig({ ...config, username: e.target.value })}
            placeholder="bKash Merchant Username"
          />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            type="password"
            value={config.password}
            onChange={(e) => setConfig({ ...config, password: e.target.value })}
            placeholder="bKash Merchant Password"
          />
        </div>

        <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-1">📋 How to get credentials:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Register at <a href="https://pgw-integration.bkash.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">bKash Payment Gateway</a></li>
            <li>Complete merchant verification</li>
            <li>Get your Tokenized Checkout credentials from the dashboard</li>
            <li>Use Sandbox credentials for testing first</li>
          </ol>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save bKash Settings"}
        </Button>
      </div>
    </div>
  );
}
