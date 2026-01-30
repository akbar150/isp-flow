import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import api from "@/lib/api";
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
      const outcomeLabel = CALL_OUTCOMES.find(o => o.value === outcome)?.label || outcome;
      const fullNotes = notes.trim() 
        ? `[${outcomeLabel}] ${notes.trim()}`
        : `[${outcomeLabel}]`;

      const response = await api.post("/activity/call-records", {
        customer_id: customerId,
        notes: fullNotes,
        call_date: new Date().toISOString(),
      });

      if (response.data.success) {
        toast({ title: "Call record saved" });
        setOutcome("");
        setNotes("");
        setOpen(false);
        onSuccess?.();
      } else {
        throw new Error(response.data.error);
      }
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

  const popoverContent = (
    <div className="space-y-3">
      <div className="font-medium text-sm">Quick Call Record</div>
      <p className="text-xs text-muted-foreground">{customerName}</p>
      
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
        className="min-h-[80px] text-sm"
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

  // For dropdown variant, render as a DropdownMenuItem that triggers the popover
  if (variant === "dropdown") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Phone className="h-4 w-4 mr-2" />
            Add Call Record
          </DropdownMenuItem>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end" side="left">
          {popoverContent}
        </PopoverContent>
      </Popover>
    );
  }

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
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}
