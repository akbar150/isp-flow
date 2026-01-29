import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, AlertTriangle, Eye, EyeOff, Wifi } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  password: string;
  pppoeUsername?: string;
  pppoePassword?: string;
  onConfirm: () => void;
}

export function CredentialsModal({
  open,
  onOpenChange,
  userId,
  password,
  pppoeUsername,
  pppoePassword,
  onConfirm,
}: CredentialsModalProps) {
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedPppoeUsername, setCopiedPppoeUsername] = useState(false);
  const [copiedPppoePassword, setCopiedPppoePassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const copyToClipboard = async (text: string, type: "userId" | "password" | "pppoeUsername" | "pppoePassword") => {
    try {
      await navigator.clipboard.writeText(text);
      switch (type) {
        case "userId":
          setCopiedUserId(true);
          setTimeout(() => setCopiedUserId(false), 2000);
          break;
        case "password":
          setCopiedPassword(true);
          setTimeout(() => setCopiedPassword(false), 2000);
          break;
        case "pppoeUsername":
          setCopiedPppoeUsername(true);
          setTimeout(() => setCopiedPppoeUsername(false), 2000);
          break;
        case "pppoePassword":
          setCopiedPppoePassword(true);
          setTimeout(() => setCopiedPppoePassword(false), 2000);
          break;
      }
      const labels: Record<string, string> = {
        userId: "User ID",
        password: "Portal Password",
        pppoeUsername: "PPPoE Username",
        pppoePassword: "PPPoE Password",
      };
      toast({
        title: "Copied to clipboard",
        description: `${labels[type]} copied securely`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please manually select and copy the text",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = () => {
    setAcknowledged(false);
    setCopiedUserId(false);
    setCopiedPassword(false);
    setCopiedPppoeUsername(false);
    setCopiedPppoePassword(false);
    setShowPassword(false);
    setShowPppoePassword(false);
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Customer Credentials
          </DialogTitle>
          <DialogDescription>
            <span className="text-destructive font-medium">
              This is the only time these credentials will be shown.
            </span>{" "}
            Please copy and save them securely before closing this dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Portal Credentials Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Portal Login</h4>
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <div className="flex gap-2">
                <Input
                  id="userId"
                  value={userId}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(userId, "userId")}
                >
                  {copiedUserId ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Portal Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    readOnly
                    className="font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(password, "password")}
                >
                  {copiedPassword ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* PPPoE Credentials Section */}
          {pppoeUsername && pppoePassword && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                PPPoE Credentials
              </h4>
              <div className="space-y-2">
                <Label htmlFor="pppoeUsername">PPPoE Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="pppoeUsername"
                    value={pppoeUsername}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(pppoeUsername, "pppoeUsername")}
                  >
                    {copiedPppoeUsername ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pppoePassword">PPPoE Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="pppoePassword"
                      type={showPppoePassword ? "text" : "password"}
                      value={pppoePassword}
                      readOnly
                      className="font-mono pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPppoePassword(!showPppoePassword)}
                    >
                      {showPppoePassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(pppoePassword, "pppoePassword")}
                  >
                    {copiedPppoePassword ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <input
              type="checkbox"
              id="acknowledge"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="acknowledge" className="text-sm text-muted-foreground">
              I have saved these credentials securely
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!acknowledged}>
            I've Saved the Credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}