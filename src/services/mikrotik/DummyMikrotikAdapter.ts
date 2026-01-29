import { supabase } from "@/integrations/supabase/client";
import type { IMikrotikService, MikrotikResponse, MikrotikUser } from "./types";

/**
 * Dummy Mikrotik Adapter
 * Simulates Mikrotik RouterOS API without real hardware connection.
 * All operations update the database only.
 */
export class DummyMikrotikAdapter implements IMikrotikService {
  private routerId: string;
  private routerName: string;
  private isConnected: boolean = false;

  constructor(routerId: string, routerName: string = "DUMMY_ROUTER") {
    this.routerId = routerId;
    this.routerName = routerName;
  }

  async connect(): Promise<MikrotikResponse> {
    // Simulate connection delay
    await this.simulateDelay(100);
    this.isConnected = true;
    
    return {
      success: true,
      router: this.routerName,
      status: "connected",
      message: "Simulation: Connected to dummy router"
    };
  }

  async disconnect(): Promise<MikrotikResponse> {
    await this.simulateDelay(50);
    this.isConnected = false;

    return {
      success: true,
      router: this.routerName,
      status: "disconnected",
      message: "Simulation: Disconnected from dummy router"
    };
  }

  async createUser(user: Omit<MikrotikUser, 'status'>): Promise<MikrotikResponse> {
    await this.simulateDelay(200);

    try {
      const { error } = await supabase
        .from('mikrotik_users')
        .insert({
          customer_id: user.userId,
          username: user.username,
          password_encrypted: user.password, // In real implementation, encrypt this
          profile: user.profile,
          status: 'enabled',
          router_id: this.routerId,
          last_synced_at: new Date().toISOString()
        });

      if (error) throw error;

      await this.logActivity('mikrotik_user_created', { user: user.username });

      return {
        success: true,
        router: this.routerName,
        status: "created",
        message: `Simulation: User ${user.username} created successfully`,
        data: { userId: user.userId }
      };
    } catch (error) {
      return {
        success: false,
        router: this.routerName,
        status: "error",
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async enableUser(userId: string): Promise<MikrotikResponse> {
    await this.simulateDelay(150);

    try {
      const { error } = await supabase
        .from('mikrotik_users')
        .update({ 
          status: 'enabled',
          last_synced_at: new Date().toISOString()
        })
        .eq('customer_id', userId);

      if (error) throw error;

      await this.logActivity('mikrotik_user_enabled', { customerId: userId });

      return {
        success: true,
        router: this.routerName,
        status: "enabled",
        message: `Simulation: User ${userId} enabled`
      };
    } catch (error) {
      return {
        success: false,
        router: this.routerName,
        status: "error",
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async disableUser(userId: string): Promise<MikrotikResponse> {
    await this.simulateDelay(150);

    try {
      const { error } = await supabase
        .from('mikrotik_users')
        .update({ 
          status: 'disabled',
          last_synced_at: new Date().toISOString()
        })
        .eq('customer_id', userId);

      if (error) throw error;

      await this.logActivity('mikrotik_user_disabled', { customerId: userId });

      return {
        success: true,
        router: this.routerName,
        status: "disabled",
        message: `Simulation: User ${userId} disabled`
      };
    } catch (error) {
      return {
        success: false,
        router: this.routerName,
        status: "error",
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async removeUser(userId: string): Promise<MikrotikResponse> {
    await this.simulateDelay(200);

    try {
      const { error } = await supabase
        .from('mikrotik_users')
        .delete()
        .eq('customer_id', userId);

      if (error) throw error;

      await this.logActivity('mikrotik_user_removed', { customerId: userId });

      return {
        success: true,
        router: this.routerName,
        status: "removed",
        message: `Simulation: User ${userId} removed`
      };
    } catch (error) {
      return {
        success: false,
        router: this.routerName,
        status: "error",
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getUserStatus(userId: string): Promise<MikrotikResponse> {
    await this.simulateDelay(100);

    try {
      const { data, error } = await supabase
        .from('mikrotik_users')
        .select('*')
        .eq('customer_id', userId)
        .maybeSingle();

      if (error) throw error;

      return {
        success: true,
        router: this.routerName,
        status: data?.status || "not_found",
        message: data ? `User status: ${data.status}` : "User not found",
        data
      };
    } catch (error) {
      return {
        success: false,
        router: this.routerName,
        status: "error",
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async syncUsers(): Promise<MikrotikResponse> {
    await this.simulateDelay(500);

    try {
      // In dummy mode, we just update last_synced_at for all users on this router
      const { data, error } = await supabase
        .from('mikrotik_users')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('router_id', this.routerId)
        .select();

      if (error) throw error;

      await this.logActivity('mikrotik_sync_completed', { 
        routerId: this.routerId, 
        userCount: data?.length || 0 
      });

      return {
        success: true,
        router: this.routerName,
        status: "synced",
        message: `Simulation: Synced ${data?.length || 0} users`,
        data: { count: data?.length || 0 }
      };
    } catch (error) {
      return {
        success: false,
        router: this.routerName,
        status: "error",
        message: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async logActivity(action: string, details: Record<string, unknown>): Promise<void> {
    try {
      await supabase.from('activity_logs').insert({
        action,
        entity_type: 'mikrotik',
        details: { ...details, mode: 'dummy', router: this.routerName }
      });
    } catch {
      console.warn('Failed to log activity');
    }
  }
}
