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
import { format } from "date-fns";
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

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const [dateFilter, setDateFilter] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transactionsRes, categoriesRes] = await Promise.all([
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
      ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      // Cast type field to ensure proper typing
      const typedTransactions = (transactionsRes.data || []).map((t) => ({
        ...t,
        type: t.type as "income" | "expense",
      }));

      setTransactions(typedTransactions);
      setCategories(categoriesRes.data || []);
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
    } catch (error: any) {
      console.error("Error saving transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save transaction",
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
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete transaction",
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

  // Calculate summaries
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netBalance = totalIncome - totalExpense;

  const paymentSummary: PaymentSummary[] = transactions
    .filter((t) => t.type === "income")
    .reduce((acc: PaymentSummary[], t) => {
      const existing = acc.find((p) => p.method === t.payment_method);
      if (existing) {
        existing.total += Number(t.amount);
        existing.count += 1;
      } else {
        acc.push({ method: t.payment_method, total: Number(t.amount), count: 1 });
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Financial Reports</h1>
            <p className="text-muted-foreground">Track income, expenses, and financial activity</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(netBalance)}
              </div>
              <p className="text-xs text-muted-foreground">Income - Expenses</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="income">Income by Method</TabsTrigger>
            <TabsTrigger value="expenses">Expenses by Category</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
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
                        <TableHead>Category/Method</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{format(new Date(t.transaction_date), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                t.type === "income"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {t.type === "income" ? "Income" : "Expense"}
                            </span>
                          </TableCell>
                          <TableCell className="flex items-center gap-2">
                            {getPaymentMethodIcon(t.payment_method)}
                            {t.type === "expense"
                              ? t.expense_categories?.name || "Uncategorized"
                              : t.payment_method.replace("_", " ")}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {t.description || "-"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              t.type === "income" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {t.type === "income" ? "+" : "-"}
                            {formatCurrency(t.amount)}
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
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income">
            <Card>
              <CardHeader>
                <CardTitle>Income by Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentSummary.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No income recorded for the selected period
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentSummary.map((p) => (
                      <div
                        key={p.method}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          {getPaymentMethodIcon(p.method)}
                          <div>
                            <p className="font-medium capitalize">
                              {p.method.replace("_", " ")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {p.count} transaction{p.count > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(p.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categorySummary.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No expenses recorded for the selected period
                  </div>
                ) : (
                  <div className="space-y-4">
                    {categorySummary.map((c) => (
                      <div
                        key={c.category}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium">{c.category}</p>
                          <p className="text-sm text-muted-foreground">
                            {c.count} transaction{c.count > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-xl font-bold text-red-600">
                          {formatCurrency(c.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
