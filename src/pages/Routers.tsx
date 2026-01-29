import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Wifi, WifiOff, Router as RouterIcon } from "lucide-react";
import { MikrotikServiceFactory } from "@/services/mikrotik/MikrotikServiceFactory";

interface Router {
  id: string;
  name: string;
  ip_address: string | null;
  port: number;
  username: string | null;
  mode: 'dummy' | 'real';
  is_active: boolean;
}

export default function Routers() {
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRouter, setEditingRouter] = useState<Router | null>(null);
  const [testingRouter, setTestingRouter] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    ip_address: "",
    port: "8728",
    username: "admin",
    password: "",
    mode: "dummy" as 'dummy' | 'real',
    is_active: true,
  });

  useEffect(() => {
    fetchRouters();
  }, []);

  const fetchRouters = async () => {
    try {
      const { data, error } = await supabase
        .from('routers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRouters(data || []);
    } catch (error) {
      console.error('Error fetching routers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Hash password if provided using database function
      let hashedPassword = null;
      if (formData.password) {
        const { data, error: hashError } = await supabase
          .rpc('hash_password', { raw_password: formData.password });
        if (hashError) throw new Error('Failed to secure password');
        hashedPassword = data;
      }

      const routerData = {
        name: formData.name,
        ip_address: formData.ip_address || null,
        port: parseInt(formData.port) || 8728,
        username: formData.username || null,
        password_encrypted: hashedPassword,
        mode: formData.mode,
        is_active: formData.is_active,
      };

      if (editingRouter) {
        const { error } = await supabase
          .from('routers')
          .update(routerData)
          .eq('id', editingRouter.id);

        if (error) throw error;
        toast({ title: "Router updated successfully" });
      } else {
        const { error } = await supabase.from('routers').insert(routerData);
        if (error) throw error;
        toast({ title: "Router added successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchRouters();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save router",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (router: Router) => {
    setEditingRouter(router);
    setFormData({
      name: router.name,
      ip_address: router.ip_address || "",
      port: String(router.port),
      username: router.username || "admin",
      password: "",
      mode: router.mode,
      is_active: router.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this router?")) return;

    try {
      const { error } = await supabase.from('routers').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Router deleted" });
      fetchRouters();
    } catch (error) {
      toast({
        title: "Error",
        description: "Cannot delete router (may have assigned customers)",
        variant: "destructive",
      });
    }
  };

  const testConnection = async (router: Router) => {
    setTestingRouter(router.id);
    
    try {
      const service = MikrotikServiceFactory.create({
        id: router.id,
        name: router.name,
        mode: router.mode,
        ipAddress: router.ip_address || undefined,
        port: router.port,
        username: router.username || undefined,
      });

      const result = await service.connect();
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.message,
        });
        await service.disconnect();
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Connection test failed",
        variant: "destructive",
      });
    } finally {
      setTestingRouter(null);
    }
  };

  const resetForm = () => {
    setEditingRouter(null);
    setFormData({
      name: "",
      ip_address: "",
      port: "8728",
      username: "admin",
      password: "",
      mode: "dummy",
      is_active: true,
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading routers...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Routers</h1>
          <p className="page-description">Manage Mikrotik routers and connection modes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Router
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRouter ? "Edit Router" : "Add New Router"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Router Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Router"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Mode *</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value: 'dummy' | 'real') => 
                    setFormData({ ...formData, mode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dummy">Dummy (Simulation)</SelectItem>
                    <SelectItem value="real">Real (RouterOS v6 API)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.mode === 'dummy' 
                    ? "Simulation mode - no real router connection required"
                    : "Real mode requires RouterOS v6 API connection (coming soon)"
                  }
                </p>
              </div>

              {formData.mode === 'real' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IP Address</Label>
                      <Input
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder={editingRouter ? "Leave empty to keep existing" : ""}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRouter ? "Update" : "Add"} Router
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Routers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No routers configured yet.
          </div>
        ) : (
          routers.map((router) => (
            <div
              key={router.id}
              className={`form-section relative ${!router.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`metric-icon ${router.mode === 'dummy' ? 'bg-orange-100 text-orange-600' : 'metric-icon-primary'}`}>
                    <RouterIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{router.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      router.mode === 'dummy' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {router.mode === 'dummy' ? 'Simulation' : 'Real'}
                    </span>
                  </div>
                </div>
                {router.is_active ? (
                  <Wifi className="w-5 h-5 text-status-active" />
                ) : (
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {router.mode === 'real' && (
                <div className="text-sm text-muted-foreground mb-4 space-y-1">
                  <p>IP: {router.ip_address || 'Not set'}</p>
                  <p>Port: {router.port}</p>
                  <p>User: {router.username || 'Not set'}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection(router)}
                  disabled={testingRouter === router.id}
                >
                  {testingRouter === router.id ? 'Testing...' : 'Test'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(router)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(router.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
