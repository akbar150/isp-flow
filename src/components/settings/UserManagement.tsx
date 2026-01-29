import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Trash2, Shield, User, Crown, Pencil, KeyRound, Loader2 } from "lucide-react";
import { z } from "zod";

type AppRole = "super_admin" | "admin" | "staff";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name too long"),
  role: z.enum(["super_admin", "admin", "staff"]),
});

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
}

export function UserManagement() {
  const { role: currentUserRole, user: currentUser } = useAuth();
  const isSuperAdmin = currentUserRole === "super_admin";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "staff" as AppRole,
  });
  
  const [editData, setEditData] = useState({
    email: "",
    full_name: "",
    role: "staff" as AppRole,
    password: "",
  });
  
  const [resetEmail, setResetEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get current session for Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Fetch users with their emails via edge function
      const { data: usersData, error: usersError } = await supabase.functions.invoke("manage-user", {
        body: { action: "list" },
      });

      if (usersError) {
        console.error("Edge function network error:", usersError);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to connect to the server. Using local data.",
        });
        await fetchUsersLocally();
        return;
      }

      if (usersData?.success === false) {
        console.error("Edge function returned error:", usersData.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: usersData.error || "Failed to load users",
        });
        await fetchUsersLocally();
        return;
      }

      if (usersData?.users) {
        setUsers(usersData.users);
      } else {
        await fetchUsersLocally();
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      await fetchUsersLocally();
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersLocally = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at");

      if (rolesError) throw rolesError;

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      const usersWithProfiles: AdminUser[] = rolesData.map((role) => {
        const profile = profilesData.find((p) => p.user_id === role.user_id);
        return {
          id: role.user_id,
          email: role.user_id === currentUser?.id ? (currentUser.email || "") : "(email hidden)",
          full_name: profile?.full_name || null,
          role: role.role as AppRole,
          created_at: role.created_at,
        };
      });

      setUsers(usersWithProfiles);
    } catch (error) {
      console.error("Error fetching users locally:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users",
      });
    }
  };

  const handleCreateUser = async () => {
    setErrors({});

    const result = createUserSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Check permissions
    if ((formData.role === "admin" || formData.role === "super_admin") && !isSuperAdmin) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only super admins can create admin users",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "create", ...formData },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "User Created",
        description: `Successfully created ${formData.role} user: ${formData.email}`,
      });

      setDialogOpen(false);
      setFormData({ email: "", password: "", full_name: "", role: "staff" });
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error creating user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setCreating(true);
    try {
      const updateData: Record<string, unknown> = {
        action: "update",
        user_id: selectedUser.id,
      };

      // Always include fields that can be updated
      if (editData.email && editData.email !== selectedUser.email && editData.email !== "(email hidden)") {
        updateData.email = editData.email;
      }
      if (editData.full_name && editData.full_name !== selectedUser.full_name) {
        updateData.full_name = editData.full_name;
      }
      if (editData.password) {
        updateData.password = editData.password;
      }
      if (isSuperAdmin && editData.role !== selectedUser.role) {
        updateData.role = editData.role;
      }

      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: updateData,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "User Updated",
        description: "User profile has been updated successfully",
      });

      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error updating user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) return;

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "reset_password", email: resetEmail },
      });

      if (error) throw error;

      toast({
        title: "Password Reset Sent",
        description: data.message || "Password reset email has been sent",
      });

      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error: unknown) {
      console.error("Error resetting password:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send password reset",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userRole: AppRole) => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) {
      return;
    }

    // Check permissions
    if ((userRole === "admin" || userRole === "super_admin") && !isSuperAdmin) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only super admins can delete admin users",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "delete", user_id: userId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "User Deleted",
        description: "The user has been removed",
      });

      fetchUsers();
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
      });
    }
  };

  const openEditDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setEditData({
      email: user.email !== "(email hidden)" ? user.email : "",
      full_name: user.full_name || "",
      role: user.role,
      password: "",
    });
    setEditDialogOpen(true);
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case "super_admin":
        return <Crown className="h-3 w-3 mr-1" />;
      case "admin":
        return <Shield className="h-3 w-3 mr-1" />;
      default:
        return <User className="h-3 w-3 mr-1" />;
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "super_admin":
        return "default" as const;
      case "admin":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Admin & Staff Users</h3>
          <p className="text-sm text-muted-foreground">
            Manage admin and staff accounts.
            {isSuperAdmin ? " You have super admin access." : " Only super admins can create admin users."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <KeyRound className="h-4 w-4 mr-2" />
                Reset Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Password Reset Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">User Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="user@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleResetPassword} disabled={creating || !resetEmail} className="w-full">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Email"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                  {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isSuperAdmin && (
                        <SelectItem value="super_admin">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4" />
                            Super Admin
                          </div>
                        </SelectItem>
                      )}
                      {isSuperAdmin && (
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin
                          </div>
                        </SelectItem>
                      )}
                      <SelectItem value="staff">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Staff
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateUser} disabled={creating} className="w-full">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="user@example.com"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                disabled={!isSuperAdmin}
              />
              {!isSuperAdmin && (
                <p className="text-xs text-muted-foreground">Only Super Admins can change email addresses</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-full_name">Full Name</Label>
              <Input
                id="edit-full_name"
                placeholder="John Doe"
                value={editData.full_name}
                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="••••••••"
                value={editData.password}
                onChange={(e) => setEditData({ ...editData, password: e.target.value })}
              />
            </div>
            {isSuperAdmin && selectedUser && (
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editData.role}
                  onValueChange={(value: AppRole) => setEditData({ ...editData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Super Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Staff
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleEditUser} disabled={creating} className="w-full">
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update User"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center w-fit">
                        {getRoleIcon(user.role)}
                        {user.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {(isSuperAdmin || user.role === "staff") && user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id, user.role)}
                            className="text-destructive hover:text-destructive"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
