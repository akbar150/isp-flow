import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, AlertTriangle, Shield } from "lucide-react";
import { format } from "date-fns";

interface DataType {
  key: string;
  label: string;
  table: string;
  dateColumn: string;
  description: string;
}

const DATA_TYPES: DataType[] = [
  { key: "payments", label: "Payments", table: "payments", dateColumn: "payment_date", description: "Payment records for the selected date" },
  { key: "billing_records", label: "Billing Records", table: "billing_records", dateColumn: "billing_date", description: "Billing cycle records" },
  { key: "call_records", label: "Call Records", table: "call_records", dateColumn: "call_date", description: "Customer call logs" },
  { key: "reminder_logs", label: "Reminder Logs", table: "reminder_logs", dateColumn: "sent_at", description: "Sent reminder notifications" },
  { key: "transactions", label: "Transactions", table: "transactions", dateColumn: "transaction_date", description: "Accounting transactions" },
  { key: "activity_logs", label: "Activity Logs", table: "activity_logs", dateColumn: "created_at", description: "System activity logs" },
  { key: "attendance", label: "Attendance", table: "attendance", dateColumn: "date", description: "Employee attendance records" },
];

export function DataResetPanel() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [affectedCounts, setAffectedCounts] = useState<Record<string, number>>({});
  const [confirmText, setConfirmText] = useState("");

  if (!isSuperAdmin) {
    return (
      <div className="p-6 bg-muted rounded-lg border border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="h-5 w-5" />
          <span>Only Super Admins can access data reset functionality</span>
        </div>
      </div>
    );
  }

  const toggleDataType = (key: string) => {
    setSelectedTypes(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const handlePreviewReset = async () => {
    if (!selectedDate || selectedTypes.length === 0) {
      toast({ 
        title: "Selection Required", 
        description: "Please select a date and at least one data type",
        variant: "destructive" 
      });
      return;
    }

    // Get counts for each selected type
    const counts: Record<string, number> = {};
    
    for (const typeKey of selectedTypes) {
      const dataType = DATA_TYPES.find(t => t.key === typeKey);
      if (!dataType) continue;

      try {
        // Build appropriate query based on column type
        let query = supabase.from(dataType.table as any).select('id', { count: 'exact', head: true });
        
        if (dataType.dateColumn === "created_at" || dataType.dateColumn === "sent_at" || dataType.dateColumn === "call_date") {
          // Timestamp columns - use range
          const startOfDay = `${selectedDate}T00:00:00`;
          const endOfDay = `${selectedDate}T23:59:59`;
          query = query.gte(dataType.dateColumn, startOfDay).lte(dataType.dateColumn, endOfDay);
        } else {
          // Date columns - direct equality
          query = query.eq(dataType.dateColumn, selectedDate);
        }

        const { count, error } = await query;
        
        if (!error) {
          counts[typeKey] = count || 0;
        }
      } catch (err) {
        console.error(`Error counting ${typeKey}:`, err);
        counts[typeKey] = 0;
      }
    }

    setAffectedCounts(counts);
    setShowConfirmDialog(true);
  };

  const handleConfirmReset = async () => {
    if (confirmText !== "RESET") {
      toast({ 
        title: "Confirmation Required", 
        description: "Please type RESET to confirm",
        variant: "destructive" 
      });
      return;
    }

    setResetting(true);
    let deletedTotal = 0;
    const errors: string[] = [];

    for (const typeKey of selectedTypes) {
      const dataType = DATA_TYPES.find(t => t.key === typeKey);
      if (!dataType) continue;

      try {
        let query = supabase.from(dataType.table as any).delete();
        
        if (dataType.dateColumn === "created_at" || dataType.dateColumn === "sent_at" || dataType.dateColumn === "call_date") {
          const startOfDay = `${selectedDate}T00:00:00`;
          const endOfDay = `${selectedDate}T23:59:59`;
          query = query.gte(dataType.dateColumn, startOfDay).lte(dataType.dateColumn, endOfDay);
        } else {
          query = query.eq(dataType.dateColumn, selectedDate);
        }

        const { error } = await query;
        
        if (error) {
          errors.push(`${dataType.label}: ${error.message}`);
        } else {
          deletedTotal += affectedCounts[typeKey] || 0;
        }
      } catch (err) {
        errors.push(`${dataType.label}: Unknown error`);
      }
    }

    setResetting(false);
    setShowConfirmDialog(false);
    setConfirmText("");
    setSelectedTypes([]);
    setSelectedDate("");

    if (errors.length > 0) {
      toast({ 
        title: "Partial Reset Complete", 
        description: `Deleted ${deletedTotal} records. Errors: ${errors.join(", ")}`,
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Data Reset Complete", 
        description: `Successfully deleted ${deletedTotal} records for ${format(new Date(selectedDate), 'dd MMM yyyy')}`
      });
    }
  };

  const totalAffected = Object.values(affectedCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h4 className="font-medium text-destructive">Danger Zone</h4>
            <p className="text-sm text-muted-foreground">
              This action will permanently delete data for the selected date. This cannot be undone.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select Date to Reset</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
          />
          <p className="text-xs text-muted-foreground">
            All selected data types for this specific date will be deleted
          </p>
        </div>

        <div className="space-y-2">
          <Label>Select Data Types to Reset</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {DATA_TYPES.map((dataType) => (
              <div
                key={dataType.key}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedTypes.includes(dataType.key) 
                    ? "border-destructive bg-destructive/5" 
                    : "border-border hover:border-muted-foreground"
                }`}
                onClick={() => toggleDataType(dataType.key)}
              >
                <Checkbox
                  checked={selectedTypes.includes(dataType.key)}
                  onCheckedChange={() => toggleDataType(dataType.key)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{dataType.label}</div>
                  <div className="text-xs text-muted-foreground">{dataType.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button 
          variant="destructive" 
          onClick={handlePreviewReset}
          disabled={!selectedDate || selectedTypes.length === 0}
          className="w-full sm:w-auto"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Preview Reset
        </Button>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Reset
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You are about to permanently delete <strong>{totalAffected} records</strong> for{" "}
                <strong>{selectedDate && format(new Date(selectedDate), 'dd MMM yyyy')}</strong>
              </p>
              
              <div className="bg-muted p-3 rounded-lg space-y-1">
                {selectedTypes.map(typeKey => {
                  const dataType = DATA_TYPES.find(t => t.key === typeKey);
                  return (
                    <div key={typeKey} className="flex justify-between text-sm">
                      <span>{dataType?.label}</span>
                      <span className="font-mono">{affectedCounts[typeKey] || 0} records</span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-text">Type <strong>RESET</strong> to confirm</Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              disabled={confirmText !== "RESET" || resetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {resetting ? "Resetting..." : "Delete Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
