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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  DollarSign,
  Wallet,
  CreditCard,
  Building,
  Loader2,
  Edit,
  Trash2,
  Phone,
  Download,
} from "lucide-react";

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
}

interface CallRecord {
  id: string;
  notes: string;
  call_date: string;
  customers: {
    user_id: string;
    full_name: string;
  } | null;
  profiles?: {
    full_name: string;
  } | null;
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
      const [transactionsRes, categoriesRes, paymentsRes, callRecordsRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*, expense_categories(name)")
          .gte("transaction_date", dateFilter.start)
          .lte("transaction_date", dateFilter.end)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("expense_categories")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("payments")
          .select("*, customers(user_id, full_name)")
          .gte("payment_date", dateFilter.start)
          .lte("payment_date", dateFilter.end)
          .order("payment_date", { ascending: false }),
        supabase
          .from("call_records")
          .select("*, customers(user_id, full_name)")
          .gte("call_date", dateFilter.start)
          .lte("call_date", dateFilter.end + "T23:59:59")
          .order("call_date", { ascending: false }),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      const typedTransactions = (transactionsRes.data || []).map((t) => ({
        ...t,
        type: t.type as "income" | "expense",
      }));

      setTransactions(typedTransactions);
      setCategories(categoriesRes.data || []);
      setPayments(paymentsRes.data as Payment[] || []);
      setCallRecords(callRecordsRes.data as CallRecord[] || []);
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
        created_by: user?.id,
      };

      if (editingTransaction) {
        const { error } = await supabase
          .from("transactions")
          .update(transactionData)
          .eq("id", editingTransaction.id);
        if (error) throw error;
        toast({ title: "Success", description: "Transaction updated" });
      } else {
        const { error } = await supabase.from("transactions").insert(transactionData);
        if (error) throw error;
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
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
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

  const exportCallRecords = () => {
    const headers = ["Date", "Customer ID", "Customer Name", "Notes"];
    const rows = callRecords.map(record => [
      format(new Date(record.call_date), "yyyy-MM-dd HH:mm"),
      record.customers?.user_id || "",
      record.customers?.full_name || "",
      record.notes.replace(/"/g, '""'),
    ]);
    
    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-records-${dateFilter.start}-to-${dateFilter.end}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Financial Reports</h1>
            <p className="text-muted-foreground">Track income, expenses, and profit/loss</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">This Month</SelectItem>
                <SelectItem value="previous">Last Month</SelectItem>
                <SelectItem value="last3">Last 3 Months</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {monthFilter === "custom" && (
              <>
                <Input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, start: e.target.value }))}
                  className="w-auto"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, end: e.target.value }))}
                  className="w-auto"
                />
              </>
            )}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: "income" | "expense") =>
                          setFormData((prev) => ({ ...prev, type: value }))
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
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, payment_method: value }))
                        }
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
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={formData.transaction_date}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, transaction_date: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  {formData.type === "expense" && (
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, category_id: value }))
                        }
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
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Optional description..."
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingTransaction ? "Update Transaction" : "Add Transaction"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards - Profit/Loss */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Payment Collections</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaymentIncome)}</div>
              <p className="text-xs text-muted-foreground">
                {payments.length} customer payments
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Other Income</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalTransactionIncome)}</div>
              <p className="text-xs text-muted-foreground">
                {transactions.filter((t) => t.type === "income").length} transactions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>
              <p className="text-xs text-muted-foreground">
                {transactions.filter((t) => t.type === "expense").length} transactions
              </p>
            </CardContent>
          </Card>
          <Card className={netProfit >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {netProfit >= 0 ? "Net Profit" : "Net Loss"}
              </CardTitle>
              <CreditCard className={`h-4 w-4 ${netProfit >= 0 ? "text-green-500" : "text-red-500"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(Math.abs(netProfit))}
              </div>
              <p className="text-xs text-muted-foreground">
                Income ৳{totalIncome.toLocaleString()} - Expenses ৳{totalExpense.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="by-method">By Payment Method</TabsTrigger>
            <TabsTrigger value="by-category">By Category</TabsTrigger>
            <TabsTrigger value="call-logs" className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Call Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Customer Payments</CardTitle>
                <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bkash">bKash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments found for the selected period
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.payment_date), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.customers?.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {payment.customers?.user_id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getPaymentMethodIcon(payment.method)}
                              <span className="capitalize">{payment.method.replace("_", " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for the selected period
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{format(new Date(t.transaction_date), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              t.type === "income"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              {t.type === "income" ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {t.type}
                            </span>
                          </TableCell>
                          <TableCell>{t.expense_categories?.name || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getPaymentMethodIcon(t.payment_method)}
                              <span className="capitalize">{t.payment_method.replace("_", " ")}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{t.description || "-"}</TableCell>
                          <TableCell className={`text-right font-medium ${
                            t.type === "income" ? "text-green-600" : "text-red-600"
                          }`}>
                            {t.type === "expense" ? "-" : ""}
                            {formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(t)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(t.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-method">
            <Card>
              <CardHeader>
                <CardTitle>Income by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentMethodSummary.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No data</p>
                  ) : (
                    paymentMethodSummary.map((item) => (
                      <div key={item.method} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getPaymentMethodIcon(item.method)}
                          <div>
                            <p className="font-medium capitalize">{item.method.replace("_", " ")}</p>
                            <p className="text-sm text-muted-foreground">{item.count} payments</p>
                          </div>
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-category">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categorySummary.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No expenses</p>
                  ) : (
                    categorySummary.map((item) => (
                      <div key={item.category} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.category}</p>
                          <p className="text-sm text-muted-foreground">{item.count} transactions</p>
                        </div>
                        <div className="text-xl font-bold text-red-600">
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="call-logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Call Records</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCallRecords}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : callRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No call records found for the selected period
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {callRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{format(new Date(record.call_date), "dd MMM yyyy HH:mm")}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{record.customers?.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {record.customers?.user_id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[400px]">
                            <p className="whitespace-pre-wrap">{record.notes}</p>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
