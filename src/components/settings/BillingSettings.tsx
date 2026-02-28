import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Zap, ShieldAlert, RefreshCw, Loader2 } from "lucide-react";

export function BillingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [autoSuspendEnabled, setAutoSuspendEnabled] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["grace_period_days", "auto_suspend_enabled"]);

      if (data) {
        data.forEach((s) => {
          if (s.key === "grace_period_days") setGracePeriodDays(Number(s.value) || 3);
          if (s.key === "auto_suspend_enabled") setAutoSuspendEnabled(s.value !== false);
        });
      }
    } catch (error) {
      console.error("Error fetching billing settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        supabase.from("system_settings").upsert(
          { key: "grace_period_days", value: gracePeriodDays as any, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        ),
        supabase.from("system_settings").upsert(
          { key: "auto_suspend_enabled", value: autoSuspendEnabled as any, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        ),
      ]);
      toast({ title: "Billing settings saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-4">Loading billing settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="form-section max-w-xl">
        <h3 className="form-section-title flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Automated Billing Engine
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how the billing engine handles expired customers automatically.
        </p>

        <div className="space-y-6">
          {/* Auto-Suspend Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <Label className="font-medium">Auto-Suspend Expired Customers</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically suspend customers who remain unpaid after the grace period.
              </p>
            </div>
            <Switch checked={autoSuspendEnabled} onCheckedChange={setAutoSuspendEnabled} />
          </div>

          {/* Grace Period */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Grace Period (Days)
            </Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
              className="max-w-[120px]"
            />
            <p className="text-sm text-muted-foreground">
              Number of days after expiry before auto-suspension. Set to 0 to suspend immediately on expiry.
            </p>
          </div>

          {/* Auto-Reactivate Info */}
          <div className="p-4 border rounded-lg bg-primary/5">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Auto-Reactivate on Payment</p>
            </div>
            <p className="text-sm text-muted-foreground">
              When a customer clears their full due amount, their account is automatically reactivated 
              and the expiry date is extended by the package validity period. This works for both 
              expired and suspended customers.
            </p>
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Billing Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
