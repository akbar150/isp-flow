import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "./useAuth";

interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

export function usePermissions() {
  const { role, user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role && user) {
      fetchPermissions();
    } else {
      setPermissions([]);
      setLoading(false);
    }
  }, [role, user]);

  const fetchPermissions = async () => {
    try {
      const response = await api.get(`/settings/permissions/${role}`);

      if (response.data.success) {
        setPermissions(response.data.permissions || []);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      if (!role) return false;
      
      // Only super_admin always has full access
      if (role === "super_admin") return true;
      
      // Admin and staff use permission-based access
      const permission = permissions.find(
        (p) => p.resource === resource && p.action === action
      );
      return permission?.allowed ?? false;
    },
    [permissions, role]
  );

  const canCreate = useCallback(
    (resource: string) => hasPermission(resource, "create"),
    [hasPermission]
  );

  const canRead = useCallback(
    (resource: string) => hasPermission(resource, "read"),
    [hasPermission]
  );

  const canUpdate = useCallback(
    (resource: string) => hasPermission(resource, "update"),
    [hasPermission]
  );

  const canDelete = useCallback(
    (resource: string) => hasPermission(resource, "delete"),
    [hasPermission]
  );

  return {
    permissions,
    loading,
    hasPermission,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    refetch: fetchPermissions,
  };
}
