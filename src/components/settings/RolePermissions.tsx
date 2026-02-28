import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  Shield, 
  User, 
  Users, 
  CreditCard, 
  Package, 
  Router, 
  MapPin, 
  Phone, 
  Bell, 
  FileText, 
  Receipt, 
  FolderOpen, 
  Settings,
  TicketCheck,
  WifiOff,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Permission {
  id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
}

const RESOURCES = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "packages", label: "Packages", icon: Package },
  { key: "routers", label: "Routers", icon: Router },
  { key: "areas", label: "Areas/Zones", icon: MapPin },
  { key: "call_records", label: "Call Records", icon: Phone },
  { key: "reminders", label: "Reminders", icon: Bell },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "hrm", label: "HRM", icon: User },
  { key: "suppliers", label: "Suppliers", icon: Receipt },
  { key: "expense_categories", label: "Expense Categories", icon: FolderOpen },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "users", label: "User Management", icon: User },
  { key: "tickets", label: "Support Tickets", icon: TicketCheck },
  { key: "outages", label: "Network Outages", icon: WifiOff },
];

const ACTIONS = [
  { key: "create", label: "Create" },
  { key: "read", label: "View" },
  { key: "update", label: "Edit" },
  { key: "delete", label: "Delete" },
];

type AppRole = "super_admin" | "admin" | "staff";

export function RolePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<AppRole>("admin");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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
      setOriginalPermissions(JSON.parse(JSON.stringify(data || [])));
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

  const rolePermissions = useMemo(() => {
    return permissions.filter((p) => p.role === activeRole);
  }, [permissions, activeRole]);

  const changeCount = useMemo(() => {
    let count = 0;
    permissions.forEach((p) => {
      const original = originalPermissions.find((op) => op.id === p.id);
      if (original && original.allowed !== p.allowed) {
        count++;
      }
    });
    return count;
  }, [permissions, originalPermissions]);

  const isAllowed = (resource: string, action: string): boolean => {
    const perm = rolePermissions.find(
      (p) => p.resource === resource && p.action === action
    );
    return perm?.allowed ?? false;
  };

  const getResourceStats = (resource: string) => {
    const resourcePerms = rolePermissions.filter((p) => p.resource === resource);
    const enabled = resourcePerms.filter((p) => p.allowed).length;
    return { enabled, total: resourcePerms.length };
  };

  const togglePermission = (resource: string, action: string) => {
    if (activeRole === "super_admin") return;

    setPermissions((prev) =>
      prev.map((p) => {
        if (p.role === activeRole && p.resource === resource && p.action === action) {
          return { ...p, allowed: !p.allowed };
        }
        return p;
      })
    );
  };

  const toggleAllForResource = (resource: string, enable: boolean) => {
    if (activeRole === "super_admin") return;

    setPermissions((prev) =>
      prev.map((p) => {
        if (p.role === activeRole && p.resource === resource) {
          return { ...p, allowed: enable };
        }
        return p;
      })
    );
  };

  const toggleAllPermissions = (enable: boolean) => {
    if (activeRole === "super_admin") return;

    setPermissions((prev) =>
      prev.map((p) => {
        if (p.role === activeRole) {
          return { ...p, allowed: enable };
        }
        return p;
      })
    );
  };

  const handleSaveClick = () => {
    if (changeCount > 0) {
      setShowConfirmDialog(true);
    }
  };

  const handleSave = async () => {
    setShowConfirmDialog(false);
    setSaving(true);
    try {
      const editablePermissions = permissions.filter(
        (p) => p.role === "staff" || p.role === "admin"
      );

      for (const perm of editablePermissions) {
        const original = originalPermissions.find((op) => op.id === perm.id);
        if (original && original.allowed !== perm.allowed) {
          const { error } = await supabase
            .from("permissions")
            .update({ allowed: perm.allowed })
            .eq("id", perm.id);

          if (error) throw error;
        }
      }

      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));

      toast({
        title: "Permissions Saved",
        description: `${changeCount} permission(s) updated successfully`,
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

  const resetChanges = () => {
    setPermissions(JSON.parse(JSON.stringify(originalPermissions)));
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Role Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Configure granular access control for each role
          </p>
        </div>
        <div className="flex items-center gap-2">
          {changeCount > 0 && (
            <>
              <Badge variant="secondary" className="gap-1">
                {changeCount} unsaved change{changeCount > 1 ? "s" : ""}
              </Badge>
              <Button variant="ghost" size="sm" onClick={resetChanges}>
                Reset
              </Button>
            </>
          )}
          <Button onClick={handleSaveClick} disabled={saving || changeCount === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Role Tabs */}
      <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as AppRole)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="super_admin" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Super Admin</span>
            <span className="sm:hidden">S.Admin</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admin
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeRole} className="mt-4 space-y-4">
          {/* Role Info Banner */}
          {activeRole === "super_admin" ? (
            <div className="p-4 bg-muted rounded-lg border border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-5 w-5" />
                <span className="font-medium">Super Admin has immutable full access to all resources</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllPermissions(true)}
                className="gap-2"
              >
                <ToggleRight className="h-4 w-4" />
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAllPermissions(false)}
                className="gap-2"
              >
                <ToggleLeft className="h-4 w-4" />
                Disable All
              </Button>
            </div>
          )}

          {/* Permissions Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">Resource</TableHead>
                  {ACTIONS.map((action) => (
                    <TableHead key={action.key} className="text-center w-[100px]">
                      {action.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-[120px]">Quick Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RESOURCES.map((resource) => {
                  const Icon = resource.icon;
                  const stats = getResourceStats(resource.key);
                  const allEnabled = stats.enabled === stats.total;
                  const allDisabled = stats.enabled === 0;

                  return (
                    <TableRow key={resource.key}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-muted">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <span className="font-medium">{resource.label}</span>
                            <div className="text-xs text-muted-foreground">
                              {stats.enabled}/{stats.total} enabled
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      {ACTIONS.map((action) => {
                        const allowed = isAllowed(resource.key, action.key);
                        return (
                          <TableCell key={action.key} className="text-center">
                            <div className="flex justify-center">
                              {activeRole === "super_admin" ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <Checkbox
                                  checked={allowed}
                                  onCheckedChange={() =>
                                    togglePermission(resource.key, action.key)
                                  }
                                  className={cn(
                                    "h-5 w-5 transition-colors",
                                    allowed && "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                  )}
                                />
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {activeRole !== "super_admin" && (
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => toggleAllForResource(resource.key, true)}
                              disabled={allEnabled}
                            >
                              <CheckCircle2 className={cn(
                                "h-4 w-4",
                                allEnabled ? "text-muted-foreground/40" : "text-green-600"
                              )} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => toggleAllForResource(resource.key, false)}
                              disabled={allDisabled}
                            >
                              <XCircle className={cn(
                                "h-4 w-4",
                                allDisabled ? "text-muted-foreground/40" : "text-destructive"
                              )} />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Permission Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to update {changeCount} permission{changeCount > 1 ? "s" : ""}. 
              These changes will immediately affect what users with the {activeRole} role can access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
