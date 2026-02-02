import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Version for deployment verification
const VERSION = "v1.0.2";

// Standard CORS headers that allow all origins (required for Lovable preview)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper to verify JWT and get user claims
async function verifyAuth(req: Request): Promise<{ userId: string; error?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: "", error: "Missing or invalid Authorization header" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  
  if (error || !data?.claims) {
    return { userId: "", error: "Invalid or expired token" };
  }

  return { userId: data.claims.sub as string };
}

interface EmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderName?: string;
  senderEmail?: string;
}

function decodeSettingValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";

  if (typeof raw === "string") {
    let s = raw;

    // Unwrap legacy JSON.stringify / double-stringify values
    for (let i = 0; i < 2; i++) {
      const t = s.trim();
      if (t.startsWith('"') && t.endsWith('"')) {
        try {
          const parsed = JSON.parse(t);
          if (typeof parsed === "string") {
            s = parsed;
            continue;
          }
        } catch {
          // ignore
        }
      }
      break;
    }

    // Convert literal "\\n" into real newlines
    return s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  }

  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

interface EmailSettings {
  api_key: string;
  sender_email: string;
  sender_name: string;
}

async function getEmailSettings(): Promise<EmailSettings | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log("No Supabase credentials for fetching email settings");
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch settings from system_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["smtp_username", "smtp_password_encrypted", "email_from_name", "email_from_address"]);

    if (settingsError || !settingsData) {
      console.log("Could not fetch email settings:", settingsError?.message);
      return null;
    }

    const settings: Record<string, string> = {};
    for (const row of settingsData) {
      settings[row.key] = decodeSettingValue(row.value);
    }

    // Check if we have the encrypted API key
    if (!settings.smtp_password_encrypted) {
      console.log("No API key configured in settings");
      return null;
    }

    // Decrypt the API key
    const { data: decryptedKey, error: decryptError } = await supabase
      .rpc("decrypt_smtp_password", { encrypted_password: settings.smtp_password_encrypted });

    if (decryptError || !decryptedKey) {
      console.error("Failed to decrypt API key:", decryptError?.message);
      return null;
    }

    console.log(`[${VERSION}] Decrypted API key prefix:`, decryptedKey.substring(0, 10) + "...");

    return {
      api_key: decryptedKey,
      sender_email: settings.email_from_address || settings.smtp_username || "",
      sender_name: settings.email_from_name || "ISP Billing System",
    };
  } catch (error) {
    console.error(`[${VERSION}] Error getting email settings:`, error);
    return null;
  }
}

