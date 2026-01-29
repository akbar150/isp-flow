import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Shield, Users, Tags, MapPin, Wifi } from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";
import { RolePermissions } from "@/components/settings/RolePermissions";
import { ExpenseCategories } from "@/components/settings/ExpenseCategories";
import { AreaManagement } from "@/components/settings/AreaManagement";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    isp_name: "Smart ISP",
    whatsapp_template: `Dear {CustomerName},
User ID: {user_id}
PPPoE Username: {PPPoEUsername}

Your internet package {PackageName}, will expire on {ExpiryDate}.

Please pay ৳{Amount} to avoid disconnection.

– {ISP Name}`,
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="flex items-center gap-1">
            <Wifi className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Template</TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Areas/Zones
          </TabsTrigger>
          <TabsTrigger value="expense-categories" className="flex items-center gap-1">
            <Tags className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="form-section max-w-xl">
            <h3 className="form-section-title">General Settings</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ISP Name</Label>
                <Input
                  value={settings.isp_name}
                  onChange={(e) => setSettings({ ...settings, isp_name: e.target.value })}
                  placeholder="Your ISP Name"
                />
                <p className="text-xs text-muted-foreground">
                  This name appears in WhatsApp messages, login pages, and system branding
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
            <h3 className="form-section-title">WhatsApp Message Template</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Message</Label>
                <Textarea
                  value={settings.whatsapp_template}
                  onChange={(e) => setSettings({ ...settings, whatsapp_template: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Available Variables:</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
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

        <TabsContent value="areas">
          <AreaManagement />
        </TabsContent>

        <TabsContent value="expense-categories">
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
