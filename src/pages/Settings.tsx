import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Shield, Users, Tags, MapPin, Wifi, MessageSquare, Mail, Smartphone, Settings2, Map, Trash2, Zap, CreditCard, FileText, Lock, ChevronDown } from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";
import { RolePermissions } from "@/components/settings/RolePermissions";
import { ExpenseCategories } from "@/components/settings/ExpenseCategories";
import { AreaManagement } from "@/components/settings/AreaManagement";
import { SmsSettings } from "@/components/settings/SmsSettings";
import { FirebaseOtpSettings } from "@/components/settings/FirebaseOtpSettings";
import { EmailTemplates } from "@/components/settings/EmailTemplates";
import { DataResetPanel } from "@/components/settings/DataResetPanel";
import { BillingSettings } from "@/components/settings/BillingSettings";
import BkashSettings from "@/components/settings/BkashSettings";
import { ContractTemplates } from "@/components/settings/ContractTemplates";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { decodeSettingValue, normalizeTemplateVars } from "@/lib/settingsValue";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(["whatsapp"]);

  const toggleSection = (section: string) => {
    setOpenSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const [settings, setSettings] = useState({
    isp_name: "Smart ISP",
    google_maps_api_key: "",
    whatsapp_template: `🔔 *পেমেন্ট রিমাইন্ডার / Payment Reminder*

প্রিয় *{CustomerName}*,

📋 *অ্যাকাউন্ট তথ্য / Account Details:*
━━━━━━━━━━━━━━━━
👤 PPPoE Username: \`{PPPoEUsername}\`
🔑 PPPoE Password: \`{PPPoEPassword}\`
🆔 Customer ID: \`{CustomerID}\`
📦 Package: *{PackageName}*
📅 মেয়াদ উত্তীর্ণ / Expires: *{ExpiryDate}*
💰 বকেয়া / Due Amount: *৳{Amount}*
━━━━━━━━━━━━━━━━

⚠️ সংযোগ বিচ্ছিন্ন এড়াতে অনুগ্রহ করে পেমেন্ট করুন।
Please pay to avoid disconnection.

ধন্যবাদ / Thank you
*{ISPName}* 🌐`,
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
          settingsMap[s.key] = decodeSettingValue(s.value);
        });
        setSettings(prev => ({
          ...prev,
          isp_name: settingsMap.isp_name || "Smart ISP",
          google_maps_api_key: settingsMap.google_maps_api_key || "",
          whatsapp_template: settingsMap.whatsapp_template || prev.whatsapp_template,
        }));
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
      const normalizedWhatsapp = normalizeTemplateVars(settings.whatsapp_template);

      await Promise.all([
        supabase.from('system_settings').upsert({ 
          key: 'isp_name', 
          value: settings.isp_name,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }),
        supabase.from('system_settings').upsert({ 
          key: 'google_maps_api_key', 
          value: settings.google_maps_api_key,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }),
        supabase.from('system_settings').upsert({ 
          key: 'whatsapp_template', 
          value: normalizedWhatsapp,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }),
      ]);

      setSettings((prev) => ({ ...prev, whatsapp_template: normalizedWhatsapp }));

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
            <TabsTrigger value="communications" className="flex items-center gap-1.5 px-3 py-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Communications</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-1.5 px-3 py-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
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
            <TabsTrigger value="contracts" className="flex items-center gap-1.5 px-3 py-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="bkash" className="flex items-center gap-1.5 px-3 py-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">bKash</span>
              </TabsTrigger>
            )}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="general">
          <div className="space-y-6">
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
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    Google Maps API Key
                  </Label>
                  <Input
                    type="password"
                    value={settings.google_maps_api_key}
                    onChange={(e) => setSettings({ ...settings, google_maps_api_key: e.target.value })}
                    placeholder="AIzaSy..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for customer map view. Get your API key from{" "}
                    <a 
                      href="https://console.cloud.google.com/apis/credentials" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Google Cloud Console
                    </a>
                  </p>
                </div>

                <Button onClick={saveSettings} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="form-section max-w-2xl">
                <h3 className="form-section-title flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Data Reset (Super Admin Only)
                </h3>
                <DataResetPanel />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Communications - Merged Tab */}
        <TabsContent value="communications">
          <div className="space-y-4">
            {/* WhatsApp Settings */}
            <Collapsible
              open={openSections.includes("whatsapp")}
              onOpenChange={() => toggleSection("whatsapp")}
            >
              <div className="form-section">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold">
                      <MessageSquare className="h-5 w-5 text-[hsl(var(--status-active))]" />
                      WhatsApp Message Template
                    </h3>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", openSections.includes("whatsapp") && "rotate-180")} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
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
                        <code className="bg-background px-2 py-1 rounded">{'{CustomerID}'}</code>
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
                        <code className="bg-background px-2 py-1 rounded">{'{ISPName}'}</code>
                        <span>Your ISP name</span>
                      </div>
                    </div>
                    <Button onClick={saveSettings} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Template"}
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Email / SMTP Settings */}
            <Collapsible
              open={openSections.includes("email")}
              onOpenChange={() => toggleSection("email")}
            >
              <div className="form-section">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold">
                      <Mail className="h-5 w-5 text-primary" />
                      Email / SMTP Settings
                    </h3>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", openSections.includes("email") && "rotate-180")} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <EmailTemplates />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* SMS Settings */}
            <Collapsible
              open={openSections.includes("sms")}
              onOpenChange={() => toggleSection("sms")}
            >
              <div className="form-section">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold">
                      <Smartphone className="h-5 w-5 text-[hsl(var(--chart-3))]" />
                      SMS Settings
                    </h3>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", openSections.includes("sms") && "rotate-180")} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <SmsSettings />
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* OTP / Firebase Settings */}
            <Collapsible
              open={openSections.includes("otp")}
              onOpenChange={() => toggleSection("otp")}
            >
              <div className="form-section">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between cursor-pointer">
                    <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold">
                      <Lock className="h-5 w-5 text-[hsl(var(--status-suspended))]" />
                      OTP / Firebase Settings
                    </h3>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", openSections.includes("otp") && "rotate-180")} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <FirebaseOtpSettings />
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <BillingSettings />
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

        <TabsContent value="contracts">
          <ContractTemplates />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="bkash">
            <BkashSettings />
          </TabsContent>
        )}
      </Tabs>
    </DashboardLayout>
  );
}
