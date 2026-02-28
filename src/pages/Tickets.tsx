import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, MessageSquare, Clock, CheckCircle, AlertTriangle,
  User, Loader2, Send, Filter
} from "lucide-react";
import { format } from "date-fns";

type TicketCategory = 'connection_issue' | 'billing_dispute' | 'slow_speed' | 'disconnection' | 'new_connection' | 'package_change' | 'other';
type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  sla_deadline: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer_id: string;
  customers_safe: {
    full_name: string | null;
    user_id: string | null;
    phone: string | null;
  } | null;
}

interface TicketComment {
  id: string;
  comment: string;
  is_internal: boolean;
  created_by: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "connection_issue", label: "Connection Issue" },
  { value: "billing_dispute", label: "Billing Dispute" },
  { value: "slow_speed", label: "Slow Speed" },
  { value: "disconnection", label: "Disconnection" },
  { value: "new_connection", label: "New Connection" },
  { value: "package_change", label: "Package Change" },
  { value: "other", label: "Other" },
];

const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Medium", color: "bg-[hsl(var(--status-expiring)/0.15)] text-[hsl(var(--status-expiring))]" },
  { value: "high", label: "High", color: "bg-[hsl(var(--status-expired)/0.15)] text-[hsl(var(--status-expired))]" },
  { value: "critical", label: "Critical", color: "bg-destructive text-destructive-foreground" },
];

const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting on Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const SLA_HOURS: Record<TicketPriority, number> = {
  critical: 4,
  high: 12,
  medium: 24,
  low: 48,
};

