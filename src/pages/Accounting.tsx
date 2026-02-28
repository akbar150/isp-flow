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
  DialogDescription,
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
  Building,
  Loader2,
  Edit,
  Trash2,
  Download,
  FileText,
} from "lucide-react";
import { exportToCSV, exportToPDF, formatDateForExport, formatCurrencyForExport } from "@/lib/exportUtils";

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

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  type?: "income" | "expense";
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
    mikrotik_users?: { username: string }[];
  } | null;
}

export default function Accounting() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
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
  const [typeFilter, setTypeFilter] = useState("all");
  
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
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
      const [transactionsRes, expenseCategoriesRes, paymentsRes] = await Promise.all([
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
      ]);

      if (transactionsRes.error) throw transactionsRes.error;

      const typedTransactions = (transactionsRes.data || []).map((t) => ({
        ...t,
        type: t.type as "income" | "expense",
      }));

      setTransactions(typedTransactions);
      
      const allCategories = expenseCategoriesRes.data || [];
      setExpenseCategories(allCategories.filter((c: any) => !c.category_type || c.category_type === 'expense'));
      setIncomeCategories(allCategories.filter((c: any) => c.category_type === 'income'));
      
      setPayments(paymentsRes.data as Payment[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load accounting data",
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
        category_id: formData.category_id || null,
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

  const openNewDialog = (type: "income" | "expense") => {
    setEditingTransaction(null);
    setFormData({
      type,
      amount: "",
      payment_method: "cash",
      category_id: "",
      description: "",
      transaction_date: format(new Date(), "yyyy-MM-dd"),
    });
    setDialogOpen(true);
  };

  // Filter payments by method
  const filteredPayments = paymentMethodFilter === "all" 
    ? payments 
    : payments.filter(p => p.method === paymentMethodFilter);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (paymentMethodFilter !== "all" && t.payment_method !== paymentMethodFilter) return false;
    return true;
  });

  // Calculate summaries
  // Payment collections = cash received from customers
  const totalPaymentCollections = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  
  // Income transactions = profit from sales, other income (NOT revenue)
  const totalTransactionIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Total cash inflow = collections + other income
  const totalCashInflow = totalPaymentCollections + totalTransactionIncome;

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Net Profit = Income (profit entries) - Expenses
  // Collections are cash flow, not profit (the profit is already in income transactions)
  const netProfit = totalTransactionIncome - totalExpense;
  
  // Cash Balance = Collections + Income - Expenses
  const cashBalance = totalCashInflow - totalExpense;

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

  const incomeCategorySummary: CategorySummary[] = transactions
    .filter((t) => t.type === "income")
    .reduce((acc: CategorySummary[], t) => {
      const categoryName = t.expense_categories?.name || "Other Income";
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

  const exportTransactionsCSV = () => {
    const data = filteredTransactions.map(t => ({
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
    const data = filteredTransactions.map(t => ({
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

  const categories = formData.type === "expense" ? expenseCategories : incomeCategories;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounting</h1>
          <p className="page-description">Track income, expenses, and profit/loss</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openNewDialog("income")} variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            Add Income
          </Button>
          <Button onClick={() => openNewDialog("expense")}>
            <TrendingDown className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
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

        <div className="flex items-center gap-2">
          <Label>Type:</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Collections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalPaymentCollections)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cash from customers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Other Income/Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalTransactionIncome)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Asset profit & extras
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalExpense)}
                </p>
                <p className="text-xs text-muted-foreground">
                  All recorded expenses
                </p>
              </CardContent>
            </Card>

            <Card className={cashBalance >= 0 ? "border-blue-200 bg-blue-50/50" : "border-orange-200 bg-orange-50/50"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cash Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${cashBalance >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                  {formatCurrency(Math.abs(cashBalance))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Inflow - Expenses
                </p>
              </CardContent>
            </Card>

            <Card className={netProfit >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net {netProfit >= 0 ? "Profit" : "Loss"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(netProfit))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Income - Expenses
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>All Transactions</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportTransactionsCSV}>
                      <Download className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportTransactionsPDF}>
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>
                              {format(new Date(t.transaction_date), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                t.type === "income" 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {t.type === "income" ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {t.type}
                              </span>
                            </TableCell>
                            <TableCell>{t.expense_categories?.name || "-"}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1">
                                {getPaymentMethodIcon(t.payment_method)}
                                {t.payment_method.replace("_", " ")}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {t.description || "-"}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              t.type === "income" ? "text-green-600" : "text-red-600"
                            }`}>
                              {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(t)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(t.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Income by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Payment collections as a category */}
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="font-medium">Customer Payments</p>
                          <p className="text-sm text-muted-foreground">{payments.length} payments</p>
                        </div>
                        <p className="font-bold text-green-600">{formatCurrency(totalPaymentCollections)}</p>
                      </div>
                      {incomeCategorySummary.map((item) => (
                        <div key={item.category} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{item.category}</p>
                            <p className="text-sm text-muted-foreground">{item.count} entries</p>
                          </div>
                          <p className="font-bold text-green-600">{formatCurrency(item.total)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Expenses by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categorySummary.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No expenses recorded</p>
                      ) : (
                        categorySummary.map((item) => (
                          <div key={item.category} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">{item.category}</p>
                              <p className="text-sm text-muted-foreground">{item.count} entries</p>
                            </div>
                            <p className="font-bold text-red-600">{formatCurrency(item.total)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Collections by Payment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {paymentMethodSummary.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No payments recorded</p>
                      ) : (
                        paymentMethodSummary.map((item) => (
                          <div key={item.method} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getPaymentMethodIcon(item.method)}
                              <div>
                                <p className="font-medium capitalize">{item.method.replace("_", " ")}</p>
                                <p className="text-sm text-muted-foreground">{item.count} payments</p>
                              </div>
                            </div>
                            <p className="font-bold">{formatCurrency(item.total)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={netProfit >= 0 ? "border-green-300" : "border-red-300"}>
                  <CardHeader>
                    <CardTitle className="text-lg">Profit & Loss Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span>Total Income</span>
                        <span className="font-bold text-green-600">{formatCurrency(totalTransactionIncome)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                        <span>Total Expenses</span>
                        <span className="font-bold text-red-600">-{formatCurrency(totalExpense)}</span>
                      </div>
                      <hr />
                      <div className={`flex justify-between items-center p-4 rounded-lg ${
                        netProfit >= 0 ? "bg-green-100" : "bg-red-100"
                      }`}>
                        <span className="font-medium text-lg">
                          Net {netProfit >= 0 ? "Profit" : "Loss"}
                        </span>
                        <span className={`font-bold text-2xl ${
                          netProfit >= 0 ? "text-green-700" : "text-red-700"
                        }`}>
                          {formatCurrency(Math.abs(netProfit))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Add/Edit Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingTransaction(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? "Edit Transaction" : `Add ${formData.type === "income" ? "Income" : "Expense"}`}
            </DialogTitle>
            <DialogDescription>
              {formData.type === "income" 
                ? "Record external income or other revenue sources"
                : "Record business expenses and costs"
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as "income" | "expense", category_id: "" })}
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
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
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
                <Label>Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
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
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>

            <Button type="submit" className="w-full">
              {editingTransaction ? "Update Transaction" : "Add Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
