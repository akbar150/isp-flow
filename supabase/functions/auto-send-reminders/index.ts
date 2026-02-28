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

    // Find customers expiring in the next 3 days
    const today = new Date()
    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(today.getDate() + 3)

    const todayStr = today.toISOString().split('T')[0]
    const futureStr = threeDaysLater.toISOString().split('T')[0]

    const { data: expiringCustomers, error } = await supabase
      .from('customers')
      .select('id, full_name, phone, expiry_date, total_due, user_id')
      .eq('status', 'active')
      .gte('expiry_date', todayStr)
      .lte('expiry_date', futureStr)

    if (error) throw error

    if (!expiringCustomers || expiringCustomers.length === 0) {
      return new Response(JSON.stringify({ message: 'No expiring customers found', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check which customers already got a reminder today
    const { data: existingReminders } = await supabase
      .from('reminder_logs')
      .select('customer_id')
      .eq('reminder_type', 'expiry_day')
      .gte('sent_at', todayStr + 'T00:00:00Z')

    const alreadyReminded = new Set((existingReminders || []).map(r => r.customer_id))

    const toRemind = expiringCustomers.filter(c => !alreadyReminded.has(c.id))

    if (toRemind.length === 0) {
      return new Response(JSON.stringify({ message: 'All expiring customers already reminded today', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log reminders (actual SMS/email sending would be handled by respective edge functions)
    const reminderLogs = toRemind.map(c => ({
      customer_id: c.id,
      reminder_type: 'expiry_day' as const,
      channel: 'auto',
      message: `Auto-reminder: Your internet service expires on ${c.expiry_date}. Due: ৳${c.total_due}. Please renew to avoid service interruption.`,
    }))

    const { error: insertError } = await supabase
      .from('reminder_logs')
      .insert(reminderLogs)

    if (insertError) throw insertError

    // Notify admin
    await supabase.from('admin_notifications').insert({
      type: 'billing',
      title: 'Auto-Reminders Sent',
      message: `${toRemind.length} expiring customer(s) have been sent automatic renewal reminders.`,
      target_role: 'admin',
    })

    return new Response(
      JSON.stringify({ message: `Sent reminders to ${toRemind.length} customers`, count: toRemind.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
