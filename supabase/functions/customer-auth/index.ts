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

interface CustomerAuthRequest {
  action: "login" | "register" | "reset_password" | "update_profile";
  user_id?: string; // Customer user_id (e.g., ISP00001)
  password?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  new_password?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: CustomerAuthRequest = await req.json();
    const { action } = body;

    console.log(`Customer auth action: ${action}`);

    switch (action) {
      case "login": {
        const { user_id, password } = body;
        if (!user_id || !password) {
          throw new Error("Missing user_id or password");
        }

        // Find customer by user_id
        const { data: customer, error: customerError } = await supabaseAdmin
          .from("customers")
          .select("id, user_id, full_name, password_hash, phone, address, status, package_id, expiry_date, total_due")
          .eq("user_id", user_id.toUpperCase())
          .single();

        if (customerError || !customer) {
          throw new Error("Invalid user ID or password");
        }

        // Verify password using the database function
        const { data: isValid, error: verifyError } = await supabaseAdmin.rpc("verify_password", {
          raw_password: password,
          hashed_password: customer.password_hash,
        });

        if (verifyError || !isValid) {
          throw new Error("Invalid user ID or password");
        }

        // Generate a simple session token (in production, use proper JWT)
        const sessionToken = crypto.randomUUID();
        
        // Get package info
        let packageInfo = null;
        if (customer.package_id) {
          const { data: pkg } = await supabaseAdmin
            .from("packages")
            .select("name, speed_mbps, monthly_price")
            .eq("id", customer.package_id)
            .single();
          packageInfo = pkg;
        }

        return new Response(
          JSON.stringify({
            success: true,
            customer: {
              id: customer.id,
              user_id: customer.user_id,
              full_name: customer.full_name,
              phone: customer.phone,
              address: customer.address,
              status: customer.status,
              expiry_date: customer.expiry_date,
              total_due: customer.total_due,
              package: packageInfo,
            },
            session_token: sessionToken,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "register": {
        const { full_name, phone, password, address } = body;
        if (!full_name || !phone || !password) {
          throw new Error("Missing required fields: full_name, phone, password");
        }

        // Validate password (min 6 chars, alphanumeric only)
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        if (!/^[a-zA-Z0-9]+$/.test(password)) {
          throw new Error("Password can only contain letters and numbers");
        }

        // Check if phone already exists
        const { data: existing } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("phone", phone)
          .single();

        if (existing) {
          throw new Error("A customer with this phone number already exists");
        }

        // Generate user_id
        const { data: newUserId, error: idError } = await supabaseAdmin.rpc("generate_customer_user_id");
        if (idError) {
          throw new Error("Failed to generate user ID");
        }

        // Hash password
        const { data: hashedPassword, error: hashError } = await supabaseAdmin.rpc("hash_password", {
          raw_password: password,
        });
        if (hashError) {
          throw new Error("Failed to process password");
        }

        // Create customer (pending status until admin approves)
        const { data: newCustomer, error: createError } = await supabaseAdmin
          .from("customers")
          .insert({
            user_id: newUserId,
            full_name,
            phone,
            password_hash: hashedPassword,
            address: address || "To be updated",
            expiry_date: new Date().toISOString().split("T")[0], // Set to today, admin will set proper date
            status: "suspended", // Pending admin approval
          })
          .select("id, user_id, full_name")
          .single();

        if (createError) {
          console.error("Create error:", createError);
          throw new Error("Failed to create account. Please try again.");
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Account created successfully. Your User ID is: " + newUserId + ". Please wait for admin approval to activate your connection.",
            customer: {
              id: newCustomer.id,
              user_id: newCustomer.user_id,
              full_name: newCustomer.full_name,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "reset_password": {
        const { user_id, phone } = body;
        if (!user_id || !phone) {
          throw new Error("Please provide your User ID and registered phone number");
        }

        // Find customer
        const { data: customer, error: customerError } = await supabaseAdmin
          .from("customers")
          .select("id, user_id, phone, full_name")
          .eq("user_id", user_id.toUpperCase())
          .eq("phone", phone)
          .single();

        if (customerError || !customer) {
          // Don't reveal if user exists
          return new Response(
            JSON.stringify({
              success: true,
              message: "If your details match our records, you will receive a password reset notification.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Generate temporary password (secure random)
        const tempPassword = `Temp${crypto.randomUUID().substring(0, 8)}`;
        
        // Hash the temporary password
        const { data: hashedPassword, error: hashError } = await supabaseAdmin.rpc("hash_password", {
          raw_password: tempPassword,
        });

        if (hashError) {
          console.error("Failed to hash password:", hashError);
          throw new Error("Failed to process password reset");
        }

        // Update customer password
        const { error: updateError } = await supabaseAdmin
          .from("customers")
          .update({ password_hash: hashedPassword })
          .eq("id", customer.id);

        if (updateError) {
          console.error("Failed to update password:", updateError);
          throw new Error("Failed to reset password");
        }

        // Log password reset event (without the actual password)
        console.log(`Password reset completed for customer: ${customer.user_id}`);

        // TODO: In production, integrate SMS gateway to send temp password
        // Example: await sendSMS(customer.phone, `Your temporary password is: ${tempPassword}`);
        
        // For now, create an admin notification so staff can communicate the password
        await supabaseAdmin.from("admin_notifications").insert({
          type: "system",
          title: "Password Reset Request",
          message: `Customer ${customer.user_id} (${customer.full_name}) requested a password reset. Please contact them at ${customer.phone} to provide the new temporary password.`,
          entity_type: "customer",
          entity_id: customer.id,
        });

        // SECURITY: Do NOT return the temp_password in the response
        // The password should only be communicated via secure channel (SMS/admin contact)
        return new Response(
          JSON.stringify({
            success: true,
            message: "Password reset successful. Please contact your ISP administrator or check your registered phone for your new temporary password.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "update_profile": {
        const { user_id, password, phone, address, new_password } = body;
        if (!user_id || !password) {
          throw new Error("Authentication required");
        }

        // Verify current password first
        const { data: customer, error: customerError } = await supabaseAdmin
          .from("customers")
          .select("id, password_hash")
          .eq("user_id", user_id.toUpperCase())
          .single();

        if (customerError || !customer) {
          throw new Error("Invalid credentials");
        }

        const { data: isValid } = await supabaseAdmin.rpc("verify_password", {
          raw_password: password,
          hashed_password: customer.password_hash,
        });

        if (!isValid) {
          throw new Error("Invalid current password");
        }

        // Build update object
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (phone) updates.phone = phone;
        if (address) updates.address = address;

        if (new_password) {
          if (new_password.length < 6) {
            throw new Error("New password must be at least 6 characters");
          }
          if (!/^[a-zA-Z0-9]+$/.test(new_password)) {
            throw new Error("New password can only contain letters and numbers");
          }
          const { data: hashedPassword } = await supabaseAdmin.rpc("hash_password", {
            raw_password: new_password,
          });
          updates.password_hash = hashedPassword;
        }

        // Update customer
        const { error: updateError } = await supabaseAdmin
          .from("customers")
          .update(updates)
          .eq("id", customer.id);

        if (updateError) {
          throw new Error("Failed to update profile");
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Profile updated successfully",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in customer-auth:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 }
    );
  }
});
