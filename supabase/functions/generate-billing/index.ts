import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  expiry_date: string;
  status: string;
  total_due: number;
  package_id: string | null;
}

interface Package {
  id: string;
  monthly_price: number;
  validity_days: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`Running billing generation for date: ${todayStr}`);

    // Get all customers whose expiry date is today or has passed
    const { data: customers, error: customersError } = await supabase
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
      errors: [] as string[],
    };

    for (const customer of customers || []) {
      try {
        const expiryDate = new Date(customer.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);
        
        // Skip if expiry date is in the future
        if (expiryDate > today) {
          continue;
        }

        const pkg = customer.packages as Package | null;
        if (!pkg) {
          console.log(`Customer ${customer.user_id} has no package assigned`);
          continue;
        }

        // Calculate how many days overdue
        const daysOverdue = Math.floor((today.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Only add to due if it's the exact expiry day (billing cycle completion)
        // This prevents adding dues multiple times for the same period
        if (daysOverdue === 0) {
          // Update status based on payment history
          let newStatus = 'expired';
          
          // Add monthly price to total due
          const newTotalDue = customer.total_due + pkg.monthly_price;
          
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              total_due: newTotalDue,
              status: newStatus,
            })
            .eq('id', customer.id);

          if (updateError) {
            throw new Error(`Failed to update customer ${customer.user_id}: ${updateError.message}`);
          }

          console.log(`Generated bill for ${customer.user_id}: ৳${pkg.monthly_price} added, total due: ৳${newTotalDue}`);
          results.billsGenerated++;
        } else if (daysOverdue > 0) {
          // Just update status for overdue customers
          const { error: statusError } = await supabase
            .from('customers')
            .update({ status: 'expired' })
            .eq('id', customer.id);

          if (statusError) {
            console.error(`Failed to update status for ${customer.user_id}: ${statusError.message}`);
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
        message: `Processed ${results.processed} customers, generated ${results.billsGenerated} bills`,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
