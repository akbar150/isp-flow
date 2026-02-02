-- Fix security linter: ensure views run with invoker rights
ALTER VIEW public.customers_safe SET (security_invoker = true);
