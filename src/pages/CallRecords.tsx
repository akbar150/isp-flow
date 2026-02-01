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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Phone, Search, Download, Calendar as CalendarIcon, User, FileText, MoreHorizontal, Navigation } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { CallRecordDialog } from "@/components/CallRecordDialog";
import { QuickCallRecord } from "@/components/QuickCallRecord";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { cn } from "@/lib/utils";
import { exportToCSV, exportToPDF, formatDateForExport } from "@/lib/exportUtils";

interface MikrotikUser {
  id: string;
  username: string;
}

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
    alt_phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  mikrotik_users?: MikrotikUser[] | null;
}

interface CustomerOption {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  alt_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mikrotik_users?: MikrotikUser[] | null;
}

export default function CallRecords() {
  const [records, setRecords] = useState<CallRecordWithCustomer[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [recordsRes, customersRes] = await Promise.all([
        supabase
          .from("call_records")
          .select("*, customers:customer_id(id, user_id, full_name, phone, alt_phone, latitude, longitude)")
          .order("call_date", { ascending: false }),
        supabase
          .from("customers_safe")
          .select("id, user_id, full_name, phone, alt_phone, latitude, longitude, mikrotik_users:mikrotik_users_safe(id, username)")
          .order("full_name"),
      ]);

      if (recordsRes.error) throw recordsRes.error;
      if (customersRes.error) throw customersRes.error;

      // Enrich records with PPPoE username from customers
      const customersData = customersRes.data as CustomerOption[] || [];
      const enrichedRecords = (recordsRes.data || []).map(record => {
        const customer = customersData.find(c => c.id === record.customer_id);
        return {
          ...record,
          mikrotik_users: customer?.mikrotik_users,
          customers: {
            ...record.customers,
            alt_phone: customer?.alt_phone,
            latitude: customer?.latitude,
            longitude: customer?.longitude,
          },
        };
      });

      setRecords(enrichedRecords as CallRecordWithCustomer[]);
      setCustomers(customersData);
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

    // Search filter - including PPPoE username
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.customers?.full_name.toLowerCase().includes(term) ||
          record.customers?.user_id.toLowerCase().includes(term) ||
          record.customers?.phone.includes(term) ||
          record.mikrotik_users?.[0]?.username?.toLowerCase().includes(term) ||
          record.notes.toLowerCase().includes(term)
      );
    }

    // Date range filter
    if (dateRange.start) {
      const start = startOfDay(dateRange.start);
      filtered = filtered.filter(
        (record) => new Date(record.call_date) >= start
      );
    }
    if (dateRange.end) {
      const end = endOfDay(dateRange.end);
      filtered = filtered.filter(
        (record) => new Date(record.call_date) <= end
      );
    }

    return filtered;
  };

  const filteredRecords = getFilteredRecords();

  const handleExportCSV = () => {
    const data = filteredRecords.map(record => ({
      date: formatDateForExport(record.call_date, "yyyy-MM-dd HH:mm"),
      pppoe_username: record.mikrotik_users?.[0]?.username || "",
      customer_id: record.customers?.user_id || "",
      customer_name: record.customers?.full_name || "",
      phone: record.customers?.phone || "",
      notes: record.notes,
    }));
    
    exportToCSV(data, [
      { key: "date", label: "Date/Time" },
      { key: "pppoe_username", label: "PPPoE Username" },
      { key: "customer_id", label: "Customer ID" },
      { key: "customer_name", label: "Customer Name" },
      { key: "phone", label: "Phone" },
      { key: "notes", label: "Notes" },
    ], `call_records_${format(new Date(), "yyyy-MM-dd")}`);
  };

  const handleExportPDF = () => {
    const data = filteredRecords.map(record => ({
      date: formatDateForExport(record.call_date, "dd MMM yyyy HH:mm"),
      pppoe_username: record.mikrotik_users?.[0]?.username || "-",
      customer_name: record.customers?.full_name || "-",
      phone: record.customers?.phone || "-",
      notes: record.notes.substring(0, 50) + (record.notes.length > 50 ? "..." : ""),
    }));
    
    exportToPDF(data, [
      { key: "date", label: "Date/Time" },
      { key: "pppoe_username", label: "PPPoE Username" },
      { key: "customer_name", label: "Customer Name" },
      { key: "phone", label: "Phone" },
      { key: "notes", label: "Notes" },
    ], "Call Records Report", `call_records_${format(new Date(), "yyyy-MM-dd")}`);
  };

  const clearDateFilter = () => {
    setDateRange({ start: null, end: null });
  };

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
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
            placeholder="Search by PPPoE username, name, phone, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[200px]",
                !dateRange.start && !dateRange.end && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.start ? (
                dateRange.end ? (
                  <>
                    {format(dateRange.start, "dd MMM")} - {format(dateRange.end, "dd MMM yyyy")}
                  </>
                ) : (
                  format(dateRange.start, "dd MMM yyyy")
                )
              ) : (
                "Filter by date"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Calendar
                  mode="single"
                  selected={dateRange.start || undefined}
                  onSelect={(date) => setDateRange(prev => ({ ...prev, start: date || null }))}
                  className="p-3 pointer-events-auto"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Calendar
                  mode="single"
                  selected={dateRange.end || undefined}
                  onSelect={(date) => setDateRange(prev => ({ ...prev, end: date || null }))}
                  className="p-3 pointer-events-auto"
                />
              </div>
              {(dateRange.start || dateRange.end) && (
                <Button variant="outline" size="sm" onClick={clearDateFilter} className="w-full">
                  Clear Filter
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
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
                (r) => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(r.call_date) >= weekAgo;
                }
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
                <th>PPPoE Username</th>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Call Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    No call records found
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(record.call_date), "dd MMM yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(record.call_date), "hh:mm a")}
                      </div>
                    </td>
                    <td className="font-mono text-sm">
                      {record.mikrotik_users?.[0]?.username || (
                        <span className="text-muted-foreground">Not set</span>
                      )}
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
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {/* Call Customer */}
                          <CallCustomerButton
                            customerName={record.customers?.full_name || "Unknown"}
                            primaryPhone={record.customers?.phone || ""}
                            alternativePhone={record.customers?.alt_phone}
                            variant="dropdown"
                          />
                          
                          {/* Quick Call Record */}
                          <QuickCallRecord
                            customerId={record.customer_id}
                            customerName={record.customers?.full_name || "Unknown"}
                            onSuccess={fetchData}
                            variant="dropdown"
                          />
                          
                          {/* Go Location - only if GPS exists */}
                          {record.customers?.latitude && record.customers?.longitude && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => window.open(
                                  `https://www.google.com/maps?q=${record.customers?.latitude},${record.customers?.longitude}`, 
                                  "_blank"
                                )}
                              >
                                <Navigation className="h-4 w-4 mr-2" />
                                Go Location
                              </DropdownMenuItem>
                            </>
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
      c.phone.includes(searchCustomer) ||
      c.mikrotik_users?.[0]?.username?.toLowerCase().includes(searchCustomer.toLowerCase())
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
                placeholder="Search by PPPoE username, name, ID, or phone..."
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
                        PPPoE: {customer.mikrotik_users?.[0]?.username || "Not set"} • {customer.phone}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedCustomer.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  PPPoE: {selectedCustomer.mikrotik_users?.[0]?.username || "Not set"} • {selectedCustomer.phone}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Call Notes *</label>
              <textarea
                className="w-full min-h-[100px] px-3 py-2 border rounded-md bg-background resize-y"
                placeholder="Enter details about the call..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
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
