/**
 * API Client for EasyLink ISP Billing System
 * 
 * This replaces the Supabase client for cPanel deployment
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://isp.easylinkbd.com/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/auth' && window.location.pathname !== '/customer-login') {
        window.location.href = '/auth';
      }
    }
    
    // Extract error message
    const message = (error.response?.data as { error?: string; message?: string })?.error 
      || (error.response?.data as { message?: string })?.message
      || error.message 
      || 'An unexpected error occurred';
    
    return Promise.reject(new Error(message));
  }
);

// Auth helpers
export const authService = {
  // Admin/Staff login
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('auth_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors during logout
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  // Get current user
  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data.user;
  },

  // Refresh token
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');
    
    const { data } = await api.post('/auth/refresh', { refreshToken });
    localStorage.setItem('auth_token', data.accessToken);
    return data.accessToken;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
    return data;
  },

  // Request password reset
  requestPasswordReset: async (email: string) => {
    const { data } = await api.post('/auth/reset-password-request', { email });
    return data;
  },
};

// Customer auth helpers
export const customerAuthService = {
  login: async (userId: string, password: string) => {
    const { data } = await api.post('/customer-auth/login', { userId, password });
    localStorage.setItem('customer_token', data.token);
    localStorage.setItem('customer', JSON.stringify(data.customer));
    return data;
  },

  logout: () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer');
  },

  getMe: async () => {
    const { data } = await api.get('/customer-auth/me');
    return data.customer;
  },

  getBilling: async () => {
    const { data } = await api.get('/customer-auth/billing');
    return data.billingRecords;
  },

  getPayments: async () => {
    const { data } = await api.get('/customer-auth/payments');
    return data.payments;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const { data } = await api.post('/customer-auth/change-password', { currentPassword, newPassword });
    return data;
  },

  forgotPassword: async (userId: string, phone: string) => {
    const { data } = await api.post('/customer-auth/forgot-password', { userId, phone });
    return data;
  },
};

// Generic CRUD helpers
export const createCrudService = <T>(endpoint: string) => ({
  getAll: async (params?: Record<string, any>) => {
    const { data } = await api.get(endpoint, { params });
    return data;
  },

  getOne: async (id: string) => {
    const { data } = await api.get(`${endpoint}/${id}`);
    return data;
  },

  create: async (payload: Partial<T>) => {
    const { data } = await api.post(endpoint, payload);
    return data;
  },

  update: async (id: string, payload: Partial<T>) => {
    const { data } = await api.put(`${endpoint}/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await api.delete(`${endpoint}/${id}`);
    return data;
  },
});

// Specific services
export const customersService = {
  ...createCrudService('/customers'),
  renew: async (id: string, months: number = 1) => {
    const { data } = await api.post(`/customers/${id}/renew`, { months });
    return data;
  },
};

export const packagesService = createCrudService('/packages');
export const paymentsService = createCrudService('/payments');
export const areasService = createCrudService('/areas');
export const routersService = createCrudService('/routers');
export const usersService = createCrudService('/users');

// Billing service
export const billingService = {
  getRecords: async (params?: Record<string, any>) => {
    const { data } = await api.get('/billing/records', { params });
    return data;
  },

  getCustomerBilling: async (customerId: string) => {
    const { data } = await api.get(`/billing/customer/${customerId}`);
    return data;
  },

  getSummary: async (month?: number, year?: number) => {
    const { data } = await api.get('/billing/summary', { params: { month, year } });
    return data;
  },
};

// Reminders service
export const remindersService = {
  getDueReminders: async () => {
    const { data } = await api.get('/reminders/due');
    return data;
  },

  send: async (customerId: string, channel: string, reminderType: string, message?: string) => {
    const { data } = await api.post('/reminders/send', { 
      customer_id: customerId, 
      channel, 
      reminder_type: reminderType,
      message,
    });
    return data;
  },

  sendBulk: async (customerIds: string[], channel: string, reminderType: string) => {
    const { data } = await api.post('/reminders/send-bulk', { 
      customer_ids: customerIds, 
      channel, 
      reminder_type: reminderType,
    });
    return data;
  },

  getLogs: async (params?: Record<string, any>) => {
    const { data } = await api.get('/reminders/logs', { params });
    return data;
  },
};

// Settings service
export const settingsService = {
  getPublic: async () => {
    const { data } = await api.get('/settings/public');
    return data.settings;
  },

  getAll: async () => {
    const { data } = await api.get('/settings');
    return data.settings;
  },

  update: async (key: string, value: any) => {
    const { data } = await api.put(`/settings/${key}`, { value });
    return data;
  },

  updateMultiple: async (settings: Record<string, any>) => {
    const { data } = await api.put('/settings', settings);
    return data;
  },

  getPermissions: async () => {
    const { data } = await api.get('/settings/permissions/all');
    return data;
  },

  updatePermission: async (id: string, allowed: boolean) => {
    const { data } = await api.put(`/settings/permissions/${id}`, { allowed });
    return data;
  },
};

// Reports service
export const reportsService = {
  getDashboard: async () => {
    const { data } = await api.get('/reports/dashboard');
    return data;
  },

  getRevenue: async (params?: Record<string, any>) => {
    const { data } = await api.get('/reports/revenue', { params });
    return data;
  },

  getCustomerStats: async () => {
    const { data } = await api.get('/reports/customers');
    return data;
  },

  getOutstanding: async () => {
    const { data } = await api.get('/reports/outstanding');
    return data;
  },

  getExpiry: async (days: number = 7) => {
    const { data } = await api.get('/reports/expiry', { params: { days } });
    return data;
  },
};

// Activity logs service
export const activityService = {
  getLogs: async (params?: Record<string, any>) => {
    const { data } = await api.get('/activity', { params });
    return data;
  },

  getActions: async () => {
    const { data } = await api.get('/activity/actions');
    return data.actions;
  },

  getEntityTypes: async () => {
    const { data } = await api.get('/activity/entity-types');
    return data.entityTypes;
  },
};

export default api;
