export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      call_records: {
        Row: {
          call_date: string
          called_by: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string
        }
        Insert: {
          call_date?: string
          called_by?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes: string
        }
        Update: {
          call_date?: string
          called_by?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          alt_phone: string | null
          area_id: string | null
          auto_renew: boolean
          billing_start_date: string
          created_at: string
          expiry_date: string
          full_name: string
          id: string
          package_id: string | null
          password_hash: string
          phone: string
          router_id: string | null
          status: Database["public"]["Enums"]["customer_status"]
          total_due: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          alt_phone?: string | null
          area_id?: string | null
          auto_renew?: boolean
          billing_start_date?: string
          created_at?: string
          expiry_date: string
          full_name: string
          id?: string
          package_id?: string | null
          password_hash: string
          phone: string
          router_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          total_due?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          alt_phone?: string | null
          area_id?: string | null
          auto_renew?: boolean
          billing_start_date?: string
          created_at?: string
          expiry_date?: string
          full_name?: string
          id?: string
          package_id?: string | null
          password_hash?: string
          phone?: string
          router_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          total_due?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mikrotik_users: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_synced_at: string | null
          password_encrypted: string
          profile: string | null
          router_id: string | null
          status: Database["public"]["Enums"]["mikrotik_user_status"]
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_synced_at?: string | null
          password_encrypted: string
          profile?: string | null
          router_id?: string | null
          status?: Database["public"]["Enums"]["mikrotik_user_status"]
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_synced_at?: string | null
          password_encrypted?: string
          profile?: string | null
          router_id?: string | null
          status?: Database["public"]["Enums"]["mikrotik_user_status"]
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "mikrotik_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mikrotik_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mikrotik_users_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mikrotik_users_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          monthly_price: number
          name: string
          speed_mbps: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_price: number
          name: string
          speed_mbps: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_price?: number
          name?: string
          speed_mbps?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          remaining_due: number
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          remaining_due?: number
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          remaining_due?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          action: string
          allowed?: boolean
          created_at?: string
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          channel: string
          customer_id: string
          id: string
          message: string | null
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          channel?: string
          customer_id: string
          id?: string
          message?: string | null
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          channel?: string
          customer_id?: string
          id?: string
          message?: string | null
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      routers: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          mode: Database["public"]["Enums"]["router_mode"]
          name: string
          password_encrypted: string | null
          port: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          mode?: Database["public"]["Enums"]["router_mode"]
          name: string
          password_encrypted?: string | null
          port?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          mode?: Database["public"]["Enums"]["router_mode"]
          name?: string
          password_encrypted?: string | null
          port?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customers_safe: {
        Row: {
          address: string | null
          alt_phone: string | null
          area_id: string | null
          auto_renew: boolean | null
          billing_start_date: string | null
          created_at: string | null
          expiry_date: string | null
          full_name: string | null
          id: string | null
          package_id: string | null
          phone: string | null
          router_id: string | null
          status: Database["public"]["Enums"]["customer_status"] | null
          total_due: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          area_id?: string | null
          auto_renew?: boolean | null
          billing_start_date?: string | null
          created_at?: string | null
          expiry_date?: string | null
          full_name?: string | null
          id?: string | null
          package_id?: string | null
          phone?: string | null
          router_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"] | null
          total_due?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          area_id?: string | null
          auto_renew?: boolean | null
          billing_start_date?: string | null
          created_at?: string | null
          expiry_date?: string | null
          full_name?: string | null
          id?: string | null
          package_id?: string | null
          phone?: string | null
          router_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"] | null
          total_due?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mikrotik_users_safe: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string | null
          last_synced_at: string | null
          profile: string | null
          router_id: string | null
          status: Database["public"]["Enums"]["mikrotik_user_status"] | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          last_synced_at?: string | null
          profile?: string | null
          router_id?: string | null
          status?: Database["public"]["Enums"]["mikrotik_user_status"] | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          last_synced_at?: string | null
          profile?: string | null
          router_id?: string | null
          status?: Database["public"]["Enums"]["mikrotik_user_status"] | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mikrotik_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mikrotik_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mikrotik_users_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mikrotik_users_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "routers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      routers_safe: {
        Row: {
          created_at: string | null
          id: string | null
          ip_address: string | null
          is_active: boolean | null
          mode: Database["public"]["Enums"]["router_mode"] | null
          name: string | null
          port: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          ip_address?: string | null
          is_active?: boolean | null
          mode?: Database["public"]["Enums"]["router_mode"] | null
          name?: string | null
          port?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          ip_address?: string | null
          is_active?: boolean | null
          mode?: Database["public"]["Enums"]["router_mode"] | null
          name?: string | null
          port?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      system_settings_public: {
        Row: {
          key: string | null
          value: Json | null
        }
        Insert: {
          key?: string | null
          value?: Json | null
        }
        Update: {
          key?: string | null
          value?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_customer_user_id: { Args: never; Returns: string }
      has_permission: {
        Args: { _action: string; _resource: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_password: { Args: { raw_password: string }; Returns: string }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      verify_password: {
        Args: { hashed_password: string; raw_password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "super_admin"
      customer_status: "active" | "expiring" | "expired" | "suspended"
      mikrotik_user_status: "enabled" | "disabled"
      payment_method: "bkash" | "cash" | "bank_transfer" | "due"
      reminder_type:
        | "3_days_before"
        | "1_day_before"
        | "expiry_day"
        | "3_days_overdue"
      router_mode: "dummy" | "real"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "super_admin"],
      customer_status: ["active", "expiring", "expired", "suspended"],
      mikrotik_user_status: ["enabled", "disabled"],
      payment_method: ["bkash", "cash", "bank_transfer", "due"],
      reminder_type: [
        "3_days_before",
        "1_day_before",
        "expiry_day",
        "3_days_overdue",
      ],
      router_mode: ["dummy", "real"],
    },
  },
} as const
