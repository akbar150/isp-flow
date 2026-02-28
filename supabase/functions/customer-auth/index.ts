import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
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
        const login_id = body.user_id; // supports user_id, email, or PPPoE username
        const { password } = body;
        if (!login_id || !password) {
          throw new Error("Missing login credentials");
        }

        let customer: any = null;
        let customerError: any = null;

        if (login_id.includes("@")) {
          // Email lookup
          const result = await supabaseAdmin
            .from("customers")
            .select("id, user_id, full_name, password_hash, phone, address, status, package_id, expiry_date, total_due")
            .eq("email", login_id.toLowerCase())
            .single();
          customer = result.data;
          customerError = result.error;
        } else if (login_id.toUpperCase().startsWith("ISP")) {
          // User ID lookup (existing behavior)
          const result = await supabaseAdmin
            .from("customers")
            .select("id, user_id, full_name, password_hash, phone, address, status, package_id, expiry_date, total_due")
            .eq("user_id", login_id.toUpperCase())
            .single();
          customer = result.data;
          customerError = result.error;
        } else {
          // PPPoE username lookup via mikrotik_users
          const { data: mikrotikUser, error: mkError } = await supabaseAdmin
            .from("mikrotik_users")
            .select("customer_id")
            .eq("username", login_id)
            .single();

          if (mkError || !mikrotikUser) {
            throw new Error("Invalid credentials");
          }

          const result = await supabaseAdmin
            .from("customers")
            .select("id, user_id, full_name, password_hash, phone, address, status, package_id, expiry_date, total_due")
            .eq("id", mikrotikUser.customer_id)
            .single();
          customer = result.data;
          customerError = result.error;
        }

        if (customerError || !customer) {
          throw new Error("Invalid credentials");
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

        // Validate full_name (2-100 characters, letters/spaces/dots/hyphens only)
        if (full_name.length < 2 || full_name.length > 100) {
          throw new Error("Name must be 2-100 characters");
        }
        // Allow Bengali/Unicode characters, spaces, dots, hyphens
        if (!/^[\p{L}\p{M}\s.\-']+$/u.test(full_name)) {
          throw new Error("Name contains invalid characters");
        }

        // Validate phone (Bangladesh format: 880XXXXXXXXX - 13 digits)
        let cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.startsWith("0") && cleanPhone.length === 11) cleanPhone = "88" + cleanPhone;
        if (cleanPhone.startsWith("1") && cleanPhone.length === 10) cleanPhone = "880" + cleanPhone;
        if (!/^880[13-9]\d{8}$/.test(cleanPhone)) {
          throw new Error("Invalid phone number format. Use: 8801XXXXXXXXX");
        }

        // Validate address length if provided
        if (address && address.length > 500) {
          throw new Error("Address is too long (max 500 characters)");
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
          .eq("phone", cleanPhone)
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
            phone: cleanPhone,
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
        const reset_login_id = body.user_id;
        const { phone } = body;
        if (!reset_login_id || !phone) {
          throw new Error("Please provide your User ID/PPPoE Username/Email and registered phone number");
        }

        // Find customer using multi-lookup
        let resetCustomer: any = null;
        let resetError: any = null;

        if (reset_login_id.includes("@")) {
          const result = await supabaseAdmin
            .from("customers")
            .select("id, user_id, phone, full_name")
            .eq("email", reset_login_id.toLowerCase())
            .eq("phone", phone)
            .single();
          resetCustomer = result.data;
          resetError = result.error;
        } else if (reset_login_id.toUpperCase().startsWith("ISP")) {
          const result = await supabaseAdmin
            .from("customers")
            .select("id, user_id, phone, full_name")
            .eq("user_id", reset_login_id.toUpperCase())
            .eq("phone", phone)
            .single();
          resetCustomer = result.data;
          resetError = result.error;
        } else {
          // PPPoE username lookup
          const { data: mkUser } = await supabaseAdmin
            .from("mikrotik_users")
            .select("customer_id")
            .eq("username", reset_login_id)
            .single();
          if (mkUser) {
            const result = await supabaseAdmin
              .from("customers")
              .select("id, user_id, phone, full_name")
              .eq("id", mkUser.customer_id)
              .eq("phone", phone)
              .single();
            resetCustomer = result.data;
            resetError = result.error;
          } else {
            resetError = true;
          }
        }

        const customer = resetCustomer;
        if (resetError || !customer) {
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
        const { user_id, password, phone, email, address, new_password } = body;
        if (!user_id || !password) {
          throw new Error("Authentication required");
        }

        // Validate phone if provided (880 format)
        let normalizedPhone: string | undefined;
        if (phone) {
          let cleanPh = phone.replace(/\D/g, "");
          if (cleanPh.startsWith("0") && cleanPh.length === 11) cleanPh = "88" + cleanPh;
          if (cleanPh.startsWith("1") && cleanPh.length === 10) cleanPh = "880" + cleanPh;
          if (!/^880[13-9]\d{8}$/.test(cleanPh)) {
            throw new Error("Invalid phone number format. Use: 8801XXXXXXXXX");
          }
          normalizedPhone = cleanPh;
        }

        // Validate email format if provided
        if (email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            throw new Error("Invalid email format");
          }
        }

        // Validate address length if provided
        if (address && address.length > 500) {
          throw new Error("Address is too long (max 500 characters)");
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

        if (normalizedPhone) updates.phone = normalizedPhone;
        if (email) updates.email = email;
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
