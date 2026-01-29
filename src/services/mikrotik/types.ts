// Mikrotik Service Types - Adapter Pattern for Dummy/Real Router Support

export interface MikrotikUser {
  userId: string;
  username: string;
  password: string;
  profile: string;
  status: 'enabled' | 'disabled';
  routerId: string;
}

export interface MikrotikResponse {
  success: boolean;
  router: string;
  status: string;
  message: string;
  data?: unknown;
}

export interface RouterConfig {
  id: string;
  name: string;
  ipAddress?: string;
  port?: number;
  username?: string;
  password?: string;
  mode: 'dummy' | 'real';
}

export interface IMikrotikService {
  connect(): Promise<MikrotikResponse>;
  disconnect(): Promise<MikrotikResponse>;
  createUser(user: Omit<MikrotikUser, 'status'>): Promise<MikrotikResponse>;
  enableUser(userId: string): Promise<MikrotikResponse>;
  disableUser(userId: string): Promise<MikrotikResponse>;
  removeUser(userId: string): Promise<MikrotikResponse>;
  getUserStatus(userId: string): Promise<MikrotikResponse>;
  syncUsers(): Promise<MikrotikResponse>;
}
