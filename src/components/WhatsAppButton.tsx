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

// Apply template variables to a message template
function applyTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
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
  const { ispName, whatsappTemplate } = useIspSettings();
  
  const formattedDate = expiryDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  // Build template variables
  const templateVars: Record<string, string> = {
    CustomerName: customerName,
    CustomerID: userId,
    PPPoEUsername: pppoeUsername || userId,
    PPPoEPassword: pppoePassword || '',
    PackageName: packageName,
    ExpiryDate: formattedDate,
    Amount: String(amount),
    ISPName: ispName,
  };
  
  // Use saved template if available, otherwise use default
  const defaultMessage = applyTemplateVars(whatsappTemplate, templateVars);

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
