-- Add function to encrypt SMTP password
CREATE OR REPLACE FUNCTION public.encrypt_smtp_password(plain_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN encode(encrypt(plain_password::bytea, 'smtp_secret_key_v1'::bytea, 'aes'), 'base64');
END;
$$;

-- Add function to decrypt SMTP password (only callable by edge functions via service key)
CREATE OR REPLACE FUNCTION public.decrypt_smtp_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN convert_from(decrypt(decode(encrypted_password, 'base64'), 'smtp_secret_key_v1'::bytea, 'aes'), 'utf8');
END;
$$;

-- Update the get_public_system_settings function to include SMTP settings (but NOT the password)
CREATE OR REPLACE FUNCTION public.get_public_system_settings()
 RETURNS TABLE(key text, value jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.key, s.value
  FROM public.system_settings s
  WHERE s.key IN (
    'isp_name',
    'whatsapp_template',
    'email_from_name',
    'email_from_address',
    'email_subject_reminder',
    'email_template_reminder',
    'sms_template',
    'sms_template_en',
    'smtp_server',
    'smtp_port',
    'smtp_username'
  )
  ORDER BY s.key;
$function$;