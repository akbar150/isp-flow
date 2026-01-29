import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Shield, User } from "lucide-react";

interface Permission {
  id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
}

const RESOURCES = [
  { key: "customers", label: "Customers", description: "Customer management" },
  { key: "payments", label: "Payments", description: "Payment processing" },
  { key: "packages", label: "Packages", description: "Internet packages" },
  { key: "routers", label: "Routers", description: "Router management" },
  { key: "areas", label: "Areas/Zones", description: "Area management" },
  { key: "call_records", label: "Call Records", description: "Customer call logs" },
  { key: "reminders", label: "Reminders", description: "Payment reminders" },
  { key: "settings", label: "Settings", description: "System settings" },
  { key: "users", label: "User Management", description: "Admin/staff accounts" },
];

const ACTIONS = ["create", "read", "update", "delete"];

export function RolePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<"admin" | "staff">("staff");
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("resource")
        .order("action");

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch permissions",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPermission = (resource: string, action: string): Permission | undefined => {
    return permissions.find(
      (p) => p.role === activeRole && p.resource === resource && p.action === action
    );
  };

  const isAllowed = (resource: string, action: string): boolean => {
    const perm = getPermission(resource, action);
    return perm?.allowed ?? false;
  };

  const togglePermission = (resource: string, action: string) => {
    // Don't allow modifying admin permissions
    if (activeRole === "admin") return;

    setPermissions((prev) =>
      prev.map((p) => {
        if (p.role === activeRole && p.resource === resource && p.action === action) {
          return { ...p, allowed: !p.allowed };
        }
        return p;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get all staff permissions that may have changed
      const staffPermissions = permissions.filter((p) => p.role === "staff");

      for (const perm of staffPermissions) {
        const { error } = await supabase
          .from("permissions")
          .update({ allowed: perm.allowed })
          .eq("id", perm.id);

        if (error) throw error;
      }

      toast({
        title: "Permissions Saved",
        description: "Role permissions have been updated successfully",
      });
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save permissions",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Role Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Configure what each role can do. Admin has full access by default.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as "admin" | "staff")}>
        <TabsList>
          <TabsTrigger value="admin" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admin
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeRole} className="mt-4">
          {activeRole === "admin" && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Admin role has full access to all resources and cannot be modified.
              </p>
            </div>
          )}

          <div className="grid gap-4">
            {RESOURCES.map((resource) => (
              <Card key={resource.key}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{resource.label}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {ACTIONS.map((action) => (
                      <div
                        key={action}
                        className="flex items-center justify-between space-x-2"
                      >
                        <Label
                          htmlFor={`${resource.key}-${action}`}
                          className="text-sm capitalize"
                        >
                          {action}
                        </Label>
                        <Switch
                          id={`${resource.key}-${action}`}
                          checked={isAllowed(resource.key, action)}
                          onCheckedChange={() =>
                            togglePermission(resource.key, action)
                          }
                          disabled={activeRole === "admin"}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
