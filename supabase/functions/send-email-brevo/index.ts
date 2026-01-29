import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderName?: string;
  senderEmail?: string;
}

interface SmtpSettings {
  smtp_server: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
}

async function getSmtpSettings(): Promise<SmtpSettings | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log("No Supabase credentials for fetching SMTP settings");
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch SMTP settings from system_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["smtp_server", "smtp_port", "smtp_username", "smtp_password_encrypted"]);

    if (settingsError || !settingsData) {
      console.log("Could not fetch SMTP settings:", settingsError?.message);
      return null;
    }

    const settings: Record<string, string> = {};
    for (const row of settingsData) {
      const val = row.value;
      settings[row.key] = typeof val === "string" ? val.replace(/^"|"$/g, "") : String(val);
    }

    // Check if we have SMTP settings configured
    if (!settings.smtp_server || !settings.smtp_password_encrypted) {
      console.log("SMTP settings not fully configured");
      return null;
    }

    // Decrypt the password
    const { data: decryptedPassword, error: decryptError } = await supabase
      .rpc("decrypt_smtp_password", { encrypted_password: settings.smtp_password_encrypted });

    if (decryptError || !decryptedPassword) {
      console.error("Failed to decrypt SMTP password:", decryptError?.message);
      return null;
    }

    return {
      smtp_server: settings.smtp_server,
      smtp_port: settings.smtp_port || "587",
      smtp_username: settings.smtp_username || "",
      smtp_password: decryptedPassword,
    };
  } catch (error) {
    console.error("Error getting SMTP settings:", error);
    return null;
  }
}

async function sendViaBrevoSmtpApi(
  smtpSettings: SmtpSettings,
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  senderName?: string,
  senderEmail?: string
): Promise<Response> {
  // Use the SMTP key as the API key for Brevo's transactional API
  // This works because Brevo SMTP keys can also be used for the HTTP API
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "api-key": smtpSettings.smtp_password, // SMTP key works as API key
    },
    body: JSON.stringify({
      sender: {
        name: senderName || "ISP Billing System",
        email: senderEmail || smtpSettings.smtp_username || "noreply@easylinkbd.com",
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent || undefined,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Brevo SMTP API error:", errorData);
    throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log("Email sent successfully via Brevo SMTP API:", result);

  return new Response(JSON.stringify({ success: true, messageId: result.messageId, provider: "brevo-smtp" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function sendViaBrevoApiKey(
  apiKey: string, 
  to: string, 
  subject: string, 
  htmlContent: string, 
  textContent?: string, 
  senderName?: string, 
  senderEmail?: string
): Promise<Response> {
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

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Brevo API error:", errorData);
    throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log("Email sent successfully via Brevo API:", result);

  return new Response(JSON.stringify({ success: true, messageId: result.messageId, provider: "brevo" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  senderName?: string,
  senderEmail?: string
): Promise<Response> {
  const fromAddress = senderEmail 
    ? `${senderName || "ISP Billing"} <${senderEmail}>` 
    : `${senderName || "ISP Billing System"} <onboarding@resend.dev>`;
  
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

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Resend API error:", errorData);
    throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  console.log("Email sent successfully via Resend:", data);

  return new Response(JSON.stringify({ success: true, messageId: data?.id, provider: "resend" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, htmlContent, textContent, senderName, senderEmail }: EmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject || !htmlContent) {
      throw new Error("Missing required fields: to, subject, htmlContent");
    }

    console.log(`Sending email to: ${to}, subject: ${subject}`);

    // Try methods in order of preference:
    // 1. User-configured SMTP settings (Brevo SMTP)
    // 2. BREVO_SMTP_KEY secret
    // 3. BREVO_API_KEY secret
    // 4. RESEND_API_KEY secret

    // 1. Try user-configured SMTP settings first
    const smtpSettings = await getSmtpSettings();
    if (smtpSettings) {
      try {
        console.log("Attempting to send via user-configured SMTP settings...");
        return await sendViaBrevoSmtpApi(smtpSettings, to, subject, htmlContent, textContent, senderName, senderEmail);
      } catch (smtpError) {
        console.error("SMTP settings failed:", smtpError);
        // Fall through to try other methods
      }
    }

    // 2. Try BREVO_SMTP_KEY
    const brevoSmtpKey = Deno.env.get("BREVO_SMTP_KEY");
    if (brevoSmtpKey) {
      try {
        console.log("Attempting to send via BREVO_SMTP_KEY...");
        return await sendViaBrevoApiKey(brevoSmtpKey, to, subject, htmlContent, textContent, senderName, senderEmail);
      } catch (smtpKeyError) {
        console.error("BREVO_SMTP_KEY failed:", smtpKeyError);
        // Fall through
      }
    }

    // 3. Try BREVO_API_KEY
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      try {
        console.log("Attempting to send via BREVO_API_KEY...");
        return await sendViaBrevoApiKey(brevoApiKey, to, subject, htmlContent, textContent, senderName, senderEmail);
      } catch (apiKeyError) {
        console.error("BREVO_API_KEY failed:", apiKeyError);
        // Fall through
      }
    }

    // 4. Try RESEND_API_KEY
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        console.log("Attempting to send via RESEND_API_KEY...");
        return await sendViaResend(resendApiKey, to, subject, htmlContent, textContent, senderName, senderEmail);
      } catch (resendError) {
        console.error("RESEND_API_KEY failed:", resendError);
        throw resendError; // This is the last option, so throw
      }
    }

    throw new Error(
      "No email sending method configured. Please configure SMTP settings in Settings > Email, " +
      "or set BREVO_API_KEY or RESEND_API_KEY in environment secrets."
    );
  } catch (error: unknown) {
    console.error("Error in send-email-brevo function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
