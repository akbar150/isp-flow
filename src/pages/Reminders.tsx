import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isBefore, isAfter, isEqual } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        supabase.from('customers_safe').select('*, packages(name, monthly_price)'),
        supabase
          .from('reminder_logs')
          .select('*, customers(user_id, full_name)')
          .order('sent_at', { ascending: false })
          .limit(50),
      ]);

      if (customersRes.error) throw customersRes.error;
      setCustomers(customersRes.data as Customer[] || []);
      setReminderLogs(logsRes.data as ReminderLog[] || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const categorizeCustomers = () => {
    const threeDaysBefore: Customer[] = [];
    const oneDayBefore: Customer[] = [];
    const expiryDay: Customer[] = [];
    const threeDaysOverdue: Customer[] = [];

    customers.forEach(customer => {
      const expiry = new Date(customer.expiry_date);
      expiry.setHours(0, 0, 0, 0);

      const threeDaysFromNow = addDays(today, 3);
      const oneDayFromNow = addDays(today, 1);
      const threeDaysAgo = addDays(today, -3);

      if (isEqual(expiry, threeDaysFromNow)) {
        threeDaysBefore.push(customer);
      } else if (isEqual(expiry, oneDayFromNow)) {
        oneDayBefore.push(customer);
      } else if (isEqual(expiry, today)) {
        expiryDay.push(customer);
      } else if (isEqual(expiry, threeDaysAgo)) {
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
                <th>User ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Package</th>
                <th>Expiry</th>
                <th>Due</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {customerList.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-mono text-sm">{customer.user_id}</td>
                  <td className="font-medium">{customer.full_name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.packages?.name || 'N/A'}</td>
                  <td>{format(new Date(customer.expiry_date), 'dd MMM yyyy')}</td>
                  <td className="amount-due">৳{customer.total_due}</td>
                  <td>
                    <WhatsAppButton
                      phone={customer.phone}
                      customerName={customer.full_name}
                      userId={customer.user_id}
                      packageName={customer.packages?.name || 'Internet'}
                      expiryDate={new Date(customer.expiry_date)}
                      amount={customer.packages?.monthly_price || customer.total_due}
                    />
                  </td>
                </tr>
              ))}
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
        <p className="page-description">Send payment reminders to customers via WhatsApp</p>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList>
          <TabsTrigger value="schedule">Reminder Schedule</TabsTrigger>
          <TabsTrigger value="logs">Reminder Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          {renderCustomerTable(threeDaysBefore, "3 Days Before Expiry")}
          {renderCustomerTable(oneDayBefore, "1 Day Before Expiry")}
          {renderCustomerTable(expiryDay, "Expiring Today")}
          {renderCustomerTable(threeDaysOverdue, "3 Days Overdue")}
        </TabsContent>

        <TabsContent value="logs">
          <div className="form-section overflow-x-auto">
            <h3 className="form-section-title">Recent Reminder Logs</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
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
                      <td>
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
