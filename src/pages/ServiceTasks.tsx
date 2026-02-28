import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Wrench, MapPin, Calendar, User, Eye, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface ServiceTask {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  task_type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  notes: string | null;
  photos: string[];
  customer_signature: string | null;
  created_at: string;
  customers: { full_name: string; user_id: string; phone: string; address: string; latitude: number | null; longitude: number | null } | null;
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
}

interface Customer {
  id: string;
  full_name: string;
  user_id: string;
  phone: string;
  address: string;
}

export default function ServiceTasks() {
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTask, setViewTask] = useState<ServiceTask | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    assigned_to: "",
    task_type: "repair" as string,
    priority: "medium" as string,
    title: "",
    description: "",
    scheduled_date: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, employeesRes, customersRes] = await Promise.all([
        supabase
          .from("service_tasks")
          .select("*, customers!service_tasks_customer_id_fkey(full_name, user_id, phone, address, latitude, longitude)")
          .order("created_at", { ascending: false }),
        supabase.from("employees").select("id, full_name, user_id").eq("status", "active"),
        supabase.from("customers_safe").select("id, full_name, user_id, phone, address"),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      setTasks((tasksRes.data as unknown as ServiceTask[]) || []);
      setEmployees(employeesRes.data || []);
      setCustomers((customersRes.data as unknown as Customer[]) || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.customer_id || !formData.title) {
      toast({ title: "Error", description: "Customer and title are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const employee = employees.find(e => e.id === formData.assigned_to);
      
      const insertData: Record<string, unknown> = {
        customer_id: formData.customer_id,
        assigned_to: employee?.user_id || null,
        task_type: formData.task_type,
        priority: formData.priority,
        title: formData.title,
        description: formData.description || null,
        scheduled_date: formData.scheduled_date || null,
      };

      const { error } = await supabase.from("service_tasks").insert(insertData as any);

      if (error) throw error;
      toast({ title: "Service task created" });
      setCreateOpen(false);
      setFormData({ customer_id: "", assigned_to: "", task_type: "repair", priority: "medium", title: "", description: "", scheduled_date: "" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const priorityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-blue-100 text-blue-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-muted text-muted-foreground",
  };

  const filtered = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customers?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading service tasks...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Service Tasks</h1>
          <p className="page-description">Manage field service and technician assignments</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <div className="form-section overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th className="hidden md:table-cell">Customer</th>
              <th className="hidden sm:table-cell">Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th className="hidden lg:table-cell">Scheduled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No tasks found</td></tr>
            ) : (
              filtered.map((task) => (
                <tr key={task.id}>
                  <td>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{task.customers?.full_name}</p>
                  </td>
                  <td className="hidden md:table-cell">
                    <p className="text-sm">{task.customers?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{task.customers?.user_id}</p>
                  </td>
                  <td className="hidden sm:table-cell">
                    <Badge variant="outline">{task.task_type}</Badge>
                  </td>
                  <td><Badge className={priorityColors[task.priority]}>{task.priority}</Badge></td>
                  <td><Badge className={statusColors[task.status]}>{task.status.replace("_", " ")}</Badge></td>
                  <td className="hidden lg:table-cell text-sm">
                    {task.scheduled_date ? format(new Date(task.scheduled_date), "dd MMM yyyy") : "-"}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setViewTask(task)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Service Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select value={formData.customer_id} onValueChange={(v) => setFormData({...formData, customer_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.user_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., Router installation" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formData.task_type} onValueChange={(v) => setFormData({...formData, task_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="installation">Installation</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({...formData, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={formData.assigned_to} onValueChange={(v) => setFormData({...formData, assigned_to: v})}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input type="date" value={formData.scheduled_date} onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wrench className="h-4 w-4 mr-2" />}
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewTask} onOpenChange={() => setViewTask(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Task Details</DialogTitle></DialogHeader>
          {viewTask && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColors[viewTask.status]}>{viewTask.status.replace("_", " ")}</Badge>
                <Badge className={priorityColors[viewTask.priority]}>{viewTask.priority}</Badge>
                <Badge variant="outline">{viewTask.task_type}</Badge>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{viewTask.title}</h3>
                {viewTask.description && <p className="text-sm text-muted-foreground mt-1">{viewTask.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{viewTask.customers?.full_name}</p>
                    <p className="text-muted-foreground">{viewTask.customers?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p>{viewTask.customers?.address}</p>
                </div>
                {viewTask.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p>{format(new Date(viewTask.scheduled_date), "dd MMM yyyy")}</p>
                  </div>
                )}
                {viewTask.completed_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p>Completed {format(new Date(viewTask.completed_at), "dd MMM yyyy HH:mm")}</p>
                  </div>
                )}
              </div>
              {viewTask.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{viewTask.notes}</p>
                </div>
              )}
              {viewTask.gps_lat && viewTask.gps_lng && (
                <div>
                  <Label className="text-muted-foreground">Completion Location</Label>
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => window.open(`https://www.google.com/maps?q=${viewTask.gps_lat},${viewTask.gps_lng}`, "_blank")}>
                    <MapPin className="h-3 w-3 mr-1" />
                    View on Map ({viewTask.gps_lat?.toFixed(4)}, {viewTask.gps_lng?.toFixed(4)})
                  </Button>
                </div>
              )}
              {viewTask.photos && viewTask.photos.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Photos</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {viewTask.photos.map((photo, i) => (
                      <img key={i} src={photo} alt={`Task photo ${i+1}`} className="rounded-lg border object-cover aspect-square cursor-pointer" onClick={() => window.open(photo, "_blank")} />
                    ))}
                  </div>
                </div>
              )}
              {viewTask.customer_signature && (
                <div>
                  <Label className="text-muted-foreground">Customer Signature</Label>
                  <div className="border rounded-lg p-2 bg-background mt-1 inline-block">
                    <img src={viewTask.customer_signature} alt="Signature" className="max-h-20" />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
