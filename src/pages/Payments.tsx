import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  total_due: number;
  packages: {
    monthly_price: number;
  } | null;
}

interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  method: 'bkash' | 'cash' | 'bank_transfer' | 'due';
  transaction_id: string | null;
  notes: string | null;
  remaining_due: number;
  customers: {
    user_id: string;
    full_name: string;
  } | null;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    amount: "",
    method: "cash" as 'bkash' | 'cash' | 'bank_transfer' | 'due',
    transaction_id: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, customersRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, customers(user_id, full_name)')
          .order('payment_date', { ascending: false })
          .limit(100),
        supabase.from('customers').select('id, user_id, full_name, total_due, packages(monthly_price)'),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      setPayments(paymentsRes.data as Payment[] || []);
      setCustomers(customersRes.data as Customer[] || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedCustomer = customers.find(c => c.id === formData.customer_id);
      if (!selectedCustomer) throw new Error('Please select a customer');

      const amount = parseFloat(formData.amount);
      const remainingDue = Math.max(0, selectedCustomer.total_due - amount);

      // Create payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        customer_id: formData.customer_id,
        amount,
        method: formData.method,
        transaction_id: formData.transaction_id || null,
        notes: formData.notes || null,
        remaining_due: remainingDue,
      });

      if (paymentError) throw paymentError;

      // Update customer due
      const { error: customerError } = await supabase
        .from('customers')
        .update({ total_due: remainingDue })
        .eq('id', formData.customer_id);

      if (customerError) throw customerError;

      toast({ title: "Payment recorded successfully" });
      setDialogOpen(false);
      setFormData({
        customer_id: "",
        amount: "",
        method: "cash",
        transaction_id: "",
        notes: "",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      bkash: 'bg-pink-100 text-pink-700',
      cash: 'bg-green-100 text-green-700',
      bank_transfer: 'bg-blue-100 text-blue-700',
      due: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`status-badge ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
        {method.replace('_', ' ')}
      </span>
    );
  };

  const filteredPayments = payments.filter(payment => {
    const customerName = payment.customers?.full_name || '';
    const customerId = payment.customers?.user_id || '';
    return (
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const selectedCustomer = customers.find(c => c.id === formData.customer_id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading payments...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-description">Record and track customer payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.user_id} - {customer.full_name} (Due: ৳{customer.total_due})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground">
                    Current due: <span className="font-medium text-foreground">৳{selectedCustomer.total_due}</span>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (৳) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(value: 'bkash' | 'cash' | 'bank_transfer' | 'due') => 
                      setFormData({ ...formData, method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Transaction ID</Label>
                <Input
                  value={formData.transaction_id}
                  onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                  placeholder="For bKash/Bank transfers"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Record Payment</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer or transaction ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Payments Table */}
      <div className="form-section overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Transaction ID</th>
              <th>Remaining Due</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  No payments found
                </td>
              </tr>
            ) : (
              filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</td>
                  <td>
                    <div>
                      <p className="font-medium">{payment.customers?.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {payment.customers?.user_id}
                      </p>
                    </div>
                  </td>
                  <td className="amount-positive">৳{payment.amount}</td>
                  <td>{getMethodBadge(payment.method)}</td>
                  <td className="font-mono text-sm">{payment.transaction_id || '-'}</td>
                  <td className={payment.remaining_due > 0 ? "amount-due" : ""}>
                    ৳{payment.remaining_due}
                  </td>
                  <td className="max-w-[200px] truncate">{payment.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
