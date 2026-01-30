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
import { useState, useEffect, useMemo } from "react";
import { getWhatsAppUrl } from "@/services/billing/billingService";
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
// Supports both {ISPName} and {ISP Name} formats for backwards compatibility
function applyTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Replace both formats: {ISPName} and {ISP Name}
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  // Also handle legacy {ISP Name} format
  if (vars.ISPName) {
    result = result.replace(/\{ISP Name\}/g, vars.ISPName);
  }
  // Handle {user_id} as alias for {CustomerID}
  if (vars.CustomerID) {
    result = result.replace(/\{user_id\}/g, vars.CustomerID);
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
  const { ispName, whatsappTemplate, loading } = useIspSettings();
  const [open, setOpen] = useState(false);
  
  const formattedDate = expiryDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  // Build template variables - memoized for performance
  const templateVars = useMemo(() => ({
    CustomerName: customerName,
    CustomerID: userId,
    PPPoEUsername: pppoeUsername || userId,
    PPPoEPassword: pppoePassword || '',
    PackageName: packageName,
    ExpiryDate: formattedDate,
    Amount: String(amount),
    ISPName: ispName,
  }), [customerName, userId, pppoeUsername, pppoePassword, packageName, formattedDate, amount, ispName]);
  
  // Calculate message from template - reactively updates when template or vars change
  const computedMessage = useMemo(() => {
    return applyTemplateVars(whatsappTemplate, templateVars);
  }, [whatsappTemplate, templateVars]);

  // State for editable message - initialize with computed message
  const [message, setMessage] = useState(computedMessage);

  // Update message when computed message changes (template or settings update)
  useEffect(() => {
    if (!loading) {
      setMessage(computedMessage);
    }
  }, [computedMessage, loading]);

  const handleSend = () => {
    // Debug: Check for any character issues
    console.log("=== WhatsApp Debug ===");
    console.log("Raw message:", message);
    console.log("Message length:", message.length);
    
    // Check for any replacement characters or encoding issues
    const hasReplacementChar = message.includes('\uFFFD');
    const hasQuestionMark = /[\?\uFFFD]/.test(message);
    console.log("Has replacement char (�):", hasReplacementChar);
    
    // Log first few emoji codepoints to verify encoding
    const emojiMatches = message.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
    console.log("Emojis found:", emojiMatches.slice(0, 5).join(', '));
    console.log("Emoji codepoints:", emojiMatches.slice(0, 5).map(e => e.codePointAt(0)?.toString(16)));
    
    const url = getWhatsAppUrl(phone, message);
    console.log("WhatsApp URL length:", url.length);
    console.log("WhatsApp URL:", url);
    
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