async function sendViaBrevo(
  apiKey: string,
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  senderName?: string,
  senderEmail?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[${VERSION}] Sending email via Brevo to: ${to}`);
  console.log(`[${VERSION}] API key type: ${apiKey.startsWith("xkeysib-") ? "API Key" : apiKey.startsWith("xsmtpsib-") ? "SMTP Key (may not work!)" : "Unknown"}`);
  
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: senderName || "ISP Billing System",
        email: senderEmail || "noreply@easylinkbd.com",
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent || undefined,
    }),
  });

  const responseText = await response.text();
  console.log(`[${VERSION}] Brevo API response status: ${response.status}`);
  console.log(`[${VERSION}] Brevo API response: ${responseText}`);

  if (!response.ok) {
    let errorMessage = `Brevo API error (${response.status})`;
    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      errorMessage = responseText || errorMessage;
    }
    return { success: false, error: errorMessage };
  }

  try {
    const result = JSON.parse(responseText);
    return { success: true, messageId: result.messageId };
  } catch {
    return { success: true };
  }
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  senderName?: string,
  senderEmail?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fromAddress = senderEmail 
    ? `${senderName || "ISP Billing"} <${senderEmail}>` 
    : `${senderName || "ISP Billing System"} <onboarding@resend.dev>`;
  
  console.log(`[${VERSION}] Sending email via Resend to: ${to}`);
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject: subject,
      html: htmlContent,
      text: textContent || undefined,
    }),
  });

  const responseText = await response.text();
  console.log(`[${VERSION}] Resend API response status: ${response.status}`);

  if (!response.ok) {
    let errorMessage = `Resend API error (${response.status})`;
    try {
      const errorData = JSON.parse(responseText);
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      errorMessage = responseText || errorMessage;
    }
    return { success: false, error: errorMessage };
  }

  try {
    const result = JSON.parse(responseText);
    return { success: true, messageId: result.id };
  } catch {
    return { success: true };
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`[${VERSION}] Request received at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication - only authenticated users can send emails
    const { userId, error: authError } = await verifyAuth(req);
    if (authError || !userId) {
      console.error(`[${VERSION}] Authentication failed:`, authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: " + (authError || "Invalid token"), _version: VERSION }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${VERSION}] Authenticated user: ${userId}`);

    const { to, subject, htmlContent, textContent, senderName, senderEmail }: EmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject || !htmlContent) {
      throw new Error("Missing required fields: to, subject, htmlContent");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error("Invalid email format");
    }

    console.log(`[${VERSION}] === Email Request ===`);
    console.log(`[${VERSION}] To: ${to}`);
    console.log(`[${VERSION}] Subject: ${subject}`);

    // Try methods in order of preference:
    // 1. User-configured API key from database
    // 2. BREVO_API_KEY secret
    // 3. RESEND_API_KEY secret

    const errors: string[] = [];

    // 1. Try user-configured settings first
    const emailSettings = await getEmailSettings();
    if (emailSettings) {
      console.log(`[${VERSION}] Attempting to send via user-configured API key...`);
      const result = await sendViaBrevo(
        emailSettings.api_key,
        to,
        subject,
        htmlContent,
        textContent,
        senderName || emailSettings.sender_name,
        senderEmail || emailSettings.sender_email
      );
      
      if (result.success) {
        console.log(`[${VERSION}] Email sent successfully via user settings`);
        return new Response(JSON.stringify({ 
          success: true, 
          messageId: result.messageId, 
          provider: "brevo-configured",
          _version: VERSION
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } else {
        console.error(`[${VERSION}] User-configured API key failed:`, result.error);
        errors.push(`Configured API: ${result.error}`);
      }
    }

    // 2. Try BREVO_API_KEY environment secret
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      console.log(`[${VERSION}] Attempting to send via BREVO_API_KEY secret...`);
      const result = await sendViaBrevo(brevoApiKey, to, subject, htmlContent, textContent, senderName, senderEmail);
      
      if (result.success) {
        console.log(`[${VERSION}] Email sent successfully via BREVO_API_KEY`);
        return new Response(JSON.stringify({ 
          success: true, 
          messageId: result.messageId, 
          provider: "brevo",
          _version: VERSION
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } else {
        console.error(`[${VERSION}] BREVO_API_KEY failed:`, result.error);
        errors.push(`BREVO_API_KEY: ${result.error}`);
      }
    }

    // 3. Try RESEND_API_KEY environment secret
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      console.log(`[${VERSION}] Attempting to send via RESEND_API_KEY secret...`);
      const result = await sendViaResend(resendApiKey, to, subject, htmlContent, textContent, senderName, senderEmail);
      
      if (result.success) {
        console.log(`[${VERSION}] Email sent successfully via RESEND_API_KEY`);
        return new Response(JSON.stringify({ 
          success: true, 
          messageId: result.messageId, 
          provider: "resend",
          _version: VERSION
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } else {
        console.error(`[${VERSION}] RESEND_API_KEY failed:`, result.error);
        errors.push(`RESEND_API_KEY: ${result.error}`);
      }
    }

    // All methods failed or not configured
    if (errors.length > 0) {
      throw new Error(`All email providers failed:\n${errors.join("\n")}`);
    }

    throw new Error(
      "No email sending method configured. Please go to Settings > Email and enter a Brevo API Key " +
      "(starts with xkeysib-). Note: SMTP keys (xsmtpsib-) do not work with the HTTP API."
    );
  } catch (error: unknown) {
    console.error(`[${VERSION}] Error in send-email-brevo function:`, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
