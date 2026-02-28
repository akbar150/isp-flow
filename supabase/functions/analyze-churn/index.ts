import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch customer data with related info
    const { data: customers, error: custError } = await supabase
      .from("customers")
      .select(`
        id, user_id, full_name, phone, status, total_due, expiry_date, 
        billing_start_date, auto_renew, connection_type, billing_cycle,
        created_at, updated_at,
        packages:package_id(name, monthly_price, speed_mbps)
      `)
      .in("status", ["active", "expired", "suspended"])
      .limit(200);

    if (custError) throw custError;
    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ predictions: [], summary: "No customers to analyze." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent payments (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: payments } = await supabase
      .from("payments")
      .select("customer_id, amount, payment_date")
      .gte("payment_date", ninetyDaysAgo.toISOString().split("T")[0])
      .order("payment_date", { ascending: false });

    // Fetch recent tickets
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("customer_id, status, priority, created_at")
      .gte("created_at", ninetyDaysAgo.toISOString());

    // Build customer profiles for AI analysis
    const paymentsByCustomer = new Map<string, any[]>();
    (payments || []).forEach(p => {
      const arr = paymentsByCustomer.get(p.customer_id) || [];
      arr.push(p);
      paymentsByCustomer.set(p.customer_id, arr);
    });

    const ticketsByCustomer = new Map<string, any[]>();
    (tickets || []).forEach(t => {
      const arr = ticketsByCustomer.get(t.customer_id) || [];
      arr.push(t);
      ticketsByCustomer.set(t.customer_id, arr);
    });

    const today = new Date();
    const customerProfiles = customers.map(c => {
      const custPayments = paymentsByCustomer.get(c.id) || [];
      const custTickets = ticketsByCustomer.get(c.id) || [];
      const expiryDate = new Date(c.expiry_date);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceJoined = Math.floor((today.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: c.id,
        user_id: c.user_id,
        name: c.full_name,
        status: c.status,
        total_due: c.total_due,
        days_until_expiry: daysUntilExpiry,
        days_since_joined: daysSinceJoined,
        auto_renew: c.auto_renew,
        package: c.packages?.name || "None",
        monthly_price: c.packages?.monthly_price || 0,
        payments_last_90_days: custPayments.length,
        total_paid_90_days: custPayments.reduce((s: number, p: any) => s + Number(p.amount), 0),
        tickets_last_90_days: custTickets.length,
        high_priority_tickets: custTickets.filter((t: any) => t.priority === "urgent" || t.priority === "high").length,
        unresolved_tickets: custTickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length,
      };
    });

    // Call AI for analysis using tool calling for structured output
    const prompt = `Analyze these ISP customer profiles and predict churn risk. For each customer, assess the likelihood of churning based on:
- Payment behavior (late/missed payments, outstanding dues)
- Account status (expired, suspended)  
- Days until expiry (negative = already expired)
- Support ticket frequency and severity
- Customer tenure (newer customers churn more)
- Auto-renew status

Customer data:
${JSON.stringify(customerProfiles, null, 1)}

Analyze ALL customers and return predictions for those with Medium or High risk only.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an ISP business analyst specializing in customer retention and churn prediction. Analyze customer data and predict churn risk accurately."
          },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_churn_predictions",
              description: "Report churn risk predictions for ISP customers",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Brief overall summary of churn analysis (2-3 sentences)"
                  },
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        customer_id: { type: "string", description: "The customer UUID" },
                        user_id: { type: "string", description: "Customer user ID like ISP00001" },
                        name: { type: "string" },
                        risk_level: { type: "string", enum: ["high", "medium"] },
                        risk_score: { type: "number", description: "0-100 score" },
                        reasons: {
                          type: "array",
                          items: { type: "string" },
                          description: "Key reasons for churn risk"
                        },
                        recommended_actions: {
                          type: "array",
                          items: { type: "string" },
                          description: "Suggested retention actions"
                        }
                      },
                      required: ["customer_id", "user_id", "name", "risk_level", "risk_score", "reasons", "recommended_actions"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["summary", "predictions"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "report_churn_predictions" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ predictions: [], summary: "AI could not generate predictions." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Sort by risk score descending
    result.predictions.sort((a: any, b: any) => b.risk_score - a.risk_score);

    return new Response(JSON.stringify({
      predictions: result.predictions,
      summary: result.summary,
      total_analyzed: customers.length,
      analyzed_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("analyze-churn error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
