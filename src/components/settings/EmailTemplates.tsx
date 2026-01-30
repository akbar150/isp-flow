import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Save, Mail, Server, Eye, EyeOff, Loader2, TestTube } from "lucide-react";
import { useIspSettings } from "@/hooks/useIspSettings";

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
      const { data } = await api.get('/settings');
      if (data.settings) {
        setSettings({
          email_from_name: data.settings.email_from_name || ispName || "",
          email_from_address: data.settings.email_from_address || "",
          email_subject_reminder: data.settings.email_subject_reminder || settings.email_subject_reminder,
          email_subject_welcome: data.settings.email_subject_welcome || settings.email_subject_welcome,
          email_template_reminder: data.settings.email_template_reminder || settings.email_template_reminder,
        });
        setSmtpSettings({
          smtp_server: data.settings.smtp_server || "",
          smtp_port: data.settings.smtp_port || "587",
          smtp_username: data.settings.smtp_username || "",
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
      await api.put('/settings', {
        email_from_name: settings.email_from_name,
        email_from_address: settings.email_from_address,
        email_subject_reminder: settings.email_subject_reminder,
        email_subject_welcome: settings.email_subject_welcome,
        email_template_reminder: settings.email_template_reminder,
      });

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
      const settingsToSave: Record<string, string> = {
        smtp_server: smtpSettings.smtp_server,
        smtp_port: smtpSettings.smtp_port,
        smtp_username: smtpSettings.smtp_username,
      };

      // Only include password if provided
      if (smtpSettings.smtp_password) {
        settingsToSave.smtp_password = smtpSettings.smtp_password;
      }

      await api.put('/settings', settingsToSave);

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
      const { data } = await api.post('/reminders/test-email', {
        to: testEmail,
        subject: `Test Email from ${ispName || "ISP Billing"}`,
        senderName: settings.email_from_name || ispName,
        senderEmail: settings.email_from_address || undefined,
      });

      toast({
        title: "Test email sent!",
        description: `Check ${testEmail} for the test message.`,
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
            <p className="text-sm font-medium mb-2">📧 Brevo API Setup Instructions:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
              <li>Sign up at <a href="https://brevo.com" target="_blank" rel="noopener" className="text-primary underline">brevo.com</a> (free tier: 300 emails/day)</li>
              <li>Go to <strong>SMTP & API</strong> → <strong>API Keys</strong> section</li>
              <li>Generate an <strong>API Key</strong> (starts with <code className="bg-background px-1 rounded">xkeysib-</code>)</li>
              <li>⚠️ <strong>NOT</strong> an SMTP Key (which starts with <code className="bg-background px-1 rounded">xsmtpsib-</code>)</li>
              <li>Enter the API key below</li>
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
              <Label>Sender Email (must be verified in Brevo)</Label>
              <Input
                type="email"
                value={smtpSettings.smtp_username}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_username: e.target.value })}
                placeholder="your-email@domain.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Brevo API Key</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={smtpSettings.smtp_password}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_password: e.target.value })}
                  placeholder="xkeysib-..."
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
                Must start with <code className="bg-muted px-1 rounded">xkeysib-</code>. Enter new key only when changing.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveSmtpSettings} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Email Settings"}
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
              <span>Expiry date</span>
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