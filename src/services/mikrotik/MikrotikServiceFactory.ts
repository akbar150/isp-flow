import { DummyMikrotikAdapter } from "./DummyMikrotikAdapter";
import { RealMikrotikAdapter } from "./RealMikrotikAdapter";
import type { IMikrotikService, RouterConfig } from "./types";

/**
 * Factory for creating Mikrotik service instances
 * Supports switching between dummy and real adapters via admin settings
 */
export class MikrotikServiceFactory {
  static create(config: RouterConfig): IMikrotikService {
    if (config.mode === 'real') {
      return new RealMikrotikAdapter(config);
    }
    
    return new DummyMikrotikAdapter(config.id, config.name);
  }
}

export type { IMikrotikService, MikrotikResponse, MikrotikUser, RouterConfig } from "./types";
