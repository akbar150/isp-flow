import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Plus, User } from "lucide-react";
import { format } from "date-fns";
import { CallRecordDialog } from "./CallRecordDialog";

interface CallRecord {
  id: string;
  call_date: string;
  notes: string;
  called_by: string | null;
  created_at: string;
}

interface CustomerCallRecordsProps {
  customerId: string;
  customerName: string;
}

export function CustomerCallRecords({ customerId, customerName }: CustomerCallRecordsProps) {
  const [records, setRecords] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("call_records")
        .select("*")
        .eq("customer_id", customerId)
        .order("call_date", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error fetching call records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [customerId]);

  if (loading) {
    return (
      <div className="animate-pulse text-muted-foreground text-sm">
        Loading call records...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Call Records ({records.length})
        </h4>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Record
        </Button>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No call records yet
        </p>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {records.map((record) => (
            <div
              key={record.id}
              className="p-3 bg-muted/50 rounded-lg border border-border/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {format(new Date(record.call_date), "dd MMM yyyy, hh:mm a")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
            </div>
          ))}
        </div>
      )}

      <CallRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        customerName={customerName}
        onSuccess={fetchRecords}
      />
    </div>
  );
}
