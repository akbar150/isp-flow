import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Plus, Trash2 } from "lucide-react";

interface Area {
  id: string;
  name: string;
  description: string | null;
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);
  const [newArea, setNewArea] = useState({ name: "", description: "" });

  const [settings, setSettings] = useState({
    isp_name: "Smart ISP",
    whatsapp_template: `Dear {CustomerName},
User ID: {user_id}

Your internet package {PackageName}, will expire on {ExpiryDate}.

Please pay ৳{Amount} to avoid disconnection.

– {ISP Name}`,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, areasRes] = await Promise.all([
        supabase.from('system_settings').select('*'),
        supabase.from('areas').select('*').order('name'),
      ]);

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

      setAreas(areasRes.data || []);
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

  const addArea = async () => {
    if (!newArea.name.trim()) return;

    try {
      const { error } = await supabase.from('areas').insert({
        name: newArea.name,
        description: newArea.description || null,
      });

      if (error) throw error;
      toast({ title: "Area added" });
      setNewArea({ name: "", description: "" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add area",
        variant: "destructive",
      });
    }
  };

  const deleteArea = async (id: string) => {
    if (!confirm("Delete this area?")) return;

    try {
      const { error } = await supabase.from('areas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Area deleted" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Cannot delete area (may have assigned customers)",
        variant: "destructive",
      });
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
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Template</TabsTrigger>
          <TabsTrigger value="areas">Areas/Zones</TabsTrigger>
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
                  This name appears in WhatsApp messages and system branding
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
          <div className="form-section max-w-2xl">
            <h3 className="form-section-title">Areas / Zones</h3>
            
            {/* Add new area */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Area name"
                  value={newArea.name}
                  onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Description (optional)"
                  value={newArea.description}
                  onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                />
              </div>
              <Button onClick={addArea}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Areas list */}
            <div className="space-y-2">
              {areas.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  No areas defined yet
                </p>
              ) : (
                areas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{area.name}</p>
                      {area.description && (
                        <p className="text-sm text-muted-foreground">{area.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => deleteArea(area.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
