import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Shield, Users, Tags, MapPin, Wifi, MessageSquare, Mail, Smartphone, Settings2 } from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";
import { RolePermissions } from "@/components/settings/RolePermissions";
import { ExpenseCategories } from "@/components/settings/ExpenseCategories";
import { AreaManagement } from "@/components/settings/AreaManagement";
import { SmsSettings } from "@/components/settings/SmsSettings";
import { FirebaseOtpSettings } from "@/components/settings/FirebaseOtpSettings";
import { EmailTemplates } from "@/components/settings/EmailTemplates";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    isp_name: "Smart ISP",
    whatsapp_template: `🌐 *{ISP Name} - Payment Reminder*

Dear *{CustomerName}*,

📋 *Account Details:*
━━━━━━━━━━━━━━━
👤 PPPoE Username: \`{PPPoEUsername}\`
🔑 PPPoE Password: \`{PPPoEPassword}\`
🆔 Customer ID: \`{user_id}\`
📦 Package: *{PackageName}*
📅 Expiry Date: *{ExpiryDate}*

💰 *Due Amount: ৳{Amount}*
━━━━━━━━━━━━━━━

⚠️ Please pay before the expiry date to avoid service disconnection.

🙏 Thank you for choosing *{ISP Name}*!`,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const settingsRes = await supabase.from('system_settings').select('*');

      if (settingsRes.data) {
        const settingsMap: Record<string, string> = {};
        settingsRes.data.forEach(s => {
          settingsMap[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        });
        setSettings({
          isp_name: settingsMap.isp_name?.replace(/"/g, '') || "Smart ISP",
          whatsapp_template: settingsMap.whatsapp_template?.replace(/"/g, '') || settings.whatsapp_template,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        supabase.from('system_settings').upsert({ 
          key: 'isp_name', 
          value: JSON.stringify(settings.isp_name),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }),
        supabase.from('system_settings').upsert({ 
          key: 'whatsapp_template', 
          value: JSON.stringify(settings.whatsapp_template),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }),
      ]);

      toast({ title: "Settings saved successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading settings...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Configure your ISP billing system</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex h-auto p-1 gap-1">
            <TabsTrigger value="general" className="flex items-center gap-1.5 px-3 py-2">
              <Wifi className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1.5 px-3 py-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1.5 px-3 py-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-1.5 px-3 py-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">SMS</span>
            </TabsTrigger>
            <TabsTrigger value="otp" className="flex items-center gap-1.5 px-3 py-2">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">OTP</span>
            </TabsTrigger>
            <TabsTrigger value="areas" className="flex items-center gap-1.5 px-3 py-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Areas</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-1.5 px-3 py-2">
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 px-3 py-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-1.5 px-3 py-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permissions</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="general">
          <div className="form-section max-w-xl">
            <h3 className="form-section-title flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              General Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ISP Name</Label>
                <Input
                  value={settings.isp_name}
                  onChange={(e) => setSettings({ ...settings, isp_name: e.target.value })}
                  placeholder="Your ISP Name"
                />
                <p className="text-xs text-muted-foreground">
                  This name appears in WhatsApp messages, emails, login pages, and system branding
                </p>
              </div>
              <Button onClick={saveSettings} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp">
          <div className="form-section max-w-2xl">
            <h3 className="form-section-title flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              WhatsApp Message Template
            </h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-primary/5">
                <p className="text-sm font-medium mb-2">💡 WhatsApp Formatting Tips:</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Use <code className="bg-muted px-1 rounded">*text*</code> for <strong>bold</strong></p>
                  <p>• Use <code className="bg-muted px-1 rounded">_text_</code> for <em>italic</em></p>
                  <p>• Use <code className="bg-muted px-1 rounded">~text~</code> for <s>strikethrough</s></p>
                  <p>• Use <code className="bg-muted px-1 rounded">`text`</code> for <code>monospace</code></p>
                  <p>• Emojis are fully supported! 🎉</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Template Message</Label>
                <Textarea
                  value={settings.whatsapp_template}
                  onChange={(e) => setSettings({ ...settings, whatsapp_template: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Available Variables:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <code className="bg-background px-2 py-1 rounded">{'{CustomerName}'}</code>
                  <span>Customer's full name</span>
                  <code className="bg-background px-2 py-1 rounded">{'{user_id}'}</code>
                  <span>Customer's User ID</span>
                  <code className="bg-background px-2 py-1 rounded">{'{PPPoEUsername}'}</code>
                  <span>PPPoE Username</span>
                  <code className="bg-background px-2 py-1 rounded">{'{PPPoEPassword}'}</code>
                  <span>PPPoE Password</span>
                  <code className="bg-background px-2 py-1 rounded">{'{PackageName}'}</code>
                  <span>Internet package name</span>
                  <code className="bg-background px-2 py-1 rounded">{'{ExpiryDate}'}</code>
                  <span>Subscription expiry date</span>
                  <code className="bg-background px-2 py-1 rounded">{'{Amount}'}</code>
                  <span>Due amount</span>
                  <code className="bg-background px-2 py-1 rounded">{'{ISP Name}'}</code>
                  <span>Your ISP name</span>
                </div>
              </div>
              <Button onClick={saveSettings} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <EmailTemplates />
        </TabsContent>

        <TabsContent value="sms">
          <SmsSettings />
        </TabsContent>

        <TabsContent value="otp">
          <FirebaseOtpSettings />
        </TabsContent>

        <TabsContent value="areas">
          <AreaManagement />
        </TabsContent>

        <TabsContent value="categories">
          <ExpenseCategories />
        </TabsContent>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="permissions">
          <RolePermissions />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
