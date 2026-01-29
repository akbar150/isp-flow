import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Phone, Search, Download, Calendar, User } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CallRecordDialog } from "@/components/CallRecordDialog";

interface CallRecordWithCustomer {
  id: string;
  call_date: string;
  notes: string;
  called_by: string | null;
  created_at: string;
  customer_id: string;
  customers: {
    id: string;
    user_id: string;
    full_name: string;
    phone: string;
  } | null;
}

interface CustomerOption {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
}

export default function CallRecords() {
  const [records, setRecords] = useState<CallRecordWithCustomer[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [recordsRes, customersRes] = await Promise.all([
        supabase
          .from("call_records")
          .select("*, customers:customer_id(id, user_id, full_name, phone)")
          .order("call_date", { ascending: false }),
        supabase
          .from("customers_safe")
          .select("id, user_id, full_name, phone")
          .order("full_name"),
      ]);

      if (recordsRes.error) throw recordsRes.error;
      if (customersRes.error) throw customersRes.error;

      setRecords(recordsRes.data as CallRecordWithCustomer[] || []);
      setCustomers(customersRes.data as CustomerOption[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch call records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecords = () => {
    let filtered = records;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.customers?.full_name.toLowerCase().includes(term) ||
          record.customers?.user_id.toLowerCase().includes(term) ||
          record.customers?.phone.includes(term) ||
          record.notes.toLowerCase().includes(term)
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case "today":
          startDate = startOfDay(now);
          break;
        case "week":
          startDate = subDays(now, 7);
          break;
        case "month":
          startDate = subDays(now, 30);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(
        (record) => new Date(record.call_date) >= startDate
      );
    }

    return filtered;
  };

  const exportToCSV = () => {
    const filtered = getFilteredRecords();
    const headers = ["Date/Time", "Customer ID", "Customer Name", "Phone", "Notes"];
    const rows = filtered.map((record) => [
      format(new Date(record.call_date), "yyyy-MM-dd HH:mm:ss"),
      record.customers?.user_id || "",
      record.customers?.full_name || "",
      record.customers?.phone || "",
      `"${record.notes.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `call_records_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const filteredRecords = getFilteredRecords();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">
            Loading call records...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Call Records
          </h1>
          <p className="page-description">
            Track and manage customer call follow-ups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Phone className="h-4 w-4 mr-2" />
            Add Call Record
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, ID, phone, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="form-section">
          <p className="text-sm text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold">{records.length}</p>
        </div>
        <div className="form-section">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-2xl font-bold">
            {
              records.filter(
                (r) =>
                  new Date(r.call_date) >= startOfDay(new Date())
              ).length
            }
          </p>
        </div>
        <div className="form-section">
          <p className="text-sm text-muted-foreground">This Week</p>
          <p className="text-2xl font-bold">
            {
              records.filter(
                (r) => new Date(r.call_date) >= subDays(new Date(), 7)
              ).length
            }
          </p>
        </div>
        <div className="form-section">
          <p className="text-sm text-muted-foreground">Filtered</p>
          <p className="text-2xl font-bold">{filteredRecords.length}</p>
        </div>
      </div>

      {/* Records List */}
      <div className="form-section">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Customer ID</th>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Call Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    No call records found
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(record.call_date), "dd MMM yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(record.call_date), "hh:mm a")}
                      </div>
                    </td>
                    <td className="font-mono text-sm">
                      {record.customers?.user_id || "N/A"}
                    </td>
                    <td className="font-medium">
                      {record.customers?.full_name || "Unknown"}
                    </td>
                    <td>{record.customers?.phone || "N/A"}</td>
                    <td className="max-w-[300px]">
                      <p className="truncate" title={record.notes}>
                        {record.notes}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Call Record Dialog with Customer Selection */}
      {dialogOpen && (
        <AddCallRecordWithCustomerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          customers={customers}
          onSuccess={fetchData}
        />
      )}
    </DashboardLayout>
  );
}

// Sub-component for adding call record with customer selection
function AddCallRecordWithCustomerDialog({
  open,
  onOpenChange,
  customers,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  onSuccess: () => void;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState("");

  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.user_id.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.phone.includes(searchCustomer)
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast({
        title: "Error",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (!notes.trim()) {
      toast({
        title: "Error",
        description: "Please enter call notes",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("call_records").insert({
        customer_id: selectedCustomerId,
        notes: notes.trim(),
        called_by: user?.id || null,
        call_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: "Call record saved successfully" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving call record:", error);
      toast({
        title: "Error",
        description: "Failed to save call record",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Phone className="h-5 w-5" />
            Add Call Record
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Customer *</label>
              <Input
                placeholder="Search by name, ID, or phone..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
              />
              {searchCustomer && (
                <div className="max-h-[150px] overflow-y-auto border rounded-md">
                  {filteredCustomers.slice(0, 10).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                        selectedCustomerId === customer.id ? "bg-muted" : ""
                      }`}
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        setSearchCustomer("");
                      }}
                    >
                      <div className="font-medium">{customer.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {customer.user_id} • {customer.phone}
                      </div>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="text-sm text-muted-foreground p-3">
                      No customers found
                    </p>
                  )}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {selectedCustomer.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedCustomer.user_id} • {selectedCustomer.phone}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Call Notes (Unicode supported) *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="কল নোট লিখুন... / Enter call notes..."
                className="w-full min-h-[150px] px-3 py-2 border rounded-md bg-background resize-none"
                required
              />
              <p className="text-xs text-muted-foreground">
                {notes.length}/2000 characters
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Call Record"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
