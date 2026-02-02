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
      admin_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
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
      asset_assignments: {
        Row: {
          account_type: string | null
          assigned_by: string | null
          assigned_date: string
          condition_on_assign: string | null
          condition_on_return: string | null
          created_at: string
          customer_id: string
          id: string
          inventory_item_id: string
          invoice_id: string | null
          item_condition: string | null
          notes: string | null
          purchase_price_at_assign: number | null
          returned_date: string | null
          selling_price: number | null
          technician_name: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          assigned_by?: string | null
          assigned_date?: string
          condition_on_assign?: string | null
          condition_on_return?: string | null
          created_at?: string
          customer_id: string
          id?: string
          inventory_item_id: string
          invoice_id?: string | null
          item_condition?: string | null
          notes?: string | null
          purchase_price_at_assign?: number | null
          returned_date?: string | null
          selling_price?: number | null
          technician_name?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          assigned_by?: string | null
          assigned_date?: string
          condition_on_assign?: string | null
          condition_on_return?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          inventory_item_id?: string
          invoice_id?: string | null
          item_condition?: string | null
          notes?: string | null
          purchase_price_at_assign?: number | null
          returned_date?: string | null
          selling_price?: number | null
          technician_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_records: {
        Row: {
          amount: number
          amount_paid: number
          billing_date: string
          created_at: string
          customer_id: string
          due_date: string
          id: string
          notes: string | null
          package_name: string
          paid_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          billing_date?: string
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          notes?: string | null
          package_name: string
          paid_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          billing_date?: string
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          package_name?: string
          paid_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
        ]
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
          billing_cycle:
            | Database["public"]["Enums"]["billing_cycle_type"]
            | null
          billing_start_date: string
          connection_type: Database["public"]["Enums"]["connection_type"] | null
          created_at: string
          email: string | null
          expiry_date: string
          full_name: string
          id: string
          latitude: number | null
          longitude: number | null
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
          billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle_type"]
            | null
          billing_start_date?: string
          connection_type?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          created_at?: string
          email?: string | null
          expiry_date: string
          full_name: string
          id?: string
          latitude?: number | null
          longitude?: number | null
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
          billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle_type"]
            | null
          billing_start_date?: string
          connection_type?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          created_at?: string
          email?: string | null
          expiry_date?: string
          full_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
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
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      designations: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account: string | null
          basic_salary: number
          created_at: string
          department_id: string | null
          designation_id: string | null
          email: string | null
          emergency_contact: string | null
          employee_code: string
          full_name: string
          id: string
          joining_date: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["employee_status"]
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          basic_salary?: number
          created_at?: string
          department_id?: string | null
          designation_id?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code: string
          full_name: string
          id?: string
          joining_date?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          basic_salary?: number
          created_at?: string
          department_id?: string | null
          designation_id?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_code?: string
          full_name?: string
          id?: string
          joining_date?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          cable_color: string | null
          cable_length_m: number | null
          core_count: number | null
          created_at: string
          id: string
          mac_address: string | null
          notes: string | null
          product_id: string
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          supplier_id: string | null
          updated_at: string
          warranty_end_date: string | null
        }
        Insert: {
          cable_color?: string | null
          cable_length_m?: number | null
          core_count?: number | null
          created_at?: string
          id?: string
          mac_address?: string | null
          notes?: string | null
          product_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          updated_at?: string
          warranty_end_date?: string | null
        }
        Update: {
          cable_color?: string | null
          cable_length_m?: number | null
          core_count?: number | null
          created_at?: string
          id?: string
          mac_address?: string | null
          notes?: string | null
          product_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          supplier_id?: string | null
          updated_at?: string
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          billing_record_id: string | null
          created_at: string
          customer_id: string
          discount: number
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          billing_record_id?: string | null
          created_at?: string
          customer_id: string
          discount?: number
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          billing_record_id?: string | null
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billing_record_id_fkey"
            columns: ["billing_record_id"]
            isOneToOne: false
            referencedRelation: "billing_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string
          days_per_year: number
          id: string
          is_active: boolean
          is_paid: boolean
          name: string
        }
        Insert: {
          created_at?: string
          days_per_year?: number
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name: string
        }
        Update: {
          created_at?: string
          days_per_year?: number
          id?: string
          is_active?: boolean
          is_paid?: boolean
          name?: string
        }
        Relationships: []
      }
      metered_usage_logs: {
        Row: {
          account_type: string | null
          color: string | null
          core_count: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity_used: number
          selling_price: number | null
          technician_name: string | null
          usage_date: string | null
          usage_type: string
        }
        Insert: {
          account_type?: string | null
          color?: string | null
          core_count?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity_used: number
          selling_price?: number | null
          technician_name?: string | null
          usage_date?: string | null
          usage_type?: string
        }
        Update: {
          account_type?: string | null
          color?: string | null
          core_count?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity_used?: number
          selling_price?: number | null
          technician_name?: string | null
          usage_date?: string | null
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "metered_usage_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metered_usage_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metered_usage_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      payroll: {
        Row: {
          allowances: number
          basic_salary: number
          bonus: number
          commission: number
          created_at: string
          deductions: number
          employee_id: string
          id: string
          month: number
          net_salary: number
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          updated_at: string
          year: number
        }
        Insert: {
          allowances?: number
          basic_salary?: number
          bonus?: number
          commission?: number
          created_at?: string
          deductions?: number
          employee_id: string
          id?: string
          month: number
          net_salary?: number
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
          year: number
        }
        Update: {
          allowances?: number
          basic_salary?: number
          bonus?: number
          commission?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          id?: string
          month?: number
          net_salary?: number
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_metered: boolean | null
          name: string
          requires_mac: boolean | null
          requires_serial: boolean | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_metered?: boolean | null
          name: string
          requires_mac?: boolean | null
          requires_serial?: boolean | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_metered?: boolean | null
          name?: string
          requires_mac?: boolean | null
          requires_serial?: boolean | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metered_quantity: number | null
          min_stock_level: number
          model: string | null
          name: string
          purchase_price: number
          selling_price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metered_quantity?: number | null
          min_stock_level?: number
          model?: string | null
          name: string
          purchase_price?: number
          selling_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metered_quantity?: number | null
          min_stock_level?: number
          model?: string | null
          name?: string
          purchase_price?: number
          selling_price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
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
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
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
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payment_method: string
          reference_id: string | null
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method: string
          reference_id?: string | null
          transaction_date?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method?: string
          reference_id?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
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
          billing_cycle:
            | Database["public"]["Enums"]["billing_cycle_type"]
            | null
          billing_start_date: string | null
          connection_type: Database["public"]["Enums"]["connection_type"] | null
          created_at: string | null
          expiry_date: string | null
          full_name: string | null
          id: string | null
          latitude: number | null
          longitude: number | null
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
          billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle_type"]
            | null
          billing_start_date?: string | null
          connection_type?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          created_at?: string | null
          expiry_date?: string | null
          full_name?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
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
          billing_cycle?:
            | Database["public"]["Enums"]["billing_cycle_type"]
            | null
          billing_start_date?: string | null
          connection_type?:
            | Database["public"]["Enums"]["connection_type"]
            | null
          created_at?: string | null
          expiry_date?: string | null
          full_name?: string | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
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
      employees_safe: {
        Row: {
          created_at: string | null
          department_id: string | null
          designation_id: string | null
          employee_code: string | null
          full_name: string | null
          id: string | null
          joining_date: string | null
          notes: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          termination_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          designation_id?: string | null
          employee_code?: string | null
          full_name?: string | null
          id?: string | null
          joining_date?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          designation_id?: string | null
          employee_code?: string | null
          full_name?: string | null
          id?: string | null
          joining_date?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
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
      payroll_safe: {
        Row: {
          created_at: string | null
          employee_id: string | null
          id: string | null
          month: number | null
          status: Database["public"]["Enums"]["payroll_status"] | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          id?: string | null
          month?: number | null
          status?: Database["public"]["Enums"]["payroll_status"] | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          id?: string | null
          month?: number | null
          status?: Database["public"]["Enums"]["payroll_status"] | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees_safe"
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
      decrypt_smtp_password: {
        Args: { encrypted_password: string }
        Returns: string
      }
      encrypt_smtp_password: {
        Args: { plain_password: string }
        Returns: string
      }
      generate_customer_user_id: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      get_public_system_settings: {
        Args: never
        Returns: {
          key: string
          value: Json
        }[]
      }
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
      asset_status: "in_stock" | "assigned" | "returned" | "damaged" | "sold"
      attendance_status: "present" | "absent" | "late" | "half_day" | "on_leave"
      billing_cycle_type: "monthly" | "quarterly" | "yearly"
      connection_type: "pppoe" | "static" | "dhcp"
      customer_status: "active" | "expiring" | "expired" | "suspended"
      employee_status: "active" | "on_leave" | "terminated" | "resigned"
      invoice_status:
        | "draft"
        | "sent"
        | "paid"
        | "partial"
        | "overdue"
        | "cancelled"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      mikrotik_user_status: "enabled" | "disabled"
      notification_type:
        | "overdue_customer"
        | "expiring_customer"
        | "low_stock"
        | "payment_received"
        | "system"
        | "new_customer"
        | "billing_generated"
        | "asset_assigned"
        | "hrm_update"
        | "accounting_update"
      payment_method: "bkash" | "cash" | "bank_transfer" | "due"
      payroll_status: "draft" | "approved" | "paid"
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
      asset_status: ["in_stock", "assigned", "returned", "damaged", "sold"],
      attendance_status: ["present", "absent", "late", "half_day", "on_leave"],
      billing_cycle_type: ["monthly", "quarterly", "yearly"],
      connection_type: ["pppoe", "static", "dhcp"],
      customer_status: ["active", "expiring", "expired", "suspended"],
      employee_status: ["active", "on_leave", "terminated", "resigned"],
      invoice_status: [
        "draft",
        "sent",
        "paid",
        "partial",
        "overdue",
        "cancelled",
      ],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      mikrotik_user_status: ["enabled", "disabled"],
      notification_type: [
        "overdue_customer",
        "expiring_customer",
        "low_stock",
        "payment_received",
        "system",
        "new_customer",
        "billing_generated",
        "asset_assigned",
        "hrm_update",
        "accounting_update",
      ],
      payment_method: ["bkash", "cash", "bank_transfer", "due"],
      payroll_status: ["draft", "approved", "paid"],
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
