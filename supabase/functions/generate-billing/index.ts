import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  expiry_date: string;
  status: string;
  total_due: number;
  package_id: string | null;
  packages: {
    id: string;
    name: string;
    monthly_price: number;
    validity_days: number;
  } | null;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ============= AUTHENTICATION CHECK =============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Missing authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.log('Invalid token:', claimsError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // ============= AUTHORIZATION CHECK - Admin/Super Admin only =============
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !roleData) {
      console.log('User role not found:', roleError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - User role not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['admin', 'super_admin'].includes(roleData.role)) {
      console.log('User does not have admin privileges:', roleData.role);
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Billing generation triggered by admin user: ${userId}`);

    // ============= BILLING GENERATION LOGIC =============
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Running billing generation for date: ${todayStr}`);

    // Get all customers whose expiry date is today or has passed
    const { data: customers, error: customersError } = await supabaseAdmin
      .from('customers')
      .select('*, packages(*)')
      .lte('expiry_date', todayStr)
      .neq('status', 'suspended');

    if (customersError) {
      throw new Error(`Failed to fetch customers: ${customersError.message}`);
    }

    console.log(`Found ${customers?.length || 0} customers with expired/expiring billing dates`);

    const results = {
      processed: 0,
      billsGenerated: 0,
      billingRecordsCreated: 0,
      duesUpdated: 0,
      errors: [] as string[],
      triggered_by: userId,
    };

    for (const customer of (customers || []) as Customer[]) {
      try {
        const expiryDate = new Date(customer.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);
        
        // Skip if expiry date is in the future
        if (expiryDate > today) {
          continue;
        }

        const pkg = customer.packages;
        if (!pkg) {
          console.log(`Customer ${customer.user_id} has no package assigned`);
          continue;
        }

        // Calculate how many days overdue
        const daysOverdue = Math.floor((today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if a billing record already exists for this billing period (expiry_date)
        const { data: existingBill } = await supabaseAdmin
          .from('billing_records')
          .select('id')
          .eq('customer_id', customer.id)
          .eq('billing_date', customer.expiry_date)
          .single();

        // Only generate bill and update due if billing record doesn't exist yet
        if (!existingBill && daysOverdue >= 0) {
          // Create billing record
          const { error: billingError } = await supabaseAdmin
            .from('billing_records')
            .insert({
              customer_id: customer.id,
              billing_date: customer.expiry_date,
              amount: pkg.monthly_price,
              package_name: pkg.name,
              status: 'unpaid',
              amount_paid: 0,
              due_date: customer.expiry_date,
            });

          if (billingError) {
            console.error(`Failed to create billing record for ${customer.user_id}:`, billingError.message);
          } else {
            results.billingRecordsCreated++;
            console.log(`Created billing record for ${customer.user_id}: ৳${pkg.monthly_price}`);
          }

          // Always add monthly price to total_due when creating new billing record
          const newTotalDue = customer.total_due + pkg.monthly_price;
          
          const { error: updateError } = await supabaseAdmin
            .from('customers')
            .update({
              total_due: newTotalDue,
              status: 'expired',
            })
            .eq('id', customer.id);

          if (updateError) {
            throw new Error(`Failed to update customer ${customer.user_id}: ${updateError.message}`);
          }

          console.log(`Updated ${customer.user_id}: added ৳${pkg.monthly_price} to due, new total: ৳${newTotalDue}`);
          results.billsGenerated++;
          results.duesUpdated++;
        } else if (existingBill) {
          // Billing record exists - just ensure status is expired if overdue
          if (daysOverdue > 0 && customer.status !== 'expired') {
            await supabaseAdmin
              .from('customers')
              .update({ status: 'expired' })
              .eq('id', customer.id);
            console.log(`Updated status to expired for ${customer.user_id}`);
          }
        }

        results.processed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${customer.user_id}: ${errorMsg}`);
        console.error(`Error processing customer ${customer.user_id}:`, errorMsg);
      }
    }

    console.log('Billing generation completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} customers, generated ${results.billsGenerated} bills, created ${results.billingRecordsCreated} billing records, updated ${results.duesUpdated} customer dues`,
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-billing function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
