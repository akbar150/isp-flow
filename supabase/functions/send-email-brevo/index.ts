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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    
    if (!resendApiKey && !brevoApiKey) {
      throw new Error("No email API key configured (RESEND_API_KEY or BREVO_API_KEY)");
    }

    const { to, subject, htmlContent, textContent, senderName, senderEmail }: EmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject || !htmlContent) {
      throw new Error("Missing required fields: to, subject, htmlContent");
    }

    console.log(`Sending email to: ${to}, subject: ${subject}`);

    // Use Resend API (preferred)
    if (resendApiKey) {
      // IMPORTANT: You must verify a domain in Resend to send to any email address
      // The "from" address must use a verified domain
      // Free tier can only send to the account owner's email
      const fromAddress = senderEmail 
        ? `${senderName || "ISP Billing"} <${senderEmail}>` 
        : `${senderName || "ISP Billing System"} <onboarding@resend.dev>`;
      
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject: subject,
          html: htmlContent,
          text: textContent || undefined,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json();
        console.error("Resend API error:", errorData);
        
        // Check if it's a domain verification error
        if (errorData.message?.includes("verify a domain") || errorData.message?.includes("testing emails")) {
          // Try Brevo as fallback if available
          if (brevoApiKey) {
            console.log("Resend requires domain verification, falling back to Brevo...");
            return await sendViaBravo(brevoApiKey, to, subject, htmlContent, textContent, senderName, senderEmail);
          }
          
          throw new Error(
            "Email sending requires domain verification. " +
            "Please verify a domain at resend.com/domains, then update your 'From' email address in Settings → Email Templates. " +
            "Until then, emails can only be sent to the account owner's address."
          );
        }
        
        throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
      }

      const data = await resendResponse.json();
      console.log("Email sent successfully via Resend:", data);

      return new Response(JSON.stringify({ success: true, messageId: data?.id, provider: "resend" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Use Brevo API
    return await sendViaBravo(brevoApiKey!, to, subject, htmlContent, textContent, senderName, senderEmail);
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

async function sendViaBravo(
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
  console.log("Email sent successfully via Brevo:", result);

  return new Response(JSON.stringify({ success: true, messageId: result.messageId, provider: "brevo" }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
