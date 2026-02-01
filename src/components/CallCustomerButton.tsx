import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Phone, PhoneCall } from "lucide-react";

interface CallCustomerButtonProps {
  customerName: string;
  primaryPhone: string;
  alternativePhone?: string | null;
  variant?: "icon" | "button" | "dropdown";
}

export function CallCustomerButton({
  customerName,
  primaryPhone,
  alternativePhone,
  variant = "icon",
}: CallCustomerButtonProps) {
  const [open, setOpen] = useState(false);

  const formatPhoneForDial = (phone: string) => {
    // Remove spaces and special characters except +
    return phone.replace(/[^\d+]/g, "");
  };

  const handleDial = (phone: string) => {
    window.location.href = `tel:${formatPhoneForDial(phone)}`;
    setOpen(false);
  };

  const content = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a number to call <span className="font-medium text-foreground">{customerName}</span>
      </p>
      
      <div className="space-y-2">
        {/* Primary Phone */}
        <button
          onClick={() => handleDial(primaryPhone)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-primary transition-colors group"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
            <PhoneCall className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-xs text-muted-foreground">Primary Number</p>
            <p className="font-medium text-base">{primaryPhone}</p>
          </div>
        </button>

        {/* Alternative Phone */}
        {alternativePhone && (
          <button
            onClick={() => handleDial(alternativePhone)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-primary transition-colors group"
          >
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-secondary/80">
              <Phone className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="text-left flex-1">
              <p className="text-xs text-muted-foreground">Alternative Number</p>
              <p className="font-medium text-base">{alternativePhone}</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );

  if (variant === "dropdown") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Call Customer
          </DropdownMenuItem>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Call Customer
            </DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Call customer">
            <PhoneCall className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <PhoneCall className="h-4 w-4 mr-2" />
            Call
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call Customer
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
