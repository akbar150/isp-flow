import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Mail } from "lucide-react";

export function EmailTemplates() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    email_from_name: "Smart ISP",
    email_from_address: "",
    email_subject_reminder: "Payment Reminder - {ISPName}",
    email_subject_welcome: "Welcome to {ISPName}",
    email_template_reminder: `Dear {CustomerName},

Your internet package "{PackageName}" will expire on {ExpiryDate}.

Account Details:
• PPPoE Username: {PPPoEUsername}
• Customer ID: {CustomerID}
• Due Amount: ৳{Amount}

Please make the payment to avoid service disconnection.

Thank you for choosing {ISPName}.`,
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
          email_from_name: settingsMap.email_from_name || settings.email_from_name,
          email_from_address: settingsMap.email_from_address || "",
          email_subject_reminder: settingsMap.email_subject_reminder || settings.email_subject_reminder,
          email_subject_welcome: settingsMap.email_subject_welcome || settings.email_subject_welcome,
          email_template_reminder: settingsMap.email_template_reminder || settings.email_template_reminder,
        });
      }
    } catch (error) {
      console.error("Error fetching email settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "email_from_name", value: JSON.stringify(settings.email_from_name) },
        { key: "email_from_address", value: JSON.stringify(settings.email_from_address) },
        { key: "email_subject_reminder", value: JSON.stringify(settings.email_subject_reminder) },
        { key: "email_subject_welcome", value: JSON.stringify(settings.email_subject_welcome) },
        { key: "email_template_reminder", value: JSON.stringify(settings.email_template_reminder) },
      ];

      for (const update of updates) {
        await supabase.from("system_settings").upsert(
          { ...update, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }

      toast({ title: "Email templates saved successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save email templates",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading email templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="form-section">
        <h3 className="form-section-title flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Configuration
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={settings.email_from_name}
                onChange={(e) =>
                  setSettings({ ...settings, email_from_name: e.target.value })
                }
                placeholder="Your ISP Name"
              />
            </div>
            <div className="space-y-2">
              <Label>From Email Address</Label>
              <Input
                type="email"
                value={settings.email_from_address}
                onChange={(e) =>
                  setSettings({ ...settings, email_from_address: e.target.value })
                }
                placeholder="noreply@yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                Must be verified in Brevo
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reminder Email Subject</Label>
            <Input
              value={settings.email_subject_reminder}
              onChange={(e) =>
                setSettings({ ...settings, email_subject_reminder: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Welcome Email Subject</Label>
            <Input
              value={settings.email_subject_welcome}
              onChange={(e) =>
                setSettings({ ...settings, email_subject_welcome: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Reminder Email Template</Label>
            <Textarea
              value={settings.email_template_reminder}
              onChange={(e) =>
                setSettings({ ...settings, email_template_reminder: e.target.value })
              }
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Available Variables:</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <code className="bg-background px-2 py-1 rounded">{"{CustomerName}"}</code>
              <span>Customer's full name</span>
              <code className="bg-background px-2 py-1 rounded">{"{CustomerID}"}</code>
              <span>Customer's User ID</span>
              <code className="bg-background px-2 py-1 rounded">{"{PPPoEUsername}"}</code>
              <span>PPPoE Username</span>
              <code className="bg-background px-2 py-1 rounded">{"{PackageName}"}</code>
              <span>Internet package name</span>
              <code className="bg-background px-2 py-1 rounded">{"{ExpiryDate}"}</code>
              <span>Subscription expiry date</span>
              <code className="bg-background px-2 py-1 rounded">{"{Amount}"}</code>
              <span>Due amount</span>
              <code className="bg-background px-2 py-1 rounded">{"{ISPName}"}</code>
              <span>Your ISP name</span>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Email Templates"}
          </Button>
        </div>
      </div>
    </div>
  );
}
