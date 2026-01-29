import type { IMikrotikService, MikrotikResponse, MikrotikUser, RouterConfig } from "./types";

/**
 * Real Mikrotik Adapter (Placeholder)
 * 
 * This adapter is designed for RouterOS v6 API connection.
 * Implementation requires:
 * 1. Backend Edge Function to handle Mikrotik API calls (security)
 * 2. Mikrotik RouterOS API library integration
 * 3. Proper error handling for network issues
 * 
 * The actual Mikrotik API communication should happen through
 * a secure backend function to protect router credentials.
 */
export class RealMikrotikAdapter implements IMikrotikService {
  private config: RouterConfig;
  private isConnected: boolean = false;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  async connect(): Promise<MikrotikResponse> {
    // TODO: Implement real Mikrotik connection via Edge Function
    // Example: await supabase.functions.invoke('mikrotik-connect', { body: { routerId: this.config.id } })
    
    console.warn('Real Mikrotik connection not implemented. Switch to dummy mode.');
    
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API connection is not yet implemented. Please use dummy mode."
    };
  }

  async disconnect(): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }

  async createUser(_user: Omit<MikrotikUser, 'status'>): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }

  async enableUser(_userId: string): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }

  async disableUser(_userId: string): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }

  async removeUser(_userId: string): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }

  async getUserStatus(_userId: string): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }

  async syncUsers(): Promise<MikrotikResponse> {
    return {
      success: false,
      router: this.config.name,
      status: "not_implemented",
      message: "Real Mikrotik API not implemented"
    };
  }
}
