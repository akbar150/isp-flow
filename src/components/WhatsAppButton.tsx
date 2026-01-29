import { MessageCircle } from "lucide-react";
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
import { useState } from "react";
import { getWhatsAppUrl, generateWhatsAppMessage } from "@/services/billing/billingService";
import { useIspSettings } from "@/hooks/useIspSettings";

interface WhatsAppButtonProps {
  phone: string;
  customerName: string;
  userId: string;
  packageName: string;
  expiryDate: Date;
  amount: number;
  variant?: 'default' | 'icon';
  pppoeUsername?: string;
  pppoePassword?: string;
}

// Format message with WhatsApp formatting (bold, italic, etc.)
function formatWhatsAppMessage(
  customerName: string,
  userId: string,
  packageName: string,
  expiryDate: Date,
  amount: number,
  ispName: string,
  pppoeUsername?: string,
  pppoePassword?: string
): string {
  const formattedDate = expiryDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```monospace```
  let message = `🌐 *${ispName} - Payment Reminder*

Dear *${customerName}*,

📋 *Account Details:*
━━━━━━━━━━━━━━━
👤 PPPoE Username: \`${pppoeUsername || userId}\``;

  if (pppoePassword) {
    message += `
🔑 PPPoE Password: \`${pppoePassword}\``;
  }

  message += `
🆔 Customer ID: \`${userId}\`
📦 Package: *${packageName}*
📅 Expiry Date: *${formattedDate}*

💰 *Due Amount: ৳${amount}*
━━━━━━━━━━━━━━━

⚠️ Please pay before the expiry date to avoid service disconnection.

🙏 Thank you for choosing *${ispName}*!

_For any queries, please contact us._`;

  return message;
}

export function WhatsAppButton({
  phone,
  customerName,
  userId,
  packageName,
  expiryDate,
  amount,
  variant = 'default',
  pppoeUsername,
  pppoePassword
}: WhatsAppButtonProps) {
  const { ispName } = useIspSettings();
  
  const defaultMessage = formatWhatsAppMessage(
    customerName,
    userId,
    packageName,
    expiryDate,
    amount,
    ispName,
    pppoeUsername,
    pppoePassword
  );

  const [message, setMessage] = useState(defaultMessage);
  const [open, setOpen] = useState(false);

  const handleSend = () => {
    const url = getWhatsAppUrl(phone, message);
    window.open(url, '_blank');
    setOpen(false);
  };

  if (variant === 'icon') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-[hsl(142,70%,45%)]">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp Reminder</DialogTitle>
            <DialogDescription>
              Edit the message below before sending. Uses WhatsApp formatting: *bold*, _italic_, ~strikethrough~
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
                className="min-h-[280px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                💡 Tip: Use *bold*, _italic_, ~strikethrough~, and ```code``` for formatting
              </p>
            </div>
            <Button onClick={handleSend} className="whatsapp-btn w-full">
              <MessageCircle className="h-4 w-4" />
              Open WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="whatsapp-btn">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send WhatsApp Reminder</DialogTitle>
          <DialogDescription>
            Edit the message below before sending. Uses WhatsApp formatting: *bold*, _italic_, ~strikethrough~
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
              className="min-h-[280px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              💡 Tip: Use *bold*, _italic_, ~strikethrough~, and ```code``` for formatting
            </p>
          </div>
          <Button onClick={handleSend} className="whatsapp-btn w-full">
            <MessageCircle className="h-4 w-4" />
            Open WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
