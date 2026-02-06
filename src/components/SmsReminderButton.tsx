import { MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIspSettings } from "@/hooks/useIspSettings";
import { format } from "date-fns";

interface SmsReminderButtonProps {
  phone: string;
  customerName: string;
  userId: string;
  packageName: string;
  expiryDate: Date;
  amount: number;
  customerId: string;
  variant?: "default" | "icon" | "dropdown";
  pppoeUsername?: string;
  onSuccess?: () => void;
}

function applyTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  if (vars.ISPName) {
    result = result.replace(/\{ISP Name\}/g, vars.ISPName);
  }
  return result;
}

export function SmsReminderButton({
  phone,
  customerName,
  userId,
  packageName,
  expiryDate,
  amount,
  customerId,
  variant = "default",
  pppoeUsername,
  onSuccess,
}: SmsReminderButtonProps) {
  const { ispName, smsTemplate, loading } = useIspSettings();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const formattedDate = format(expiryDate, "dd MMM yyyy");

  const templateVars = useMemo(
    () => ({
      CustomerName: customerName,
      CustomerID: userId,
      PPPoEUsername: pppoeUsername || userId,
      PackageName: packageName,
      ExpiryDate: formattedDate,
      Amount: String(amount),
      ISPName: ispName,
    }),
    [customerName, userId, pppoeUsername, packageName, formattedDate, amount, ispName]
  );

  const computedMessage = useMemo(
    () => applyTemplateVars(smsTemplate, templateVars),
    [smsTemplate, templateVars]
  );

  const [message, setMessage] = useState(computedMessage);

  useEffect(() => {
    if (!loading) {
      setMessage(computedMessage);
    }
  }, [computedMessage, loading]);

  // Detect if message contains Bangla/Unicode characters
  const isUnicode = /[^\u0000-\u007F]/.test(message);
  const charLimit = isUnicode ? 70 : 160;
  const charCount = message.length;

  const handleSend = async () => {
    if (!phone) {
      toast({ title: "Error", description: "No phone number available", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-routemobile", {
        body: {
          phone,
          message,
          type: isUnicode ? "unicode" : "text",
        },
      });

      if (error) throw new Error(error.message || "Failed to send SMS");
      if (!data?.success) throw new Error(data?.error || "SMS sending failed");

      // Log the reminder
      await supabase.from("reminder_logs").insert({
        customer_id: customerId,
        reminder_type: "expiry_day" as const,
        channel: "sms",
        message,
      });

      toast({
        title: "SMS Sent!",
        description: `Reminder SMS sent to ${phone}`,
      });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("SMS Send Error:", error);
      toast({
        title: "SMS Failed",
        description: error instanceof Error ? error.message : "Failed to send SMS",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const dialogContent = (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Send SMS Reminder</DialogTitle>
        <DialogDescription>
          Edit the message below before sending. {isUnicode ? "Unicode/Bangla" : "Plain text"} mode.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 mt-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Sending to: <span className="font-medium text-foreground">{phone}</span>
          </p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
            dir="auto"
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              Variables: {"{CustomerName}"}, {"{Amount}"}, {"{ExpiryDate}"}, {"{ISPName}"}
            </p>
            <p className={`text-xs font-medium ${charCount > charLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount}/{charLimit} chars
              {charCount > charLimit && ` (${Math.ceil(charCount / charLimit)} SMS)`}
            </p>
          </div>
        </div>
        <Button onClick={handleSend} disabled={sending} className="w-full">
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              Send SMS
            </>
          )}
        </Button>
      </div>
    </DialogContent>
  );

  if (variant === "dropdown") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <MessageSquare className="h-4 w-4 mr-2 text-accent-foreground" />
            Send SMS
          </DropdownMenuItem>
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  if (variant === "icon") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-accent-foreground">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          SMS
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
