import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Printer,
  Send,
  Eye,
  DollarSign
} from "lucide-react";
import { InvoicePaymentDialog } from "@/components/InvoicePaymentDialog";
import { format, addDays } from "date-fns";

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address: string;
  packages: {
    name: string;
    monthly_price: number;
  } | null;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  billing_record_id: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
  notes: string | null;
  created_at: string;
  customers?: Customer | null;
  invoice_items?: InvoiceItem[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export default function Invoices() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  
  // Form states
  const [form, setForm] = useState({
    customer_id: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    due_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    discount: 0,
    tax: 0,
    notes: "",
  });
  const [items, setItems] = useState<{ description: string; quantity: number; unit_price: number }[]>([
    { description: "", quantity: 1, unit_price: 0 }
  ]);

  const canManage = isSuperAdmin || canCreate("invoices");
  const canEdit = isSuperAdmin || canUpdate("invoices");
  const canRemove = isSuperAdmin || canDelete("invoices");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, customersRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, customers:customers_safe(id, user_id, full_name, phone, address, packages(name, monthly_price)), invoice_items(*)")
          .order("created_at", { ascending: false }),
        supabase
          .from("customers_safe")
          .select("id, user_id, full_name, phone, address, packages(name, monthly_price)")
          .order("full_name"),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (customersRes.error) throw customersRes.error;

      setInvoices(invoicesRes.data || []);
      setCustomers(customersRes.data || []);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({ title: "Error", description: "Failed to load invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    try {
      const validItems = items.filter(i => i.description && i.unit_price > 0);
      if (validItems.length === 0) {
        toast({ title: "Error", description: "Add at least one item", variant: "destructive" });
        return;
      }

      const subtotal = validItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const total = subtotal - form.discount + form.tax;

      // Generate invoice number
      const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");

      const invoiceData = {
        invoice_number: invoiceNumber,
        customer_id: form.customer_id,
        issue_date: form.issue_date,
        due_date: form.due_date,
        subtotal,
        discount: form.discount,
        tax: form.tax,
        total,
        notes: form.notes || null,
        status: 'draft' as const,
      };

      if (editingInvoice) {
        // Update invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({ ...invoiceData, invoice_number: editingInvoice.invoice_number })
          .eq("id", editingInvoice.id);
        if (invoiceError) throw invoiceError;

        // Delete old items and insert new ones
        await supabase.from("invoice_items").delete().eq("invoice_id", editingInvoice.id);
        
        const itemsToInsert = validItems.map(item => ({
          invoice_id: editingInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        }));
        
        const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;

        toast({ title: "Success", description: "Invoice updated" });
      } else {
        // Create invoice
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert([invoiceData])
          .select()
          .single();
        if (invoiceError) throw invoiceError;

        // Insert items
        const itemsToInsert = validItems.map(item => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        }));

        const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
        if (itemsError) throw itemsError;

        toast({ title: "Success", description: "Invoice created" });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Invoice deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (id: string, status: Invoice["status"]) => {
    try {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Status updated" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingInvoice(null);
    setForm({
      customer_id: "",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      discount: 0,
      tax: 0,
      notes: "",
    });
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // HTML escape function to prevent XSS
  const escapeHtml = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const customer = invoice.customers;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Error", description: "Please allow popups", variant: "destructive" });
      return;
    }

    // Escape all user-provided content to prevent XSS
    const safeInvoiceNumber = escapeHtml(invoice.invoice_number);
    const safeCustomerName = escapeHtml(customer?.full_name);
    const safeCustomerAddress = escapeHtml(customer?.address);
    const safeCustomerPhone = escapeHtml(customer?.phone);
    const safeNotes = escapeHtml(invoice.notes);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${safeInvoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .invoice-title { font-size: 32px; font-weight: bold; color: #2563eb; }
          .invoice-number { color: #666; margin-top: 5px; }
          .customer-info { margin-bottom: 30px; }
          .dates { display: flex; gap: 40px; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f3f4f6; text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .totals { width: 300px; margin-left: auto; }
          .totals td { padding: 8px 12px; }
          .totals .total-row { font-weight: bold; font-size: 18px; background: #f3f4f6; }
          .footer { margin-top: 50px; text-align: center; color: #666; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">#${safeInvoiceNumber}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold;">EasyLink Broadband</div>
            <div>Internet Service Provider</div>
          </div>
        </div>
        
        <div class="customer-info">
          <strong>Bill To:</strong><br>
          ${safeCustomerName || "N/A"}<br>
          ${safeCustomerAddress || ""}<br>
          ${safeCustomerPhone || ""}
        </div>
        
        <div class="dates">
          <div><strong>Issue Date:</strong> ${format(new Date(invoice.issue_date), "dd MMM yyyy")}</div>
          <div><strong>Due Date:</strong> ${format(new Date(invoice.due_date), "dd MMM yyyy")}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.invoice_items?.map(item => `
              <tr>
                <td>${escapeHtml(item.description)}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">৳${item.unit_price.toLocaleString()}</td>
                <td style="text-align: right;">৳${item.total.toLocaleString()}</td>
              </tr>
            `).join("") || ""}
          </tbody>
        </table>
        
        <table class="totals">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right;">৳${invoice.subtotal.toLocaleString()}</td>
          </tr>
          ${invoice.discount > 0 ? `
          <tr>
            <td>Discount:</td>
            <td style="text-align: right;">-৳${invoice.discount.toLocaleString()}</td>
          </tr>
          ` : ""}
          ${invoice.tax > 0 ? `
          <tr>
            <td>Tax:</td>
            <td style="text-align: right;">৳${invoice.tax.toLocaleString()}</td>
          </tr>
          ` : ""}
          <tr class="total-row">
            <td>Total:</td>
            <td style="text-align: right;">৳${invoice.total.toLocaleString()}</td>
          </tr>
          ${invoice.amount_paid > 0 ? `
          <tr>
            <td>Amount Paid:</td>
            <td style="text-align: right;">৳${invoice.amount_paid.toLocaleString()}</td>
          </tr>
          <tr>
            <td><strong>Balance Due:</strong></td>
            <td style="text-align: right;"><strong>৳${(invoice.total - invoice.amount_paid).toLocaleString()}</strong></td>
          </tr>
          ` : ""}
        </table>
        
        ${safeNotes ? `<div style="margin-top: 30px;"><strong>Notes:</strong><br>${safeNotes}</div>` : ""}
        
        <div class="footer">
          Thank you for your business!
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const total = subtotal - form.discount + form.tax;

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading invoices...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice Management</h1>
          <p className="page-description">Create and manage customer invoices</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" /> Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingInvoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Customer Selection */}
                <div>
                  <Label>Customer *</Label>
                  <Select
                    value={form.customer_id}
                    onValueChange={(v) => setForm({ ...form, customer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.user_id} - {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Issue Date</Label>
                    <Input
                      type="date"
                      value={form.issue_date}
                      onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <Input
                          type="number"
                          placeholder="Price"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                          className="w-28"
                        />
                        <span className="w-24 text-right font-medium">
                          ৳{(item.quantity * item.unit_price).toLocaleString()}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discount & Tax */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount</Label>
                    <Input
                      type="number"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Tax</Label>
                    <Input
                      type="number"
                      value={form.tax}
                      onChange={(e) => setForm({ ...form, tax: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>৳{subtotal.toLocaleString()}</span>
                  </div>
                  {form.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-৳{form.discount.toLocaleString()}</span>
                    </div>
                  )}
                  {form.tax > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>৳{form.tax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>৳{total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>

                <Button onClick={handleSaveInvoice} className="w-full">
                  {editingInvoice ? "Update Invoice" : "Create Invoice"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-mono font-medium">{invoice.invoice_number}</td>
                  <td>{invoice.customers?.full_name || "N/A"}</td>
                  <td>{format(new Date(invoice.issue_date), "dd MMM yyyy")}</td>
                  <td>{format(new Date(invoice.due_date), "dd MMM yyyy")}</td>
                  <td className="font-medium">৳{invoice.total.toLocaleString()}</td>
                  <td>
                    <Badge className={statusColors[invoice.status]}>
                      {invoice.status}
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
                        <DropdownMenuItem onClick={() => {
                          setViewingInvoice(invoice);
                          setViewDialogOpen(true);
                        }}>
                          <Eye className="h-4 w-4 mr-2" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintInvoice(invoice)}>
                          <Printer className="h-4 w-4 mr-2" /> Print
                        </DropdownMenuItem>
                        {canEdit && invoice.status === 'draft' && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, 'sent')}>
                            <Send className="h-4 w-4 mr-2" /> Mark as Sent
                          </DropdownMenuItem>
                        )}
                        {canEdit && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <DropdownMenuItem onClick={() => {
                            setPayingInvoice(invoice);
                            setPaymentDialogOpen(true);
                          }}>
                            <DollarSign className="h-4 w-4 mr-2 text-green-600" /> Collect Payment
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem onClick={() => {
                            setEditingInvoice(invoice);
                            setForm({
                              customer_id: invoice.customer_id,
                              issue_date: invoice.issue_date,
                              due_date: invoice.due_date,
                              discount: invoice.discount,
                              tax: invoice.tax,
                              notes: invoice.notes || "",
                            });
                            setItems(invoice.invoice_items?.map(i => ({
                              description: i.description,
                              quantity: i.quantity,
                              unit_price: i.unit_price,
                            })) || [{ description: "", quantity: 1, unit_price: 0 }]);
                            setDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteInvoice(invoice.id)}
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

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice #{viewingInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{viewingInvoice.customers?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusColors[viewingInvoice.status]}>
                    {viewingInvoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Issue Date</p>
                  <p>{format(new Date(viewingInvoice.issue_date), "dd MMM yyyy")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p>{format(new Date(viewingInvoice.due_date), "dd MMM yyyy")}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-2">Items</p>
                <div className="space-y-1">
                  {viewingInvoice.invoice_items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.description} x{item.quantity}</span>
                      <span>৳{item.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>৳{viewingInvoice.subtotal.toLocaleString()}</span>
                </div>
                {viewingInvoice.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-৳{viewingInvoice.discount.toLocaleString()}</span>
                  </div>
                )}
                {viewingInvoice.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>৳{viewingInvoice.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>৳{viewingInvoice.total.toLocaleString()}</span>
                </div>
              </div>

              <Button 
                onClick={() => handlePrintInvoice(viewingInvoice)} 
                className="w-full"
              >
                <Printer className="h-4 w-4 mr-2" /> Print Invoice
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Collection Dialog */}
      {payingInvoice && (
        <InvoicePaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoice={{
            id: payingInvoice.id,
            invoice_number: payingInvoice.invoice_number,
            customer_id: payingInvoice.customer_id,
            total: payingInvoice.total,
            amount_paid: payingInvoice.amount_paid,
          }}
          customerName={payingInvoice.customers?.full_name || "Customer"}
          onSuccess={fetchData}
        />
      )}
    </DashboardLayout>
  );
}
