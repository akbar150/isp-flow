import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Loader2, Receipt, CreditCard } from "lucide-react";

interface BillingRecord {
  id: string;
  billing_date: string;
  amount: number;
  package_name: string;
  status: string;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  payment_date: string;
  transaction_id: string | null;
  notes: string | null;
  remaining_due: number;
  created_at: string;
}

interface CustomerBillingHistoryProps {
  customerId: string;
  customerName: string;
}

export function CustomerBillingHistory({ customerId, customerName }: CustomerBillingHistoryProps) {
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bills' | 'payments'>('bills');

  useEffect(() => {
    fetchData();
  }, [customerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch billing records
      const { data: billsData, error: billsError } = await supabase
        .from('billing_records')
        .select('*')
        .eq('customer_id', customerId)
        .order('billing_date', { ascending: false });

      if (billsError) throw billsError;
      setBillingRecords(billsData || []);

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('customer_id', customerId)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);
    } catch (error) {
      console.error('Error fetching billing history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500">Partial</Badge>;
      default:
        return <Badge variant="destructive">Unpaid</Badge>;
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      bkash: 'bg-pink-500',
      cash: 'bg-green-500',
      bank_transfer: 'bg-blue-500',
      due: 'bg-yellow-500',
    };
    return (
      <Badge className={colors[method] || 'bg-gray-500'}>
        {method.replace('_', ' ')}
      </Badge>
    );
  };

  // Calculate totals
  const totalBilled = billingRecords.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalUnpaid = billingRecords
    .filter(r => r.status !== 'paid')
    .reduce((sum, r) => sum + (Number(r.amount) - Number(r.amount_paid)), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading billing history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Total Billed</p>
          <p className="text-2xl font-bold">৳{totalBilled.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg bg-green-500/10">
          <p className="text-sm text-green-600">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">৳{totalPaid.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg bg-destructive/10">
          <p className="text-sm text-destructive">Outstanding</p>
          <p className="text-2xl font-bold text-destructive">৳{totalUnpaid.toLocaleString()}</p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === 'bills' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('bills')}
          className="rounded-b-none"
        >
          <Receipt className="h-4 w-4 mr-2" />
          Billing Records ({billingRecords.length})
        </Button>
        <Button
          variant={activeTab === 'payments' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('payments')}
          className="rounded-b-none"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Payment History ({payments.length})
        </Button>
      </div>

      {/* Bills Table */}
      {activeTab === 'bills' && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill Date</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No billing records found
                  </TableCell>
                </TableRow>
              ) : (
                billingRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{format(new Date(record.billing_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{record.package_name}</TableCell>
                    <TableCell className="text-right font-medium">৳{Number(record.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600">৳{Number(record.amount_paid).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(record.due_date), 'dd MMM yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Payments Table */}
      {activeTab === 'payments' && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead className="text-right">Due After</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No payment records found
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      ৳{Number(payment.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>{getPaymentMethodBadge(payment.method)}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {payment.transaction_id || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      ৳{Number(payment.remaining_due).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                      {payment.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
