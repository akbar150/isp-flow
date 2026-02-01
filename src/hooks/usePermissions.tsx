import { useState, useEffect, useCallback, useMemo } from "react";
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
    if (!role) {
      setLoading(false);
      return;
    }

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

  // Memoize permissions map for faster lookups
  const permissionsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    permissions.forEach(p => {
      map.set(`${p.resource}:${p.action}`, p.allowed);
    });
    return map;
  }, [permissions]);

  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      if (!role) return false;
      
      // super_admin always has full access
      if (role === "super_admin") return true;
      
      // Admin role - check database permissions
      // Staff role - check database permissions
      const key = `${resource}:${action}`;
      return permissionsMap.get(key) ?? false;
    },
    [permissionsMap, role]
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
