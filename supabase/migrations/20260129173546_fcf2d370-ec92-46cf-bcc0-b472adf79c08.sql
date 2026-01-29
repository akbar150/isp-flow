-- Fix hash_password function to include extensions schema for pgcrypto functions
CREATE OR REPLACE FUNCTION public.hash_password(raw_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN crypt(raw_password, gen_salt('bf', 10));
END;
$$;

-- Fix verify_password function to include extensions schema for pgcrypto functions
CREATE OR REPLACE FUNCTION public.verify_password(raw_password text, hashed_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN hashed_password = crypt(raw_password, hashed_password);
END;
$$;