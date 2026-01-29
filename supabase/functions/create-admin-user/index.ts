import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - production domains
const allowedOrigins = [
  "https://easylinkbd.lovable.app",
  "https://id-preview--f3ea74ef-bbb2-4d36-9390-fa74e8d6e7df.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = allowedOrigins.some(allowed => 
    origin === allowed || origin.endsWith(".lovable.app")
  );
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "staff";
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Client with user's auth for permission check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the requesting user is an admin
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      throw new Error("Unauthorized: Could not verify user");
    }

    // Check if requesting user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Unauthorized: Only admins can create users");
    }

    // Parse request body
    const { email, password, full_name, role }: CreateUserRequest = await req.json();

    // Validate inputs
    if (!email || !password || !full_name || !role) {
      throw new Error("Missing required fields: email, password, full_name, role");
    }

    if (!["admin", "staff"].includes(role)) {
      throw new Error("Invalid role. Must be 'admin' or 'staff'");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    console.log(`Creating user: ${email} with role: ${role}`);

    // Create the user using admin client
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { full_name },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log(`User created with ID: ${newUser.user.id}`);

    // Create profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        full_name,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't fail completely, user was created
    }

    // Assign role to the new user
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role,
      });

    if (roleInsertError) {
      console.error("Error assigning role:", roleInsertError);
      throw new Error(`Failed to assign role: ${roleInsertError.message}`);
    }

    console.log(`Role ${role} assigned to user ${newUser.user.id}`);

    // Log the activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: requestingUser.id,
      action: "create_admin_user",
      entity_type: "user",
      entity_id: newUser.user.id,
      details: { email, role, full_name },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          role,
          full_name,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in create-admin-user:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
