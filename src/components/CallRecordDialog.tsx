import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Phone } from "lucide-react";

interface CallRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess?: () => void;
}

export function CallRecordDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: CallRecordDialogProps) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!notes.trim()) {
      toast({
        title: "Error",
        description: "Please enter call notes",
        variant: "destructive",
      });
      return;
    }

    if (notes.length > 2000) {
      toast({
        title: "Error",
        description: "Notes must be less than 2000 characters",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("call_records").insert({
        customer_id: customerId,
        notes: notes.trim(),
        called_by: user?.id || null,
        call_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast({ title: "Call record saved successfully" });
      setNotes("");
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Add Call Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Customer: {customerName}</p>
            <p className="text-xs text-muted-foreground">
              Recording call at: {new Date().toLocaleString("en-BD")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Call Notes (Unicode supported) *</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="কল নোট লিখুন... / Enter call notes..."
              className="min-h-[150px] font-normal"
              required
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/2000 characters
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Call Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
