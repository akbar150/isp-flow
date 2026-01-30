import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { EmailButton } from "@/components/EmailButton";
import { QuickCallRecord } from "@/components/QuickCallRecord";
import { QuickPaymentRecord } from "@/components/QuickPaymentRecord";
import api from "@/lib/api";
import { format, startOfDay, differenceInDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MikrotikUser {
  id: string;
  username: string;
  status: 'enabled' | 'disabled';
}

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  expiry_date: string;
  status: 'active' | 'expiring' | 'expired' | 'suspended';
  total_due: number;
  packages: {
    name: string;
    monthly_price: number;
  } | null;
  mikrotik_users: MikrotikUser[] | null;
}

interface ReminderLog {
  id: string;
  customer_id: string;
  reminder_type: string;
  channel: string;
  message: string | null;
  sent_at: string;
  customers: {
    user_id: string;
    full_name: string;
  } | null;
}

export default function Reminders() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, logsRes] = await Promise.all([
        api.get('/customers'),
        api.get('/reminders/logs?limit=50'),
      ]);

      setCustomers(customersRes.data.customers || []);
      setReminderLogs(logsRes.data.logs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const today = startOfDay(new Date());

  const categorizeCustomers = () => {
    const threeDaysBefore: Customer[] = [];
    const oneDayBefore: Customer[] = [];
    const expiryDay: Customer[] = [];
    const threeDaysOverdue: Customer[] = [];

    customers.forEach(customer => {
      // Skip suspended customers
      if (customer.status === 'suspended') return;
      
      const expiry = startOfDay(new Date(customer.expiry_date));
      const daysDiff = differenceInDays(expiry, today);

      // 3 days before expiry (expiry is 3 days in the future)
      if (daysDiff === 3) {
        threeDaysBefore.push(customer);
      }
      // 1 day before expiry (expiry is 1 day in the future)
      else if (daysDiff === 1) {
        oneDayBefore.push(customer);
      }
      // Expiring today (expiry is today)
      else if (daysDiff === 0) {
        expiryDay.push(customer);
      }
      // 3 days overdue (expired 3 days ago, daysDiff would be -3)
      // Also include customers who are MORE than 3 days overdue (daysDiff <= -3)
      else if (daysDiff <= -3 && daysDiff >= -30) {
        threeDaysOverdue.push(customer);
      }
    });

    return { threeDaysBefore, oneDayBefore, expiryDay, threeDaysOverdue };
  };

  const { threeDaysBefore, oneDayBefore, expiryDay, threeDaysOverdue } = categorizeCustomers();

  const renderCustomerTable = (customerList: Customer[], title: string) => (
    <div className="form-section">
      <h3 className="form-section-title">{title} ({customerList.length})</h3>
      {customerList.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">No customers in this category</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="hidden sm:table-cell">PPPoE Username</th>
                <th>Name</th>
                <th className="hidden md:table-cell">Phone</th>
                <th className="hidden lg:table-cell">Package</th>
                <th>Expiry</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customerList.map((customer) => {
                const pppoeUsername = customer.mikrotik_users?.[0]?.username || '';
                const daysOverdue = Math.abs(differenceInDays(startOfDay(new Date(customer.expiry_date)), today));
                return (
                  <tr key={customer.id}>
                    <td className="font-mono text-sm hidden sm:table-cell">{pppoeUsername || <span className="text-muted-foreground">Not set</span>}</td>
                    <td>
                      <div>
                        <p className="font-medium">{customer.full_name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{pppoeUsername}</p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">{customer.phone}</td>
                    <td className="hidden lg:table-cell">{customer.packages?.name || 'N/A'}</td>
                    <td>
                      <div>
                        <p>{format(new Date(customer.expiry_date), 'dd MMM yyyy')}</p>
                        {differenceInDays(startOfDay(new Date(customer.expiry_date)), today) < 0 && (
                          <p className="text-xs text-destructive">{daysOverdue} days overdue</p>
                        )}
                      </div>
                    </td>
                    <td className="amount-due">৳{customer.total_due}</td>
                    <td>
                      <div className="flex items-center gap-1 flex-wrap">
                        <QuickCallRecord
                          customerId={customer.id}
                          customerName={customer.full_name}
                          onSuccess={fetchData}
                        />
                        <WhatsAppButton
                          phone={customer.phone}
                          customerName={customer.full_name}
                          userId={customer.user_id}
                          packageName={customer.packages?.name || 'Internet'}
                          expiryDate={new Date(customer.expiry_date)}
                          amount={customer.packages?.monthly_price || customer.total_due}
                          variant="icon"
                          pppoeUsername={pppoeUsername}
                        />
                        <EmailButton
                          phone={customer.phone}
                          customerName={customer.full_name}
                          userId={customer.user_id}
                          packageName={customer.packages?.name || 'Internet'}
                          expiryDate={new Date(customer.expiry_date)}
                          amount={customer.packages?.monthly_price || customer.total_due}
                          variant="icon"
                          pppoeUsername={pppoeUsername}
                        />
                        <QuickPaymentRecord
                          customerId={customer.id}
                          customerName={customer.full_name}
                          dueAmount={customer.total_due}
                          monthlyPrice={customer.packages?.monthly_price || 0}
                          onSuccess={fetchData}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading reminders...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Reminders</h1>
        <p className="page-description">Send payment reminders to customers via WhatsApp, Email & SMS</p>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="schedule">Reminder Schedule</TabsTrigger>
          <TabsTrigger value="logs">Reminder Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          {renderCustomerTable(threeDaysBefore, "3 Days Before Expiry")}
          {renderCustomerTable(oneDayBefore, "1 Day Before Expiry")}
          {renderCustomerTable(expiryDay, "Expiring Today")}
          {renderCustomerTable(threeDaysOverdue, "3+ Days Overdue")}
        </TabsContent>

        <TabsContent value="logs">
          <div className="form-section overflow-x-auto">
            <h3 className="form-section-title">Recent Reminder Logs</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="hidden sm:table-cell">Type</th>
                  <th>Channel</th>
                </tr>
              </thead>
              <tbody>
                {reminderLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No reminder logs yet
                    </td>
                  </tr>
                ) : (
                  reminderLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{format(new Date(log.sent_at), 'dd MMM yyyy HH:mm')}</td>
                      <td>
                        <div>
                          <p className="font-medium">{log.customers?.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.customers?.user_id}
                          </p>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="status-badge bg-blue-100 text-blue-700">
                          {log.reminder_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="capitalize">{log.channel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
