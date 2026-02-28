import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Plus, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface CustomerTicketSubmitProps {
  customerId: string;
  customerName: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  category: string;
  created_at: string;
}

const CATEGORIES = [
  { value: "connection_issue", label: "Connection Issue" },
  { value: "billing_dispute", label: "Billing Dispute" },
  { value: "slow_speed", label: "Slow Speed" },
  { value: "disconnection", label: "Disconnection" },
  { value: "package_change", label: "Package Change" },
  { value: "other", label: "Other" },
];

export default function CustomerTicketSubmit({ customerId, customerName }: CustomerTicketSubmitProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "other",
  });

  useState(() => {
    fetchTickets();
  });

  async function fetchTickets() {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, category, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const ticketNumber = `TKT-${String(Date.now()).slice(-5)}`;
      const { error } = await supabase.from("support_tickets").insert([{
        ticket_number: ticketNumber,
        customer_id: customerId,
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category as any,
        priority: "medium" as any,
        sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }]);

      if (error) throw error;

      toast({ title: "Ticket Submitted", description: `Ticket ${ticketNumber} created successfully` });
      setForm({ subject: "", description: "", category: "other" });
      setShowForm(false);
      fetchTickets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit ticket", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-[hsl(var(--status-expiring)/0.15)] text-[hsl(var(--status-expiring))]",
      in_progress: "bg-primary/15 text-primary",
      resolved: "bg-[hsl(var(--status-active)/0.15)] text-[hsl(var(--status-active))]",
      closed: "bg-muted text-muted-foreground",
      waiting_on_customer: "bg-[hsl(var(--status-suspended)/0.15)] text-[hsl(var(--status-suspended))]",
    };
    return <Badge className={styles[status] || ""}>{status.replace(/_/g, " ")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Support Tickets
            </CardTitle>
            <CardDescription>Submit and track your support requests</CardDescription>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 border rounded-lg bg-muted/30">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  maxLength={200}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Please describe your issue in detail..."
                  rows={4}
                  maxLength={2000}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Ticket
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tickets yet. Submit one if you need help.
            </p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.ticket_number} • {format(new Date(ticket.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  {getStatusBadge(ticket.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
