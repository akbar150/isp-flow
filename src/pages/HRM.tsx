import { useEffect, useState } from "react";
import { TablePagination } from "@/components/TablePagination";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  Plus, 
  Search, 
  Users,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  CalendarCheck
} from "lucide-react";
import { format } from "date-fns";

interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Designation {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  is_active: boolean;
  departments?: Department | null;
}

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  department_id: string | null;
  designation_id: string | null;
  joining_date: string;
  basic_salary: number;
  status: 'active' | 'on_leave' | 'terminated' | 'resigned';
  departments?: Department | null;
  designations?: Designation | null;
}

interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
  employees?: Employee | null;
}

interface Payroll {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  bonus: number;
  commission: number;
  net_salary: number;
  status: 'draft' | 'approved' | 'paid';
  paid_date: string | null;
  employees?: Employee | null;
}

const employeeStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  on_leave: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  resigned: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const attendanceStatusColors: Record<string, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  late: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  half_day: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  on_leave: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
};

export default function HRM() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [attPage, setAttPage] = useState(1);
  const [attTotal, setAttTotal] = useState(0);
  const [payPage, setPayPage] = useState(1);
  const [payTotal, setPayTotal] = useState(0);
  const PAGE_SIZE = 50;
  
  // Dialog states
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [desigDialogOpen, setDesigDialogOpen] = useState(false);
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  
  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });
  const [desigForm, setDesigForm] = useState({ name: "", department_id: "", description: "" });
  const [empForm, setEmpForm] = useState({
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    address: "",
    department_id: "",
    designation_id: "",
    joining_date: format(new Date(), "yyyy-MM-dd"),
    basic_salary: 0,
  });
  const [attendanceForm, setAttendanceForm] = useState({
    employee_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    status: "present" as Attendance["status"],
    check_in: "",
    check_out: "",
    notes: "",
  });
  const [payrollForm, setPayrollForm] = useState({
    employee_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    basic_salary: 0,
    allowances: 0,
    deductions: 0,
    bonus: 0,
    commission: 0,
  });

  const canManage = isSuperAdmin || canCreate("hrm");
  const canEdit = isSuperAdmin || canUpdate("hrm");
  const canRemove = isSuperAdmin || canDelete("hrm");

  useEffect(() => {
    fetchData();
  }, [attPage, payPage]);

  const fetchData = async () => {
    try {
      const attFrom = (attPage - 1) * PAGE_SIZE;
      const attTo = attFrom + PAGE_SIZE - 1;
      const payFrom = (payPage - 1) * PAGE_SIZE;
      const payTo = payFrom + PAGE_SIZE - 1;

      const [deptRes, desigRes, empRes, attRes, payRes] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("designations").select("*, departments(*)").order("name"),
        supabase.from("employees").select("*, departments(*), designations(*)").order("full_name"),
        supabase.from("attendance").select("*, employees(*)", { count: 'exact' }).order("date", { ascending: false }).range(attFrom, attTo),
        supabase.from("payroll").select("*, employees(*)", { count: 'exact' }).order("year", { ascending: false }).order("month", { ascending: false }).range(payFrom, payTo),
      ]);

      if (deptRes.error) throw deptRes.error;
      if (desigRes.error) throw desigRes.error;
      if (empRes.error) throw empRes.error;
      if (attRes.error) throw attRes.error;
      if (payRes.error) throw payRes.error;

      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setEmployees(empRes.data || []);
      setAttendances(attRes.data || []);
      setAttTotal(attRes.count || 0);
      setPayrolls(payRes.data || []);
      setPayTotal(payRes.count || 0);
    } catch (error) {
      console.error("Error fetching HRM data:", error);
      toast({ title: "Error", description: "Failed to load HRM data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Department handlers
  const handleSaveDept = async () => {
    try {
      if (editingDept) {
        const { error } = await supabase.from("departments").update(deptForm).eq("id", editingDept.id);
        if (error) throw error;
        toast({ title: "Success", description: "Department updated" });
      } else {
        const { error } = await supabase.from("departments").insert([deptForm]);
        if (error) throw error;
        toast({ title: "Success", description: "Department created" });
      }
      setDeptDialogOpen(false);
      setEditingDept(null);
      setDeptForm({ name: "", description: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm("Delete this department?")) return;
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Department deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Designation handlers
  const handleSaveDesig = async () => {
    try {
      const data = { ...desigForm, department_id: desigForm.department_id || null };
      if (editingDesig) {
        const { error } = await supabase.from("designations").update(data).eq("id", editingDesig.id);
        if (error) throw error;
        toast({ title: "Success", description: "Designation updated" });
      } else {
        const { error } = await supabase.from("designations").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Designation created" });
      }
      setDesigDialogOpen(false);
      setEditingDesig(null);
      setDesigForm({ name: "", department_id: "", description: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDesig = async (id: string) => {
    if (!confirm("Delete this designation?")) return;
    try {
      const { error } = await supabase.from("designations").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Designation deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Employee handlers
  const handleSaveEmp = async () => {
    try {
      const data = {
        ...empForm,
        department_id: empForm.department_id || null,
        designation_id: empForm.designation_id || null,
        email: empForm.email || null,
        phone: empForm.phone || null,
        address: empForm.address || null,
      };
      
      if (editingEmp) {
        const { error } = await supabase.from("employees").update(data).eq("id", editingEmp.id);
        if (error) throw error;
        toast({ title: "Success", description: "Employee updated" });
      } else {
        const { error } = await supabase.from("employees").insert([data]);
        if (error) throw error;
        toast({ title: "Success", description: "Employee created" });
      }
      setEmpDialogOpen(false);
      setEditingEmp(null);
      setEmpForm({
        employee_code: "",
        full_name: "",
        email: "",
        phone: "",
        address: "",
        department_id: "",
        designation_id: "",
        joining_date: format(new Date(), "yyyy-MM-dd"),
        basic_salary: 0,
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteEmp = async (id: string) => {
    if (!confirm("Delete this employee?")) return;
    try {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Employee deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Attendance handlers
  const handleSaveAttendance = async () => {
    try {
      const data = {
        employee_id: attendanceForm.employee_id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        check_in: attendanceForm.check_in || null,
        check_out: attendanceForm.check_out || null,
        notes: attendanceForm.notes || null,
      };
      
      const { error } = await supabase.from("attendance").upsert([data], { 
        onConflict: "employee_id,date" 
      });
      if (error) throw error;
      toast({ title: "Success", description: "Attendance recorded" });
      setAttendanceDialogOpen(false);
      setAttendanceForm({
        employee_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        status: "present",
        check_in: "",
        check_out: "",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Payroll handlers
  const handleSavePayroll = async () => {
    try {
      const netSalary = 
        payrollForm.basic_salary + 
        payrollForm.allowances + 
        payrollForm.bonus + 
        payrollForm.commission - 
        payrollForm.deductions;
      
      const data = {
        ...payrollForm,
        net_salary: netSalary,
      };
      
      const { error } = await supabase.from("payroll").upsert([data], { 
        onConflict: "employee_id,month,year" 
      });
      if (error) throw error;
      toast({ title: "Success", description: "Payroll saved" });
      setPayrollDialogOpen(false);
      setPayrollForm({
        employee_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        basic_salary: 0,
        allowances: 0,
        deductions: 0,
        bonus: 0,
        commission: 0,
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading HRM...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Human Resource Management</h1>
          <p className="page-description">Manage employees, attendance, and payroll</p>
        </div>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" /> Employees
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-4 w-4" /> Attendance
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <DollarSign className="h-4 w-4" /> Payroll
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building2 className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger value="designations" className="gap-2">
            <Briefcase className="h-4 w-4" /> Designations
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {canManage && (
              <Dialog open={empDialogOpen} onOpenChange={setEmpDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingEmp(null);
                    setEmpForm({
                      employee_code: "",
                      full_name: "",
                      email: "",
                      phone: "",
                      address: "",
                      department_id: "",
                      designation_id: "",
                      joining_date: format(new Date(), "yyyy-MM-dd"),
                      basic_salary: 0,
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Employee
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingEmp ? "Edit Employee" : "Add Employee"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Employee Code *</Label>
                        <Input
                          value={empForm.employee_code}
                          onChange={(e) => setEmpForm({ ...empForm, employee_code: e.target.value })}
                          placeholder="EMP001"
                        />
                      </div>
                      <div>
                        <Label>Full Name *</Label>
                        <Input
                          value={empForm.full_name}
                          onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={empForm.email}
                          onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={empForm.phone}
                          onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        value={empForm.address}
                        onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Department</Label>
                        <Select
                          value={empForm.department_id}
                          onValueChange={(v) => setEmpForm({ ...empForm, department_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Designation</Label>
                        <Select
                          value={empForm.designation_id}
                          onValueChange={(v) => setEmpForm({ ...empForm, designation_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                          <SelectContent>
                            {designations.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Joining Date</Label>
                        <Input
                          type="date"
                          value={empForm.joining_date}
                          onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Basic Salary</Label>
                        <Input
                          type="number"
                          value={empForm.basic_salary}
                          onChange={(e) => setEmpForm({ ...empForm, basic_salary: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleSaveEmp} className="w-full">
                      {editingEmp ? "Update" : "Add"} Employee
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="font-mono">{emp.employee_code}</td>
                      <td className="font-medium">{emp.full_name}</td>
                      <td>{emp.departments?.name || "-"}</td>
                      <td>{emp.designations?.name || "-"}</td>
                      <td>৳{emp.basic_salary.toLocaleString()}</td>
                      <td>
                        <Badge className={employeeStatusColors[emp.status]}>
                          {emp.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => {
                                setEditingEmp(emp);
                                setEmpForm({
                                  employee_code: emp.employee_code,
                                  full_name: emp.full_name,
                                  email: emp.email || "",
                                  phone: emp.phone || "",
                                  address: emp.address || "",
                                  department_id: emp.department_id || "",
                                  designation_id: emp.designation_id || "",
                                  joining_date: emp.joining_date,
                                  basic_salary: emp.basic_salary,
                                });
                                setEmpDialogOpen(true);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canRemove && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteEmp(emp.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <CalendarCheck className="h-4 w-4 mr-2" /> Mark Attendance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark Attendance</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Employee *</Label>
                      <Select
                        value={attendanceForm.employee_id}
                        onValueChange={(v) => setAttendanceForm({ ...attendanceForm, employee_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.filter(e => e.status === 'active').map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.employee_code} - {e.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={attendanceForm.date}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={attendanceForm.status}
                          onValueChange={(v: Attendance["status"]) => setAttendanceForm({ ...attendanceForm, status: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Present</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                            <SelectItem value="late">Late</SelectItem>
                            <SelectItem value="half_day">Half Day</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Check In</Label>
                        <Input
                          type="time"
                          value={attendanceForm.check_in}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, check_in: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Check Out</Label>
                        <Input
                          type="time"
                          value={attendanceForm.check_out}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, check_out: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={attendanceForm.notes}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSaveAttendance} className="w-full">
                      Save Attendance
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No attendance records
                    </td>
                  </tr>
                ) : (
                  attendances.map((att) => (
                    <tr key={att.id}>
                      <td>{format(new Date(att.date), "dd MMM yyyy")}</td>
                      <td className="font-medium">{att.employees?.full_name || "N/A"}</td>
                      <td>
                        <Badge className={attendanceStatusColors[att.status]}>
                          {att.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>{att.check_in || "-"}</td>
                      <td>{att.check_out || "-"}</td>
                      <td className="text-muted-foreground">{att.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={attPage}
            totalCount={attTotal}
            pageSize={PAGE_SIZE}
            onPageChange={setAttPage}
          />
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" /> Generate Payroll
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Payroll</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Employee *</Label>
                      <Select
                        value={payrollForm.employee_id}
                        onValueChange={(v) => {
                          const emp = employees.find(e => e.id === v);
                          setPayrollForm({ 
                            ...payrollForm, 
                            employee_id: v,
                            basic_salary: emp?.basic_salary || 0
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.filter(e => e.status === 'active').map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.employee_code} - {e.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Month</Label>
                        <Select
                          value={payrollForm.month.toString()}
                          onValueChange={(v) => setPayrollForm({ ...payrollForm, month: parseInt(v) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {monthNames.map((m, i) => (
                              <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Year</Label>
                        <Input
                          type="number"
                          value={payrollForm.year}
                          onChange={(e) => setPayrollForm({ ...payrollForm, year: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Basic Salary</Label>
                        <Input
                          type="number"
                          value={payrollForm.basic_salary}
                          onChange={(e) => setPayrollForm({ ...payrollForm, basic_salary: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Allowances</Label>
                        <Input
                          type="number"
                          value={payrollForm.allowances}
                          onChange={(e) => setPayrollForm({ ...payrollForm, allowances: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Deductions</Label>
                        <Input
                          type="number"
                          value={payrollForm.deductions}
                          onChange={(e) => setPayrollForm({ ...payrollForm, deductions: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Bonus</Label>
                        <Input
                          type="number"
                          value={payrollForm.bonus}
                          onChange={(e) => setPayrollForm({ ...payrollForm, bonus: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Commission</Label>
                      <Input
                        type="number"
                        value={payrollForm.commission}
                        onChange={(e) => setPayrollForm({ ...payrollForm, commission: Number(e.target.value) })}
                      />
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex justify-between">
                        <span>Net Salary:</span>
                        <span className="font-bold">
                          ৳{(payrollForm.basic_salary + payrollForm.allowances + payrollForm.bonus + payrollForm.commission - payrollForm.deductions).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button onClick={handleSavePayroll} className="w-full">
                      Save Payroll
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Employee</th>
                  <th>Basic</th>
                  <th>Allowances</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No payroll records
                    </td>
                  </tr>
                ) : (
                  payrolls.map((pay) => (
                    <tr key={pay.id}>
                      <td>{monthNames[pay.month - 1]} {pay.year}</td>
                      <td className="font-medium">{pay.employees?.full_name || "N/A"}</td>
                      <td>৳{pay.basic_salary.toLocaleString()}</td>
                      <td>৳{pay.allowances.toLocaleString()}</td>
                      <td>৳{pay.deductions.toLocaleString()}</td>
                      <td className="font-medium">৳{pay.net_salary.toLocaleString()}</td>
                      <td>
                        <Badge variant={pay.status === 'paid' ? 'default' : 'outline'}>
                          {pay.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={payPage}
            totalCount={payTotal}
            pageSize={PAGE_SIZE}
            onPageChange={setPayPage}
          />
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingDept(null);
                    setDeptForm({ name: "", description: "" });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Department
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={deptForm.name}
                        onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={deptForm.description}
                        onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSaveDept} className="w-full">
                      {editingDept ? "Update" : "Add"} Department
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{dept.name}</h3>
                    <p className="text-sm text-muted-foreground">{dept.description || "No description"}</p>
                  </div>
                  {(canEdit || canRemove) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => {
                            setEditingDept(dept);
                            setDeptForm({ name: dept.name, description: dept.description || "" });
                            setDeptDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteDept(dept.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="text-sm mt-2">
                  {employees.filter(e => e.department_id === dept.id).length} employees
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Designations Tab */}
        <TabsContent value="designations" className="space-y-4">
          <div className="flex justify-end">
            {canManage && (
              <Dialog open={desigDialogOpen} onOpenChange={setDesigDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingDesig(null);
                    setDesigForm({ name: "", department_id: "", description: "" });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Designation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingDesig ? "Edit Designation" : "Add Designation"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={desigForm.name}
                        onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Select
                        value={desigForm.department_id}
                        onValueChange={(v) => setDesigForm({ ...desigForm, department_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={desigForm.description}
                        onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSaveDesig} className="w-full">
                      {editingDesig ? "Update" : "Add"} Designation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designations.map((desig) => (
              <div key={desig.id} className="card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{desig.name}</h3>
                    <p className="text-sm text-muted-foreground">{desig.departments?.name || "No department"}</p>
                  </div>
                  {(canEdit || canRemove) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => {
                            setEditingDesig(desig);
                            setDesigForm({ 
                              name: desig.name, 
                              department_id: desig.department_id || "",
                              description: desig.description || "" 
                            });
                            setDesigDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteDesig(desig.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
