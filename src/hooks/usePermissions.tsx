import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase
        .from("permissions")
        .select("resource, action, allowed")
        .eq("role", role);

      if (error) {
        console.error("Error fetching permissions:", error);
        setPermissions([]);
      } else {
        setPermissions(data || []);
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
      
      // Admin always has full access as fallback
      if (role === "admin") return true;
      
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
