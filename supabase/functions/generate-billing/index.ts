import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  packages: {
    id: string;
    name: string;
    monthly_price: number;
    validity_days: number;
  } | null;
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
      billingRecordsCreated: 0,
      errors: [] as string[],
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
        
        // Check if a billing record already exists for this period
        const { data: existingBill } = await supabase
          .from('billing_records')
          .select('id')
          .eq('customer_id', customer.id)
          .eq('billing_date', customer.expiry_date)
          .single();

        // Only generate bill if it doesn't exist yet
        if (!existingBill && daysOverdue >= 0) {
          // Create billing record
          const { error: billingError } = await supabase
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
          }

          // Add monthly price to total due (only if it's within reasonable overdue period)
          if (daysOverdue === 0) {
            const newTotalDue = customer.total_due + pkg.monthly_price;
            
            const { error: updateError } = await supabase
              .from('customers')
              .update({
                total_due: newTotalDue,
                status: 'expired',
              })
              .eq('id', customer.id);

            if (updateError) {
              throw new Error(`Failed to update customer ${customer.user_id}: ${updateError.message}`);
            }

            console.log(`Generated bill for ${customer.user_id}: ৳${pkg.monthly_price} added, total due: ৳${newTotalDue}`);
            results.billsGenerated++;
          }
        }
        
        // Update status for overdue customers
        if (daysOverdue > 0 && customer.status !== 'expired') {
          await supabase
            .from('customers')
            .update({ status: 'expired' })
            .eq('id', customer.id);
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
        message: `Processed ${results.processed} customers, generated ${results.billsGenerated} bills, created ${results.billingRecordsCreated} billing records`,
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
