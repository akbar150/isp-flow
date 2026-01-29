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

type AppRole = "super_admin" | "admin" | "staff";

interface ManageUserRequest {
  action: "create" | "update" | "delete" | "reset_password" | "list";
  user_id?: string;
  email?: string;
  password?: string;
  full_name?: string;
  role?: AppRole;
}

// Helper function to get ISP name from settings
async function getIspName(supabaseUrl: string, serviceKey: string): Promise<string> {
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "isp_name")
      .single();
    
    if (error || !data) {
      return "ISP Billing";
    }
    
    const value = (data as { value: unknown }).value;
    if (typeof value === "string") {
      return value.replace(/^"|"$/g, "");
    }
    return String(value);
  } catch {
    return "ISP Billing";
  }
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      throw new Error("Unauthorized: Could not verify user");
    }

    // Check requesting user's role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleError || !roleData) {
      throw new Error("Unauthorized: No role assigned");
    }

    const requestingRole = roleData.role as AppRole;
    const isSuperAdmin = requestingRole === "super_admin";
    const isAdmin = requestingRole === "admin" || isSuperAdmin;

    const body: ManageUserRequest = await req.json();
    const { action, user_id, email, password, full_name, role } = body;

    console.log(`Action: ${action}, By: ${requestingRole}, Target: ${user_id || email}`);

    switch (action) {
      case "list": {
        // List all users with their emails (only for admins)
        if (!isAdmin) {
          throw new Error("Unauthorized: Only admins can list users");
        }

        // Get all auth users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) {
          throw new Error(`Failed to list users: ${authError.message}`);
        }

        // Get all roles
        const { data: rolesData, error: rolesError } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role, created_at");

        if (rolesError) {
          throw new Error(`Failed to fetch roles: ${rolesError.message}`);
        }

        // Get all profiles
        const { data: profilesData, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name");

        if (profilesError) {
          throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
        }

        // Combine data - only include users with roles
        const users = rolesData.map((roleRecord) => {
          const authUser = authData.users.find(u => u.id === roleRecord.user_id);
          const profile = profilesData.find(p => p.user_id === roleRecord.user_id);
          
          return {
            id: roleRecord.user_id,
            email: authUser?.email || "(unknown)",
            full_name: profile?.full_name || null,
            role: roleRecord.role as AppRole,
            created_at: roleRecord.created_at,
          };
        });

        return new Response(
          JSON.stringify({ success: true, users }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "create": {
        if (!isAdmin) {
          throw new Error("Unauthorized: Only admins can create users");
        }

        if (!email || !password || !full_name || !role) {
          throw new Error("Missing required fields for user creation");
        }

        // Only super_admin can create admin or super_admin users
        if ((role === "admin" || role === "super_admin") && !isSuperAdmin) {
          throw new Error("Unauthorized: Only super admins can create admin users");
        }

        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }

        // Create the user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

        if (createError) {
          throw new Error(`Failed to create user: ${createError.message}`);
        }

        // Create profile
        await supabaseAdmin.from("profiles").insert({
          user_id: newUser.user.id,
          full_name,
        });

        // Assign role
        const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role,
        });

        if (roleInsertError) {
          throw new Error(`Failed to assign role: ${roleInsertError.message}`);
        }

        // Log activity
        await supabaseAdmin.from("activity_logs").insert({
          user_id: requestingUser.id,
          action: "create_user",
          entity_type: "user",
          entity_id: newUser.user.id,
          details: { email, role, full_name },
        });

        return new Response(
          JSON.stringify({
            success: true,
            user: { id: newUser.user.id, email, role, full_name },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "update": {
        if (!user_id) {
          throw new Error("Missing user_id for update");
        }

        // Get target user's role
        const { data: targetRoleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id)
          .single();

        const targetRole = targetRoleData?.role as AppRole | undefined;

        // Super admin can update anyone
        // Admin can update staff only
        // Users can update themselves
        const canUpdate = isSuperAdmin || 
          (isAdmin && targetRole === "staff") ||
          requestingUser.id === user_id;

        if (!canUpdate) {
          throw new Error("Unauthorized: Cannot update this user");
        }

        // Update auth user (email/password)
        const updateData: Record<string, unknown> = {};
        if (email) updateData.email = email;
        if (password) {
          if (password.length < 8) {
            throw new Error("Password must be at least 8 characters");
          }
          updateData.password = password;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            updateData
          );
          if (updateError) {
            throw new Error(`Failed to update user: ${updateError.message}`);
          }
        }

        // Update profile
        if (full_name) {
          // Check if profile exists
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("user_id", user_id)
            .single();

          if (existingProfile) {
            await supabaseAdmin
              .from("profiles")
              .update({ full_name, updated_at: new Date().toISOString() })
              .eq("user_id", user_id);
          } else {
            await supabaseAdmin
              .from("profiles")
              .insert({ user_id, full_name });
          }
        }

        // Update role (only super_admin can change roles)
        if (role && isSuperAdmin && user_id !== requestingUser.id) {
          await supabaseAdmin
            .from("user_roles")
            .update({ role })
            .eq("user_id", user_id);
        }

        // Log activity
        await supabaseAdmin.from("activity_logs").insert({
          user_id: requestingUser.id,
          action: "update_user",
          entity_type: "user",
          entity_id: user_id,
          details: { email, full_name, role_changed: !!role },
        });

        return new Response(
          JSON.stringify({ success: true, message: "User updated successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "delete": {
        if (!user_id) {
          throw new Error("Missing user_id for deletion");
        }

        if (user_id === requestingUser.id) {
          throw new Error("Cannot delete your own account");
        }

        // Get target user's role
        const { data: targetRoleData } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id)
          .single();

        const targetRole = targetRoleData?.role as AppRole | undefined;

        // Only super_admin can delete admins
        if ((targetRole === "admin" || targetRole === "super_admin") && !isSuperAdmin) {
          throw new Error("Unauthorized: Only super admins can delete admin users");
        }

        // Delete user role first
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

        // Delete profile
        await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

        // Delete auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (deleteError) {
          throw new Error(`Failed to delete user: ${deleteError.message}`);
        }

        // Log activity
        await supabaseAdmin.from("activity_logs").insert({
          user_id: requestingUser.id,
          action: "delete_user",
          entity_type: "user",
          entity_id: user_id,
          details: { target_role: targetRole },
        });

        return new Response(
          JSON.stringify({ success: true, message: "User deleted successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "reset_password": {
        if (!email) {
          throw new Error("Missing email for password reset");
        }

        // This just generates a reset link - any authenticated user can request for themselves
        // Super admin can request for anyone
        const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
        const targetUser = userData.users.find(u => u.email === email);

        if (!targetUser) {
          // Don't reveal if user exists
          return new Response(
            JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Check if requester can reset this user's password
        const canReset = isSuperAdmin || targetUser.id === requestingUser.id;
        if (!canReset) {
          throw new Error("Unauthorized: Cannot reset this user's password");
        }

        // Generate password reset link
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${req.headers.get("origin") || supabaseUrl}/auth?type=recovery`,
          },
        });

        if (linkError) {
          throw new Error(`Failed to generate reset link: ${linkError.message}`);
        }

        // Get dynamic ISP name
        const ispName = await getIspName(supabaseUrl, supabaseServiceKey);

        // Send email via Brevo or Resend
        const brevoApiKey = Deno.env.get("BREVO_API_KEY") || Deno.env.get("BREVO_SMTP_KEY");
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const resetUrl = linkData.properties.action_link;
        
        if (brevoApiKey) {
          // Use Brevo API
          const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json; charset=utf-8",
              "api-key": brevoApiKey,
            },
            body: JSON.stringify({
              sender: {
                name: ispName,
                email: "noreply@easylinkbd.com",
              },
              to: [{ email }],
              subject: `Reset your password - ${ispName}`,
              htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">${ispName}</h1>
                  </div>
                  <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Password Reset Request</h2>
                    <p style="color: #4b5563;">You requested to reset your password for ${ispName} Billing.</p>
                    <p style="margin: 24px 0;">
                      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0891b2;color:white;text-decoration:none;border-radius:6px;font-weight:500;">
                        Reset Password
                      </a>
                    </p>
                    <p style="color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
                    <p style="color: #9ca3af; font-size: 12px;">This link will expire in 1 hour.</p>
                  </div>
                  <div style="background: #1f2937; padding: 15px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} ${ispName}. All rights reserved.</p>
                  </div>
                </div>
              `,
            }),
          });

          if (!emailRes.ok) {
            console.error("Brevo error:", await emailRes.text());
          }
        } else if (resendApiKey) {
          // Fallback to Resend
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: `${ispName} <onboarding@resend.dev>`,
              to: [email],
              subject: `Reset your password - ${ispName}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1f2937;">Password Reset Request</h2>
                  <p style="color: #4b5563;">You requested to reset your password for ${ispName} Billing.</p>
                  <p style="margin: 24px 0;">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0891b2;color:white;text-decoration:none;border-radius:6px;font-weight:500;">
                      Reset Password
                    </a>
                  </p>
                  <p style="color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
                  <p style="color: #9ca3af; font-size: 12px;">This link will expire in 1 hour.</p>
                </div>
              `,
            }),
          });

          if (!emailRes.ok) {
            console.error("Resend error:", await emailRes.text());
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: "Password reset email sent" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Error in manage-user:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 }
    );
  }
});
