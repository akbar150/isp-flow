import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription, 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIspSettings } from "@/hooks/useIspSettings";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface EmailButtonProps {
  email?: string;
  phone: string;
  customerName: string;
  userId: string;
  packageName: string;
  expiryDate: Date;
  amount: number;
  variant?: 'default' | 'icon';
  pppoeUsername?: string;
}

export function EmailButton({
  email,
  phone,
  customerName,
  userId,
  packageName,
  expiryDate,
  amount,
  variant = 'default',
  pppoeUsername
}: EmailButtonProps) {
  const { ispName } = useIspSettings();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(email || "");
  
  const formattedDate = format(expiryDate, 'dd MMM yyyy');
  
  const [subject, setSubject] = useState(`Payment Reminder - ${ispName}`);
  const [message, setMessage] = useState(`Dear ${customerName},

Your internet package "${packageName}" will expire on ${formattedDate}.

Account Details:
• PPPoE Username: ${pppoeUsername || userId}
• Customer ID: ${userId}
• Package: ${packageName}
• Due Amount: ৳${amount}

Please make the payment to avoid service disconnection.

Thank you for choosing ${ispName}.

Best Regards,
${ispName} Team`);

  const handleSend = async () => {
    if (!customerEmail) {
      toast({
        title: "Error",
        description: "Please enter customer email address",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-brevo', {
        body: {
          to: customerEmail,
          subject: subject,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">${ispName}</h1>
              </div>
              <div style="padding: 30px; background: #f9fafb;">
                <h2 style="color: #1f2937; margin-top: 0;">Payment Reminder</h2>
                <p style="color: #4b5563;">Dear <strong>${customerName}</strong>,</p>
                <p style="color: #4b5563;">Your internet package "<strong>${packageName}</strong>" will expire on <strong>${formattedDate}</strong>.</p>
                
                <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
                  <h3 style="color: #1f2937; margin-top: 0;">Account Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">PPPoE Username:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${pppoeUsername || userId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Customer ID:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${userId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Package:</td>
                      <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${packageName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Due Amount:</td>
                      <td style="padding: 8px 0; color: #dc2626; font-weight: 700; font-size: 18px;">৳${amount}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="color: #4b5563;">Please make the payment to avoid service disconnection.</p>
                <p style="color: #4b5563;">Thank you for choosing ${ispName}.</p>
                
                <p style="color: #6b7280; margin-top: 30px;">Best Regards,<br><strong>${ispName} Team</strong></p>
              </div>
              <div style="background: #1f2937; padding: 15px; text-align: center;">
                <p style="color: #9ca3af; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} ${ispName}. All rights reserved.</p>
              </div>
            </div>
          `,
        }
      });

      if (error) throw error;

      toast({
        title: "Email sent successfully",
        description: `Payment reminder sent to ${customerEmail}`,
      });
      setOpen(false);
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary">
            <Mail className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email Reminder</DialogTitle>
            <DialogDescription>
              Send a payment reminder email to the customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Customer Email *</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-2" />
          Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Email Reminder</DialogTitle>
          <DialogDescription>
            Send a payment reminder email to the customer
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Customer Email *</Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
