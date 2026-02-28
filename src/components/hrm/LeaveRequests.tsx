import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, Clock } from "lucide-react";
import { format } from "date-fns";

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  employees?: { full_name: string; employee_code: string } | null;
  leave_types?: { name: string } | null;
}

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  is_paid: boolean;
  is_active: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface LeaveRequestsProps {
  canManage: boolean;
}

export function LeaveRequests({ canManage }: LeaveRequestsProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    reason: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reqRes, typesRes, empRes] = await Promise.all([
        supabase
          .from("leave_requests")
          .select("*, employees!leave_requests_employee_id_fkey(full_name, employee_code), leave_types!leave_requests_leave_type_id_fkey(name)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("leave_types").select("*").eq("is_active", true).order("name"),
        supabase.from("employees").select("id, full_name, employee_code").eq("status", "active").order("full_name"),
      ]);

      if (reqRes.error) throw reqRes.error;
      setRequests((reqRes.data as unknown as LeaveRequest[]) || []);
      setLeaveTypes(typesRes.data || []);
      setEmployees(empRes.data || []);
    } catch (error) {
      console.error("Error fetching leave data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.employee_id || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    if (formData.end_date < formData.start_date) {
      toast({ title: "Error", description: "End date must be after start date", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("leave_requests").insert({
        employee_id: formData.employee_id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || null,
      });

      if (error) throw error;
      toast({ title: "Leave request created" });
      setDialogOpen(false);
      setFormData({
        employee_id: "",
        leave_type_id: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleStatusUpdate = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status, approved_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast({ title: `Leave request ${status}` });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">Loading leave requests...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">{requests.length} leave request(s)</h3>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Request
          </Button>
        )}
      </div>

      <div className="form-section overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  No leave requests yet
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <p className="font-medium">{req.employees?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{req.employees?.employee_code}</p>
                  </td>
                  <td>{req.leave_types?.name}</td>
                  <td className="text-sm">{format(new Date(req.start_date), "dd MMM yyyy")}</td>
                  <td className="text-sm">{format(new Date(req.end_date), "dd MMM yyyy")}</td>
                  <td className="text-sm max-w-[200px] truncate">{req.reason || "-"}</td>
                  <td>
                    <Badge className={statusColors[req.status]}>
                      {req.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {req.status}
                    </Badge>
                  </td>
                  {canManage && (
                    <td>
                      {req.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleStatusUpdate(req.id, "approved")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleStatusUpdate(req.id, "rejected")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Leave Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select value={formData.employee_id} onValueChange={(v) => setFormData({ ...formData, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type *</Label>
              <Select value={formData.leave_type_id} onValueChange={(v) => setFormData({ ...formData, leave_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name} ({lt.days_per_year} days/year, {lt.is_paid ? "Paid" : "Unpaid"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Optional reason for leave..." />
            </div>
            <Button onClick={handleCreate} className="w-full">Submit Leave Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
