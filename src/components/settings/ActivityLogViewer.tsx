import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/TablePagination";
import { Loader2, Search, Activity } from "lucide-react";
import { format } from "date-fns";

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

const PAGE_SIZE = 50;

export function ActivityLogViewer() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    fetchLogs();
  }, [currentPage, entityFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("activity_logs")
        .select("*, profiles:user_id(full_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setLogs((data || []) as unknown as ActivityLog[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(s) ||
      log.entity_type?.toLowerCase().includes(s) ||
      log.profiles?.full_name?.toLowerCase().includes(s)
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes("create") || action.includes("insert") || action.includes("add")) {
      return <Badge className="bg-[hsl(var(--status-active)/0.15)] text-[hsl(var(--status-active))]">{action}</Badge>;
    }
    if (action.includes("delete") || action.includes("remove")) {
      return <Badge className="bg-destructive/15 text-destructive">{action}</Badge>;
    }
    if (action.includes("update") || action.includes("edit")) {
      return <Badge className="bg-primary/15 text-primary">{action}</Badge>;
    }
    return <Badge variant="secondary">{action}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Logs
        </h3>
        <p className="text-sm text-muted-foreground">
          View system activity and user actions for auditing
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by action, entity, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="package">Package</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>{totalCount} total entries</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), "dd MMM yyyy, hh:mm a")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.profiles?.full_name || "System"}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="text-sm">
                      {log.entity_type && (
                        <span className="capitalize">{log.entity_type}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details).slice(0, 80) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <TablePagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