export default function Tickets() {
  const { user, isSuperAdmin } = useAuth();
  const { canCreate, canUpdate } = usePermissions();
  const canCreateTicket = isSuperAdmin || canCreate("tickets");
  const canEditTicket = isSuperAdmin || canUpdate("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; full_name: string | null; user_id: string | null }[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  // New ticket form
  const [newTicket, setNewTicket] = useState({
    customer_id: "",
    subject: "",
    description: "",
    category: "other" as TicketCategory,
    priority: "medium" as TicketPriority,
    assigned_to: "",
  });

  useEffect(() => {
    fetchTickets();
    fetchCustomers();
    fetchStaff();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchComments(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, customers_safe!support_tickets_customer_id_fkey(full_name, user_id, phone)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data || []) as unknown as Ticket[]);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers_safe")
      .select("id, full_name, user_id")
      .order("full_name");
    setCustomers(data || []);
  };

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name");
    setStaffMembers(data || []);
  };

  const fetchComments = async (ticketId: string) => {
    const { data } = await supabase
      .from("ticket_comments")
      .select("*, profiles:created_by(full_name)")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setComments((data || []) as unknown as TicketComment[]);
  };

  const handleCreateTicket = async () => {
    if (!newTicket.customer_id || !newTicket.subject || !newTicket.description) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const ticketNumber = `TKT-${String(Date.now()).slice(-5)}`;
      const slaHours = SLA_HOURS[newTicket.priority];
      const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from("support_tickets").insert({
        ticket_number: ticketNumber,
        customer_id: newTicket.customer_id,
        subject: newTicket.subject,
        description: newTicket.description,
        category: newTicket.category,
        priority: newTicket.priority,
        assigned_to: newTicket.assigned_to || null,
        sla_deadline: slaDeadline,
        created_by: user?.id || null,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Ticket created successfully" });
      setCreateOpen(false);
      setNewTicket({ customer_id: "", subject: "", description: "", category: "other", priority: "medium", assigned_to: "" });
      fetchTickets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTicket = async (ticketId: string, updates: Partial<{ status: TicketStatus; assigned_to: string; priority: TicketPriority }>) => {
    try {
      const finalUpdates: any = { ...updates };
      if (updates.status === "resolved") {
        finalUpdates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(finalUpdates)
        .eq("id", ticketId);

      if (error) throw error;

      toast({ title: "Updated", description: "Ticket updated successfully" });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, ...finalUpdates } : null);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: selectedTicket.id,
        comment: newComment.trim(),
        is_internal: isInternal,
        created_by: user?.id || null,
      });

      if (error) throw error;
      setNewComment("");
      setIsInternal(false);
      fetchComments(selectedTicket.id);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    const p = PRIORITIES.find(pr => pr.value === priority);
    return <Badge className={p?.color || ""}>{p?.label || priority}</Badge>;
  };

  const getStatusBadge = (status: TicketStatus) => {
    const styles: Record<TicketStatus, string> = {
      open: "bg-[hsl(var(--status-expiring)/0.15)] text-[hsl(var(--status-expiring))]",
      in_progress: "bg-primary/15 text-primary",
      waiting_on_customer: "bg-[hsl(var(--status-suspended)/0.15)] text-[hsl(var(--status-suspended))]",
      resolved: "bg-[hsl(var(--status-active)/0.15)] text-[hsl(var(--status-active))]",
      closed: "bg-muted text-muted-foreground",
    };
    const label = STATUSES.find(s => s.value === status)?.label || status;
    return <Badge className={styles[status]}>{label}</Badge>;
  };

  const isSlaBreached = (ticket: Ticket) => {
    if (ticket.status === "resolved" || ticket.status === "closed") return false;
    if (!ticket.sla_deadline) return false;
    return new Date() > new Date(ticket.sla_deadline);
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = !search ||
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.customers_safe?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.customers_safe?.user_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Stats
  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;
  const breachedCount = tickets.filter(isSlaBreached).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-description">Manage customer complaints and support requests</p>
        </div>
        {canCreateTicket && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Ticket</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Customer *</Label>
                  <Select value={newTicket.customer_id} onValueChange={v => setNewTicket({ ...newTicket, customer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.user_id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject *</Label>
                  <Input value={newTicket.subject} onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })} placeholder="Brief description" maxLength={200} />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea value={newTicket.description} onChange={e => setNewTicket({ ...newTicket, description: e.target.value })} placeholder="Detailed description of the issue" rows={3} maxLength={2000} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={newTicket.category} onValueChange={v => setNewTicket({ ...newTicket, category: v as TicketCategory })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={newTicket.priority} onValueChange={v => setNewTicket({ ...newTicket, priority: v as TicketPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Assign To</Label>
                  <Select value={newTicket.assigned_to} onValueChange={v => setNewTicket({ ...newTicket, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      {staffMembers.map(s => (
                        <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTicket} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Ticket
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="stat-card-label">Open</p>
          <p className="stat-card-value text-[hsl(var(--status-expiring))]">{openCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">In Progress</p>
          <p className="stat-card-value text-primary">{inProgressCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Resolved</p>
          <p className="stat-card-value text-[hsl(var(--status-active))]">{resolvedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">SLA Breached</p>
          <p className="stat-card-value text-[hsl(var(--status-expired))]">{breachedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Ticket List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="form-section text-center py-12">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`form-section cursor-pointer transition-all hover:shadow-md ${selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : ""} ${isSlaBreached(ticket) ? "border-l-4 border-l-destructive" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                      {isSlaBreached(ticket) && (
                        <Badge className="bg-destructive text-destructive-foreground">SLA Breached</Badge>
                      )}
                    </div>
                    <h3 className="font-medium truncate">{ticket.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ticket.customers_safe?.full_name} ({ticket.customers_safe?.user_id}) • {CATEGORIES.find(c => c.value === ticket.category)?.label}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>{format(new Date(ticket.created_at), "dd MMM yyyy")}</p>
                    <p>{format(new Date(ticket.created_at), "hh:mm a")}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedTicket ? (
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedTicket.ticket_number}</CardTitle>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <p className="font-medium mt-1">{selectedTicket.subject}</p>
                <p className="text-sm text-muted-foreground">{selectedTicket.customers_safe?.full_name}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>

                {/* Actions */}
                {canEditTicket && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={selectedTicket.status}
                      onValueChange={v => handleUpdateTicket(selectedTicket.id, { status: v as TicketStatus })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Assign To</Label>
                    <Select
                      value={selectedTicket.assigned_to || ""}
                      onValueChange={v => handleUpdateTicket(selectedTicket.id, { assigned_to: v } as any)}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        {staffMembers.map(s => (
                          <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={selectedTicket.priority}
                      onValueChange={v => handleUpdateTicket(selectedTicket.id, { priority: v as TicketPriority })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTicket.sla_deadline && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">SLA Deadline: </span>
                      <span className={isSlaBreached(selectedTicket) ? "text-destructive font-medium" : ""}>
                        {format(new Date(selectedTicket.sla_deadline), "dd MMM yyyy hh:mm a")}
                      </span>
                    </div>
                  )}
                  {selectedTicket.resolved_at && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Resolved: </span>
                      {format(new Date(selectedTicket.resolved_at), "dd MMM yyyy hh:mm a")}
                    </div>
                  )}
                </div>
                )}

                {/* Comments */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-3">Comments</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No comments yet</p>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className={`p-2 rounded-lg text-xs ${c.is_internal ? "bg-[hsl(var(--status-expiring)/0.1)] border border-[hsl(var(--status-expiring)/0.2)]" : "bg-muted/50"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{c.profiles?.full_name || "System"}</span>
                            <span className="text-muted-foreground">{format(new Date(c.created_at), "dd MMM hh:mm a")}</span>
                          </div>
                          {c.is_internal && <Badge className="bg-[hsl(var(--status-expiring)/0.15)] text-[hsl(var(--status-expiring))] text-[10px] mb-1">Internal Note</Badge>}
                          <p>{c.comment}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      rows={2}
                      className="text-xs"
                      maxLength={1000}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={e => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        Internal note
                      </label>
                      <Button size="sm" onClick={handleAddComment} disabled={submitting || !newComment.trim()}>
                        <Send className="h-3 w-3 mr-1" /> Send
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Select a ticket to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
