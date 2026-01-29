import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Mail, Server, Eye, EyeOff, Loader2, TestTube } from "lucide-react";
import { useIspSettings } from "@/hooks/useIspSettings";
import { decodeSettingValue } from "@/lib/settingsValue";

export function EmailTemplates() {
  const { ispName } = useIspSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [settings, setSettings] = useState({
    email_from_name: "",
    email_from_address: "",
    email_subject_reminder: "পেমেন্ট রিমাইন্ডার / Payment Reminder - {ISPName}",
    email_subject_welcome: "স্বাগতম / Welcome to {ISPName}",
    email_template_reminder: `প্রিয় {CustomerName},

আপনার ইন্টারনেট প্যাকেজ "{PackageName}" এর মেয়াদ {ExpiryDate} তারিখে শেষ হবে।

অ্যাকাউন্ট তথ্য:
• PPPoE Username: {PPPoEUsername}
• Customer ID: {CustomerID}
• বকেয়া পরিমাণ: ৳{Amount}

সংযোগ বিচ্ছিন্ন এড়াতে অনুগ্রহ করে পেমেন্ট করুন।

{ISPName} বেছে নেওয়ার জন্য ধন্যবাদ।

---

Dear {CustomerName},

Your internet package "{PackageName}" will expire on {ExpiryDate}.

Account Details:
• PPPoE Username: {PPPoEUsername}
• Customer ID: {CustomerID}
• Due Amount: ৳{Amount}

Please make the payment to avoid service disconnection.

Thank you for choosing {ISPName}.`,
  });

  const [smtpSettings, setSmtpSettings] = useState({
    smtp_server: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  // Set default from name when ispName loads
  useEffect(() => {
    if (ispName && !settings.email_from_name) {
      setSettings(prev => ({ ...prev, email_from_name: ispName }));
    }
  }, [ispName]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from("system_settings").select("*");
      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((s) => {
          settingsMap[s.key] = decodeSettingValue(s.value);
        });
        setSettings({
          email_from_name: settingsMap.email_from_name || ispName || "",
          email_from_address: settingsMap.email_from_address || "",
          email_subject_reminder: settingsMap.email_subject_reminder || settings.email_subject_reminder,
          email_subject_welcome: settingsMap.email_subject_welcome || settings.email_subject_welcome,
          email_template_reminder: settingsMap.email_template_reminder || settings.email_template_reminder,
        });
        setSmtpSettings({
          smtp_server: settingsMap.smtp_server || "",
          smtp_port: settingsMap.smtp_port || "587",
          smtp_username: settingsMap.smtp_username || "",
          smtp_password: "", // Never load password - only set new
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
        { key: "email_from_name", value: settings.email_from_name },
        { key: "email_from_address", value: settings.email_from_address },
        { key: "email_subject_reminder", value: settings.email_subject_reminder },
        { key: "email_subject_welcome", value: settings.email_subject_welcome },
        { key: "email_template_reminder", value: settings.email_template_reminder },
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

  const saveSmtpSettings = async () => {
    setSaving(true);
    try {
      // Save non-sensitive SMTP settings directly
      const updates = [
        { key: "smtp_server", value: smtpSettings.smtp_server },
        { key: "smtp_port", value: smtpSettings.smtp_port },
        { key: "smtp_username", value: smtpSettings.smtp_username },
      ];

      for (const update of updates) {
        await supabase.from("system_settings").upsert(
          { ...update, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }

      // Encrypt and save password if provided
      if (smtpSettings.smtp_password) {
        const { data: encryptedData, error: encryptError } = await supabase
          .rpc("encrypt_smtp_password", { plain_password: smtpSettings.smtp_password });

        if (encryptError) {
          throw new Error("Failed to encrypt password");
        }

        await supabase.from("system_settings").upsert(
          { 
            key: "smtp_password_encrypted", 
            // Store as a proper jsonb string (NOT JSON.stringify) to avoid extra escaping.
            value: encryptedData,
            updated_at: new Date().toISOString() 
          },
          { onConflict: "key" }
        );
      }

      toast({ title: "SMTP settings saved successfully" });
      setSmtpSettings(prev => ({ ...prev, smtp_password: "" }));
    } catch (error) {
      console.error("Error saving SMTP settings:", error);
      toast({
        title: "Error",
        description: "Failed to save SMTP settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testSmtpConnection = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter a test email address",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-brevo", {
        body: {
          to: testEmail,
          subject: `Test Email from ${ispName || "ISP Billing"}`,
          senderName: settings.email_from_name || ispName,
          senderEmail: settings.email_from_address || undefined,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">${ispName || "ISP Billing"}</h1>
              </div>
              <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #1f2937;">✅ Email Configuration Test</h2>
                <p style="color: #4b5563;">If you received this email, your SMTP settings are working correctly!</p>
                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
                  <h3 style="color: #1f2937; margin-top: 0;">Configuration Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">SMTP Server:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${smtpSettings.smtp_server || "Using API"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">From Name:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${settings.email_from_name || ispName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">From Email:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${settings.email_from_address || "Default"}</td>
                    </tr>
                  </table>
                </div>
                <p style="color: #6b7280; margin-top: 30px;">Best Regards,<br><strong>${ispName || "ISP Billing"} Team</strong></p>
              </div>
              <div style="background: #1f2937; padding: 15px; text-align: center;">
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} ${ispName || "ISP Billing"}. All rights reserved.</p>
              </div>
            </div>
          `,
        },
      });

      if (error) throw error;

      toast({
        title: "Test email sent!",
        description: `Check ${testEmail} for the test message. Provider: ${data?.provider || "unknown"}`,
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading email templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* SMTP Configuration */}
      <div className="form-section">
        <h3 className="form-section-title flex items-center gap-2">
          <Server className="h-5 w-5" />
          SMTP Configuration (Brevo)
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm font-medium mb-2">📧 Brevo SMTP Setup Instructions:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
              <li>Sign up at <a href="https://brevo.com" target="_blank" rel="noopener" className="text-primary underline">brevo.com</a> (free tier: 300 emails/day)</li>
              <li>Go to <strong>SMTP & API</strong> section in Brevo dashboard</li>
              <li>Generate an <strong>SMTP Key</strong> (not API key)</li>
              <li>Enter the details below</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP Server</Label>
              <Input
                value={smtpSettings.smtp_server}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_server: e.target.value })}
                placeholder="smtp-relay.brevo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Port</Label>
              <Input
                value={smtpSettings.smtp_port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: e.target.value })}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP Username (Login Email)</Label>
              <Input
                type="email"
                value={smtpSettings.smtp_username}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_username: e.target.value })}
                placeholder="your-email@domain.com"
              />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password (SMTP Key)</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={smtpSettings.smtp_password}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_password: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter new password only when changing. Leave blank to keep existing.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveSmtpSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save SMTP Settings"}
            </Button>
          </div>
        </div>
      </div>

      {/* Test Email */}
      <div className="form-section">
        <h3 className="form-section-title flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Email
        </h3>
        <div className="flex gap-2">
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter your email to test"
            className="max-w-xs"
          />
          <Button onClick={testSmtpConnection} disabled={testing} variant="outline">
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Test
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Email Templates */}
      <div className="form-section">
        <h3 className="form-section-title flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Templates
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
            <Label>Reminder Email Template (বাংলা + English)</Label>
            <Textarea
              value={settings.email_template_reminder}
              onChange={(e) =>
                setSettings({ ...settings, email_template_reminder: e.target.value })
              }
              className="min-h-[300px] font-mono text-sm"
              dir="auto"
            />
            <p className="text-xs text-muted-foreground">
              বাংলা ইউনিকোড সমর্থিত। Unicode characters fully supported.
            </p>
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
