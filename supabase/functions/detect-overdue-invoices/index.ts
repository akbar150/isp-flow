import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find all invoices that are past due_date and still in 'sent' or 'draft' status
    const today = new Date().toISOString().split('T')[0]

    const { data: overdueInvoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_id, total, amount_paid, due_date, status')
      .in('status', ['sent', 'draft'])
      .lt('due_date', today)

    if (error) throw error

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(JSON.stringify({ message: 'No overdue invoices found', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update all overdue invoices to 'overdue' status
    const ids = overdueInvoices.map(inv => inv.id)

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .in('id', ids)

    if (updateError) throw updateError

    // Create a notification for admins
    await supabase.from('admin_notifications').insert({
      type: 'billing',
      title: 'Overdue Invoices Detected',
      message: `${ids.length} invoice(s) have been automatically marked as overdue.`,
      target_role: 'admin',
    })

    return new Response(
      JSON.stringify({ message: `Marked ${ids.length} invoices as overdue`, count: ids.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
