import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  DollarSign,
  Wallet,
  Building,
  Loader2,
  Edit,
  Trash2,
  Phone,
  Download,
  FileText,
} from "lucide-react";
import { exportToCSV, exportToPDF, formatDateForExport, formatCurrencyForExport } from "@/lib/exportUtils";

interface MikrotikUser {
  id: string;
  username: string;
}

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  payment_method: string;
  category_id: string | null;
  description: string | null;
  reference_id: string | null;
  transaction_date: string;
  created_at: string;
  expense_categories?: {
    name: string;
  } | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface PaymentSummary {
  method: string;
  total: number;
  count: number;
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  payment_date: string;
  customers: {
    user_id: string;
    full_name: string;
  } | null;
  mikrotik_users?: MikrotikUser[] | null;
}

interface CallRecord {
  id: string;
  notes: string;
  call_date: string;
  customers: {
    user_id: string;
    full_name: string;
  } | null;
  mikrotik_users?: MikrotikUser[] | null;
}

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    payment_method: "cash",
    category_id: "",
    description: "",
    transaction_date: format(new Date(), "yyyy-MM-dd"),
  });
  
  // Filters
  const [dateFilter, setDateFilter] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("current");
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Update date filter based on month selection
    if (monthFilter === "current") {
      setDateFilter({
        start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd"),
      });
    } else if (monthFilter === "previous") {
      const prevMonth = subMonths(new Date(), 1);
      setDateFilter({
        start: format(startOfMonth(prevMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(prevMonth), "yyyy-MM-dd"),
      });
    } else if (monthFilter === "last3") {
      setDateFilter({
        start: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"),
        end: format(new Date(), "yyyy-MM-dd"),
      });
    }
  }, [monthFilter]);

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/transactions', {
        params: {
          start_date: dateFilter.start,
          end_date: dateFilter.end,
        },
      });

      setTransactions(data.transactions || []);
      setPayments(data.payments || []);
      setCallRecords(data.callRecords || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load reports data",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const transactionData = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        category_id: formData.type === "expense" && formData.category_id ? formData.category_id : null,
        description: formData.description || null,
        transaction_date: formData.transaction_date,
      };

      if (editingTransaction) {
        await api.put(`/reports/transactions/${editingTransaction.id}`, transactionData);
        toast({ title: "Success", description: "Transaction updated" });
      } else {
        await api.post('/reports/transactions', transactionData);
        toast({ title: "Success", description: "Transaction added" });
      }

      setDialogOpen(false);
      setEditingTransaction(null);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      console.error("Error saving transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save transaction",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await api.delete(`/reports/transactions/${id}`);
      toast({ title: "Success", description: "Transaction deleted" });
      fetchData();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete transaction",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      type: "expense",
      amount: "",
      payment_method: "cash",
      category_id: "",
      description: "",
      transaction_date: format(new Date(), "yyyy-MM-dd"),
    });
  };

  const openEditDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      payment_method: transaction.payment_method,
      category_id: transaction.category_id || "",
      description: transaction.description || "",
      transaction_date: transaction.transaction_date,
    });
    setDialogOpen(true);
  };

  // Filter payments by method
  const filteredPayments = paymentMethodFilter === "all" 
    ? payments 
    : payments.filter(p => p.method === paymentMethodFilter);

  // Calculate summaries
  const totalPaymentIncome = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  
  const totalTransactionIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalIncome = totalPaymentIncome + totalTransactionIncome;

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netProfit = totalIncome - totalExpense;

  const paymentMethodSummary: PaymentSummary[] = payments.reduce((acc: PaymentSummary[], p) => {
    const existing = acc.find((item) => item.method === p.method);
    if (existing) {
      existing.total += Number(p.amount);
      existing.count += 1;
    } else {
      acc.push({ method: p.method, total: Number(p.amount), count: 1 });
    }
    return acc;
  }, []);

  const categorySummary: CategorySummary[] = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc: CategorySummary[], t) => {
      const categoryName = t.expense_categories?.name || "Uncategorized";
      const existing = acc.find((c) => c.category === categoryName);
      if (existing) {
        existing.total += Number(t.amount);
        existing.count += 1;
      } else {
        acc.push({ category: categoryName, total: Number(t.amount), count: 1 });
      }
      return acc;
    }, []);

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case "bkash":
        return <Wallet className="h-4 w-4 text-pink-500" />;
      case "bank_transfer":
        return <Building className="h-4 w-4 text-blue-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-green-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const exportCallRecordsCSV = () => {
    const data = callRecords.map(record => ({
      date: formatDateForExport(record.call_date, "yyyy-MM-dd HH:mm"),
      pppoe_username: record.mikrotik_users?.[0]?.username || "",
      customer_id: record.customers?.user_id || "",
      customer_name: record.customers?.full_name || "",
      notes: record.notes,
    }));
    
    exportToCSV(data, [
      { key: "date", label: "Date/Time" },
      { key: "pppoe_username", label: "PPPoE Username" },
      { key: "customer_id", label: "Customer ID" },
      { key: "customer_name", label: "Customer Name" },
      { key: "notes", label: "Notes" },
    ], `call-records-${dateFilter.start}-to-${dateFilter.end}`);
  };

  const exportCallRecordsPDF = () => {
    const data = callRecords.map(record => ({
      date: formatDateForExport(record.call_date, "dd MMM yyyy HH:mm"),
      pppoe_username: record.mikrotik_users?.[0]?.username || "-",
      customer_name: record.customers?.full_name || "-",
      notes: record.notes.substring(0, 50) + (record.notes.length > 50 ? "..." : ""),
    }));
    
    exportToPDF(data, [
      { key: "date", label: "Date/Time" },
      { key: "pppoe_username", label: "PPPoE Username" },
      { key: "customer_name", label: "Customer Name" },
      { key: "notes", label: "Notes" },
    ], "Call Records Report", `call-records-${dateFilter.start}-to-${dateFilter.end}`);
  };

  const exportPaymentsCSV = () => {
    const data = filteredPayments.map(payment => ({
      date: formatDateForExport(payment.payment_date, "yyyy-MM-dd"),
      pppoe_username: payment.mikrotik_users?.[0]?.username || "",
      customer_name: payment.customers?.full_name || "",
      method: payment.method.replace("_", " "),
      amount: payment.amount,
    }));
    
    exportToCSV(data, [
      { key: "date", label: "Date" },
      { key: "pppoe_username", label: "PPPoE Username" },
      { key: "customer_name", label: "Customer Name" },
      { key: "method", label: "Payment Method" },
      { key: "amount", label: "Amount" },
    ], `payments-${dateFilter.start}-to-${dateFilter.end}`);
  };

  const exportPaymentsPDF = () => {
    const data = filteredPayments.map(payment => ({
      date: formatDateForExport(payment.payment_date, "dd MMM yyyy"),
      pppoe_username: payment.mikrotik_users?.[0]?.username || "-",
      customer_name: payment.customers?.full_name || "-",
      method: payment.method.replace("_", " "),
      amount: formatCurrencyForExport(payment.amount),
    }));
    
    exportToPDF(data, [
      { key: "date", label: "Date" },
      { key: "pppoe_username", label: "PPPoE Username" },
      { key: "customer_name", label: "Customer Name" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount" },
    ], "Payments Report", `payments-${dateFilter.start}-to-${dateFilter.end}`);
  };

  const exportTransactionsCSV = () => {
    const data = transactions.map(t => ({
      date: formatDateForExport(t.transaction_date, "yyyy-MM-dd"),
      type: t.type,
      category: t.expense_categories?.name || "-",
      method: t.payment_method.replace("_", " "),
      description: t.description || "",
      amount: t.amount,
    }));
    
    exportToCSV(data, [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "category", label: "Category" },
      { key: "method", label: "Payment Method" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
    ], `transactions-${dateFilter.start}-to-${dateFilter.end}`);
  };

  const exportTransactionsPDF = () => {
    const data = transactions.map(t => ({
      date: formatDateForExport(t.transaction_date, "dd MMM yyyy"),
      type: t.type,
      category: t.expense_categories?.name || "-",
      method: t.payment_method.replace("_", " "),
      amount: formatCurrencyForExport(t.amount),
    }));
    
    exportToPDF(data, [
      { key: "date", label: "Date" },
      { key: "type", label: "Type" },
      { key: "category", label: "Category" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount" },
    ], "Transactions Report", `transactions-${dateFilter.start}-to-${dateFilter.end}`);
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-description">View payments, call records, and transactions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingTransaction(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? "Edit Transaction" : "Add Transaction"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "income" | "expense") =>
                    setFormData({ ...formData, type: value, category_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bkash">bKash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.type === "expense" && (
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>
              <Button type="submit" className="w-full">
                {editingTransaction ? "Update" : "Add"} Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Label>Period:</Label>
          <Select value={monthFilter} onValueChange={(v) => {
            setMonthFilter(v);
            if (v === "custom") return;
          }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="previous">Previous Month</SelectItem>
              <SelectItem value="last3">Last 3 Months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {monthFilter === "custom" && (
          <>
            <div className="flex items-center gap-2">
              <Label>From:</Label>
              <Input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>To:</Label>
              <Input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-auto"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <Label>Payment Method:</Label>
          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bkash">bKash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground">Payments + Other Income</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
            <p className="text-xs text-muted-foreground">All expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Income - Expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Call Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callRecords.length}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="payments">Payments ({filteredPayments.length})</TabsTrigger>
            <TabsTrigger value="calls">Call Records ({callRecords.length})</TabsTrigger>
            <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={exportPaymentsCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPaymentsPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>PPPoE Username</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No payments found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{format(new Date(payment.payment_date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono">{payment.mikrotik_users?.[0]?.username || "-"}</TableCell>
                        <TableCell>{payment.customers?.full_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.method)}
                            <span className="capitalize">{payment.method.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="calls" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={exportCallRecordsCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportCallRecordsPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>PPPoE Username</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No call records found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    callRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(new Date(record.call_date), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell className="font-mono">{record.mikrotik_users?.[0]?.username || "-"}</TableCell>
                        <TableCell>{record.customers?.full_name || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{record.notes}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={exportTransactionsCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportTransactionsPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No transactions found for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{format(new Date(t.transaction_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            t.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {t.type}
                          </span>
                        </TableCell>
                        <TableCell>{t.expense_categories?.name || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{t.description || "-"}</TableCell>
                        <TableCell className="capitalize">{t.payment_method.replace("_", " ")}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          t.type === "income" ? "text-green-600" : "text-red-600"
                        }`}>
                          {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(t)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentMethodSummary.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No payments in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethodSummary.map((method) => (
                        <div key={method.method} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3">
                            {getPaymentMethodIcon(method.method)}
                            <div>
                              <p className="font-medium capitalize">{method.method.replace("_", " ")}</p>
                              <p className="text-xs text-muted-foreground">{method.count} payments</p>
                            </div>
                          </div>
                          <span className="font-bold text-green-600">{formatCurrency(method.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Expense Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  {categorySummary.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No expenses in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {categorySummary.map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{cat.category}</p>
                            <p className="text-xs text-muted-foreground">{cat.count} transactions</p>
                          </div>
                          <span className="font-bold text-red-600">{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </DashboardLayout>
  );
}