-- Create enum types for status and roles
CREATE TYPE public.customer_status AS ENUM ('active', 'expiring', 'expired', 'suspended');
CREATE TYPE public.payment_method AS ENUM ('bkash', 'cash', 'bank_transfer', 'due');
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.mikrotik_user_status AS ENUM ('enabled', 'disabled');
CREATE TYPE public.router_mode AS ENUM ('dummy', 'real');
CREATE TYPE public.reminder_type AS ENUM ('3_days_before', '1_day_before', 'expiry_day', '3_days_overdue');

-- User roles table for admin/staff access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles table for user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Routers table (for multi-router support)
CREATE TABLE public.routers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ip_address TEXT,
    port INTEGER DEFAULT 8728,
    username TEXT,
    password_encrypted TEXT,
    mode router_mode NOT NULL DEFAULT 'dummy',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.routers ENABLE ROW LEVEL SECURITY;

-- Areas/Zones table
CREATE TABLE public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- Internet packages table
CREATE TABLE public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    speed_mbps INTEGER NOT NULL,
    monthly_price DECIMAL(10,2) NOT NULL,
    validity_days INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alt_phone TEXT,
    address TEXT NOT NULL,
    area_id UUID REFERENCES public.areas(id),
    router_id UUID REFERENCES public.routers(id),
    package_id UUID REFERENCES public.packages(id),
    password_hash TEXT NOT NULL,
    billing_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    status customer_status NOT NULL DEFAULT 'active',
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Mikrotik users (simulation/sync table)
CREATE TABLE public.mikrotik_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    profile TEXT,
    status mikrotik_user_status NOT NULL DEFAULT 'enabled',
    router_id UUID REFERENCES public.routers(id),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mikrotik_users ENABLE ROW LEVEL SECURITY;

-- Payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    method payment_method NOT NULL,
    transaction_id TEXT,
    notes TEXT,
    remaining_due DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Reminder logs table
CREATE TABLE public.reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    reminder_type reminder_type NOT NULL,
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sent_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- System settings table
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Activity logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Insert default system settings
INSERT INTO public.system_settings (key, value) VALUES
('isp_name', '"Smart ISP"'),
('router_mode', '"dummy"'),
('whatsapp_template', '"Dear {CustomerName},\nUser ID: {user_id}\n\nYour internet package {PackageName}, will expire on {ExpiryDate}.\n\nPlease pay ৳{Amount} to avoid disconnection.\n\n– {ISP Name}"');

-- Insert a default router (dummy)
INSERT INTO public.routers (name, mode, is_active) VALUES
('Default Dummy Router', 'dummy', true);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for authenticated users on main tables
CREATE POLICY "Authenticated users can view routers" ON public.routers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage routers" ON public.routers
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view areas" ON public.areas
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage areas" ON public.areas
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view packages" ON public.packages
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage packages" ON public.packages
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view customers" ON public.customers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage customers" ON public.customers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view mikrotik_users" ON public.mikrotik_users
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage mikrotik_users" ON public.mikrotik_users
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view payments" ON public.payments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create payments" ON public.payments
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can manage payments" ON public.payments
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view reminder_logs" ON public.reminder_logs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create reminder_logs" ON public.reminder_logs
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view system_settings" ON public.system_settings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage system_settings" ON public.system_settings
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view activity_logs" ON public.activity_logs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create activity_logs" ON public.activity_logs
FOR INSERT TO authenticated WITH CHECK (true);

-- Function to auto-generate customer user_id
CREATE OR REPLACE FUNCTION public.generate_customer_user_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO counter FROM public.customers;
  new_id := 'ISP' || LPAD(counter::TEXT, 5, '0');
  RETURN new_id;
END;
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routers_updated_at BEFORE UPDATE ON public.routers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mikrotik_users_updated_at BEFORE UPDATE ON public.mikrotik_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();