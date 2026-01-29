import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Smartphone, Shield } from "lucide-react";

export function FirebaseOtpSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    firebase_otp_enabled: false,
    firebase_api_key: "",
    firebase_auth_domain: "",
    firebase_project_id: "",
    firebase_app_id: "",
    firebase_messaging_sender_id: "",
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
          firebase_otp_enabled: settingsMap.firebase_otp_enabled === "true",
          firebase_api_key: settingsMap.firebase_api_key || "",
          firebase_auth_domain: settingsMap.firebase_auth_domain || "",
          firebase_project_id: settingsMap.firebase_project_id || "",
          firebase_app_id: settingsMap.firebase_app_id || "",
          firebase_messaging_sender_id: settingsMap.firebase_messaging_sender_id || "",
        });
      }
    } catch (error) {
      console.error("Error fetching Firebase settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "firebase_otp_enabled", value: JSON.stringify(settings.firebase_otp_enabled) },
        { key: "firebase_api_key", value: JSON.stringify(settings.firebase_api_key) },
        { key: "firebase_auth_domain", value: JSON.stringify(settings.firebase_auth_domain) },
        { key: "firebase_project_id", value: JSON.stringify(settings.firebase_project_id) },
        { key: "firebase_app_id", value: JSON.stringify(settings.firebase_app_id) },
        { key: "firebase_messaging_sender_id", value: JSON.stringify(settings.firebase_messaging_sender_id) },
      ];

      for (const update of updates) {
        await supabase.from("system_settings").upsert(
          { ...update, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }

      toast({ title: "Firebase OTP settings saved successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save Firebase settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading Firebase settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Firebase OTP Authentication
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-base">Enable Firebase OTP</Label>
              <p className="text-sm text-muted-foreground">
                Use Firebase for phone number verification
              </p>
            </div>
            <Switch
              checked={settings.firebase_otp_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, firebase_otp_enabled: checked })
              }
            />
          </div>

          <div className="p-4 border rounded-lg bg-primary/5">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Setup Instructions</p>
                <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
                  <li>Go to Firebase Console (console.firebase.google.com)</li>
                  <li>Create a new project or select existing one</li>
                  <li>Enable Phone Authentication in Authentication &gt; Sign-in method</li>
                  <li>Add your domain to authorized domains</li>
                  <li>Copy the config values from Project Settings</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                value={settings.firebase_api_key}
                onChange={(e) =>
                  setSettings({ ...settings, firebase_api_key: e.target.value })
                }
                placeholder="AIzaSy..."
              />
            </div>
            <div className="space-y-2">
              <Label>Auth Domain</Label>
              <Input
                value={settings.firebase_auth_domain}
                onChange={(e) =>
                  setSettings({ ...settings, firebase_auth_domain: e.target.value })
                }
                placeholder="your-project.firebaseapp.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Project ID</Label>
              <Input
                value={settings.firebase_project_id}
                onChange={(e) =>
                  setSettings({ ...settings, firebase_project_id: e.target.value })
                }
                placeholder="your-project-id"
              />
            </div>
            <div className="space-y-2">
              <Label>App ID</Label>
              <Input
                value={settings.firebase_app_id}
                onChange={(e) =>
                  setSettings({ ...settings, firebase_app_id: e.target.value })
                }
                placeholder="1:123456789:web:abc123"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Messaging Sender ID</Label>
              <Input
                value={settings.firebase_messaging_sender_id}
                onChange={(e) =>
                  setSettings({ ...settings, firebase_messaging_sender_id: e.target.value })
                }
                placeholder="123456789"
              />
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="mt-4">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Firebase Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
