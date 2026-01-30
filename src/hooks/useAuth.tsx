import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "@/lib/api";

type AppRole = "super_admin" | "admin" | "staff";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: AppRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    const storedRole = localStorage.getItem("auth_role");

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setRole(storedRole as AppRole || null);
        
        // Verify token is still valid
        verifyToken(storedToken);
      } catch (error) {
        console.error("Error parsing stored user:", error);
        clearAuth();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (authToken: string) => {
    try {
      const response = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
        setRole(response.data.role as AppRole);
        localStorage.setItem("auth_user", JSON.stringify(response.data.user));
        localStorage.setItem("auth_role", response.data.role);
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post("/auth/login", { email, password });
      
      if (response.data.success) {
        const { token: authToken, user: userData, role: userRole } = response.data;
        
        setToken(authToken);
        setUser(userData);
        setRole(userRole as AppRole);
        
        localStorage.setItem("auth_token", authToken);
        localStorage.setItem("auth_user", JSON.stringify(userData));
        localStorage.setItem("auth_role", userRole);
        
        return { success: true };
      } else {
        return { success: false, error: response.data.error || "Login failed" };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      // Check if it's an axios error with response
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        return { success: false, error: axiosError.response?.data?.error || errorMessage };
      }
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    clearAuth();
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    setRole(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_role");
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isSuperAdmin: role === "super_admin",
        isAdmin: role === "admin" || role === "super_admin",
        isStaff: role === "staff",
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
