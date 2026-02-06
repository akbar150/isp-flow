import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RouteMobile API Configuration - URL is now fetched from system_settings

// Error code mapping from RouteMobile API documentation
const ERROR_CODES: Record<string, string> = {
  "1701": "Success - Message submitted successfully",
  "1702": "Invalid URL - Missing required parameter",
  "1703": "Invalid username or password",
  "1704": "Invalid message type",
  "1705": "Invalid message content",
  "1706": "Invalid destination number",
  "1707": "Invalid sender ID",
  "1708": "Invalid DLR parameter",
  "1709": "User validation failed",
  "1710": "Internal error",
  "1025": "Insufficient credit",
  "1715": "Response timeout",
  "1032": "DND reject - Number on Do Not Disturb list",
  "1028": "Spam message detected",
};

interface SmsRequest {
  phone: string;
  message: string;
  type?: "unicode" | "text"; // unicode for Bangla, text for English
}

serve(async (req) => {
  console.log("[send-sms-routemobile] Request received at", new Date().toISOString());

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[send-sms-routemobile] No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log("[send-sms-routemobile] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-sms-routemobile] Authenticated user:", user.id);

    // Parse request body
    const body: SmsRequest = await req.json();
    const { phone, message, type = "unicode" } = body;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-sms-routemobile] Phone:", phone, "Message length:", message.length, "Type:", type);

    // Fetch RouteMobile settings from system_settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "sms_enabled",
        "routemobile_api_url",
        "routemobile_username",
        "routemobile_password",
        "routemobile_sender_id",
        "routemobile_route",
      ]);

    if (settingsError) {
      console.error("[send-sms-routemobile] Failed to fetch settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch SMS settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse settings
    const settingsMap: Record<string, string> = {};
    settings?.forEach((s) => {
      const val = typeof s.value === "string" 
        ? s.value.replace(/^"|"$/g, "") 
        : JSON.stringify(s.value).replace(/^"|"$/g, "");
      settingsMap[s.key] = val;
    });

    console.log("[send-sms-routemobile] SMS enabled:", settingsMap.sms_enabled);

    // Check if SMS is enabled
    if (settingsMap.sms_enabled !== "true") {
      return new Response(
        JSON.stringify({ success: false, error: "SMS notifications are disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required settings
    const apiUrl = settingsMap.routemobile_api_url || "";
    const username = settingsMap.routemobile_username;
    const password = settingsMap.routemobile_password;
    const senderId = settingsMap.routemobile_sender_id;
    const route = settingsMap.routemobile_route || "1";

    if (!apiUrl) {
      console.error("[send-sms-routemobile] Missing API URL");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "RouteMobile API URL not configured. Please set the server address in SMS settings (e.g., http://203.92.42.14:8080/bulksms/bulksms)." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!username || !password || !senderId) {
      console.error("[send-sms-routemobile] Missing RouteMobile credentials");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "RouteMobile credentials not configured. Please set username, password, and sender ID in settings." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-sms-routemobile] API URL:", apiUrl, "Username:", username, "Sender ID:", senderId, "Route:", route);

    // Format phone number for Bangladesh
    let formattedPhone = phone.replace(/[^0-9+]/g, "");
    
    // Ensure it starts with country code (88 for Bangladesh)
    if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.slice(1); // Remove leading +
    }
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "88" + formattedPhone.slice(1); // Replace leading 0 with 88
    }
    if (!formattedPhone.startsWith("88")) {
      formattedPhone = "88" + formattedPhone; // Add country code if missing
    }

    console.log("[send-sms-routemobile] Formatted phone:", formattedPhone);

    // Determine message type
    // Type 0 = Plain text (GSM 3.38)
    // Type 2 = Unicode (for Bangla/non-ASCII characters)
    const messageType = type === "unicode" ? "2" : "0";

    // Build the API URL with query parameters
    const params = new URLSearchParams({
      username: username,
      password: password,
      type: messageType,
      dlr: "1", // Request delivery report
      destination: formattedPhone,
      source: senderId,
      message: message,
    });

    const fullUrl = `${apiUrl}?${params.toString()}`;
    
    console.log("[send-sms-routemobile] Sending SMS via RouteMobile...");
    console.log("[send-sms-routemobile] API URL (without password):", 
      fullUrl.replace(password, "****"));

    // Send the SMS request
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Accept": "text/plain",
      },
    });

    const responseText = await response.text();
    console.log("[send-sms-routemobile] API Response:", responseText);

    // Parse the response
    // Format: <Error_Code>|<destination>|<message_id>
    const parts = responseText.trim().split("|");
    const errorCode = parts[0];
    const destination = parts[1] || formattedPhone;
    const messageId = parts[2] || "";

    if (errorCode === "1701") {
      console.log("[send-sms-routemobile] SMS sent successfully! Message ID:", messageId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "SMS sent successfully",
          messageId: messageId,
          destination: destination
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMessage = ERROR_CODES[errorCode] || `Unknown error (code: ${errorCode})`;
      console.error("[send-sms-routemobile] SMS failed:", errorCode, errorMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          errorCode: errorCode,
          rawResponse: responseText
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("[send-sms-routemobile] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to send SMS" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
