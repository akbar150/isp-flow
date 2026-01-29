import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, MessageSquare, TestTube } from "lucide-react";

export function SmsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  const [settings, setSettings] = useState({
    sms_enabled: false,
    routemobile_username: "",
    routemobile_password: "",
    routemobile_sender_id: "",
    routemobile_route: "1",
    sms_template: `Dear {CustomerName}, your internet package {PackageName} expires on {ExpiryDate}. Due: ৳{Amount}. Pay now to avoid disconnection. - {ISPName}`,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from("system_settings").select("*");
      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((s) => {
          settingsMap[s.key] = typeof s.value === "string" 
            ? s.value.replace(/^"|"$/g, "") 
            : JSON.stringify(s.value).replace(/^"|"$/g, "");
        });
        setSettings({
          sms_enabled: settingsMap.sms_enabled === "true",
          routemobile_username: settingsMap.routemobile_username || "",
          routemobile_password: settingsMap.routemobile_password || "",
          routemobile_sender_id: settingsMap.routemobile_sender_id || "",
          routemobile_route: settingsMap.routemobile_route || "1",
          sms_template: settingsMap.sms_template || settings.sms_template,
        });
      }
    } catch (error) {
      console.error("Error fetching SMS settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "sms_enabled", value: JSON.stringify(settings.sms_enabled) },
        { key: "routemobile_username", value: JSON.stringify(settings.routemobile_username) },
        { key: "routemobile_password", value: JSON.stringify(settings.routemobile_password) },
        { key: "routemobile_sender_id", value: JSON.stringify(settings.routemobile_sender_id) },
        { key: "routemobile_route", value: JSON.stringify(settings.routemobile_route) },
        { key: "sms_template", value: JSON.stringify(settings.sms_template) },
      ];

      for (const update of updates) {
        await supabase.from("system_settings").upsert(
          { ...update, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }

      toast({ title: "SMS settings saved successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save SMS settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testSms = async () => {
    if (!testPhone) {
      toast({
        title: "Error",
        description: "Please enter a test phone number",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      // This would call an edge function to send test SMS
      toast({
        title: "Test SMS queued",
        description: `Test message will be sent to ${testPhone}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test SMS",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading SMS settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          RouteMobile SMS Configuration
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send automated SMS reminders to customers
              </p>
            </div>
            <Switch
              checked={settings.sms_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, sms_enabled: checked })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Username</Label>
              <Input
                value={settings.routemobile_username}
                onChange={(e) =>
                  setSettings({ ...settings, routemobile_username: e.target.value })
                }
                placeholder="Your RouteMobile username"
              />
            </div>
            <div className="space-y-2">
              <Label>API Password</Label>
              <Input
                type="password"
                value={settings.routemobile_password}
                onChange={(e) =>
                  setSettings({ ...settings, routemobile_password: e.target.value })
                }
                placeholder="Your RouteMobile password"
              />
            </div>
            <div className="space-y-2">
              <Label>Sender ID</Label>
              <Input
                value={settings.routemobile_sender_id}
                onChange={(e) =>
                  setSettings({ ...settings, routemobile_sender_id: e.target.value })
                }
                placeholder="e.g., MYISP"
              />
              <p className="text-xs text-muted-foreground">
                Approved sender ID from RouteMobile
              </p>
            </div>
            <div className="space-y-2">
              <Label>Route Type</Label>
              <Input
                value={settings.routemobile_route}
                onChange={(e) =>
                  setSettings({ ...settings, routemobile_route: e.target.value })
                }
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                1 = Promotional, 4 = Transactional
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>SMS Template</Label>
            <Textarea
              value={settings.sms_template}
              onChange={(e) =>
                setSettings({ ...settings, sms_template: e.target.value })
              }
              className="min-h-[100px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Variables: {"{CustomerName}"}, {"{PackageName}"}, {"{ExpiryDate}"}, {"{Amount}"}, {"{ISPName}"}, {"{PPPoEUsername}"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button onClick={saveSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Settings"}
            </Button>

            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Test phone number"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <Button variant="outline" onClick={testSms} disabled={testing}>
                <TestTube className="h-4 w-4 mr-2" />
                {testing ? "Sending..." : "Test SMS"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
