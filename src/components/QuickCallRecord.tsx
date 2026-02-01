import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Phone, Loader2 } from "lucide-react";

const CALL_OUTCOMES = [
  { value: "answered", label: "Answered" },
  { value: "unreachable", label: "Unreachable" },
  { value: "busy", label: "Busy" },
  { value: "no_answer", label: "No Answer" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "callback_requested", label: "Callback Requested" },
  { value: "payment_promised", label: "Payment Promised" },
  { value: "complaint", label: "Complaint" },
  { value: "other", label: "Other" },
];

interface QuickCallRecordProps {
  customerId: string;
  customerName: string;
  onSuccess?: () => void;
  variant?: "icon" | "button" | "dropdown";
}

export function QuickCallRecord({
  customerId,
  customerName,
  onSuccess,
  variant = "icon",
}: QuickCallRecordProps) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!outcome) {
      toast({
        title: "Error",
        description: "Please select a call outcome",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const outcomeLabel = CALL_OUTCOMES.find(o => o.value === outcome)?.label || outcome;
      const fullNotes = notes.trim() 
        ? `[${outcomeLabel}] ${notes.trim()}`
        : `[${outcomeLabel}]`;

      const { error } = await supabase.from("call_records").insert({
        customer_id: customerId,
        notes: fullNotes,
        called_by: user?.id || null,
        call_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: "Call record saved" });
      setOutcome("");
      setNotes("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving call record:", error);
      toast({
        title: "Error",
        description: "Failed to save call record",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <div className="space-y-4">
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm font-medium">{customerName}</p>
        <p className="text-xs text-muted-foreground">
          Recording call at: {new Date().toLocaleString("en-BD")}
        </p>
      </div>
      
      <Select value={outcome} onValueChange={setOutcome}>
        <SelectTrigger>
          <SelectValue placeholder="Select outcome..." />
        </SelectTrigger>
        <SelectContent>
          {CALL_OUTCOMES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="কল নোট... (optional)"
        className="min-h-[100px] text-sm"
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleSubmit}
          disabled={saving || !outcome}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );

  // For dropdown variant, use Dialog instead of Popover to prevent closing issues
  if (variant === "dropdown") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Phone className="h-4 w-4 mr-2" />
            Add Call Record
          </DropdownMenuItem>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Quick Call Record
            </DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  // For icon/button variants, use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Add call record">
            <Phone className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Phone className="h-4 w-4 mr-2" />
            Add Call
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-1 mb-3">
          <h4 className="font-medium text-sm">Quick Call Record</h4>
        </div>
        {formContent}
      </PopoverContent>
    </Popover>
  );
}
