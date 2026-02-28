import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Smartphone, Loader2, CreditCard, CheckCircle, XCircle, AlertTriangle,
} from "lucide-react";

interface BkashPaymentProps {
  customerId: string;
  userId: string;
  totalDue: number;
  monthlyPrice: number;
}

export default function BkashPayment({ customerId, userId, totalDue, monthlyPrice }: BkashPaymentProps) {
  const [amount, setAmount] = useState(totalDue > 0 ? totalDue.toString() : monthlyPrice.toString());
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "redirecting" | "success" | "failed">("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultInfo, setResultInfo] = useState<{ trxID?: string; amount?: number; error?: string } | null>(null);

  const handlePayNow = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1) {
      toast({ title: "Error", description: "Minimum payment is ৳1", variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const initiatePayment = async () => {
    setLoading(true);
    setConfirmOpen(false);
    setPaymentStatus("redirecting");

    try {
      const callbackUrl = `${window.location.origin}/customer-portal?bkash_callback=true`;

      const { data, error } = await supabase.functions.invoke("bkash-payment", {
        body: {
          action: "create_payment",
          customer_id: customerId,
          amount: parseFloat(amount),
          callback_url: callbackUrl,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create payment");

      // Store payment ID for callback handling
      localStorage.setItem("bkash_payment_id", data.paymentID);

      // Redirect to bKash
      if (data.bkashURL) {
        window.location.href = data.bkashURL;
      } else {
        throw new Error("No bKash URL received");
      }
    } catch (err) {
      setPaymentStatus("failed");
      setResultInfo({ error: err instanceof Error ? err.message : "Payment failed" });
      toast({
        title: "Payment Failed",
        description: err instanceof Error ? err.message : "Could not initiate payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle bKash callback
  const handleCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentID = urlParams.get("paymentID") || localStorage.getItem("bkash_payment_id");
    const status = urlParams.get("status");

    if (!paymentID) return;

    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    localStorage.removeItem("bkash_payment_id");

    if (status === "cancel" || status === "failure") {
      setPaymentStatus("failed");
      setResultInfo({ error: status === "cancel" ? "Payment cancelled" : "Payment failed" });
      return;
    }

    // Execute payment
    setLoading(true);
    setPaymentStatus("redirecting");

    try {
      const { data, error } = await supabase.functions.invoke("bkash-payment", {
        body: { action: "execute_payment", payment_id: paymentID },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Payment verification failed");

      setPaymentStatus("success");
      setResultInfo({ trxID: data.trxID, amount: data.amount });
      toast({ title: "Payment Successful!", description: `TrxID: ${data.trxID}` });
    } catch (err) {
      setPaymentStatus("failed");
      setResultInfo({ error: err instanceof Error ? err.message : "Payment verification failed" });
    } finally {
      setLoading(false);
    }
  };

  // Check for callback on mount
  useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("bkash_callback") === "true" || urlParams.get("paymentID")) {
      handleCallback();
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Pay with bKash
        </CardTitle>
        <CardDescription>Pay your bill instantly using bKash mobile banking</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Payment Result */}
        {paymentStatus === "success" && resultInfo && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg mb-4 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-700">Payment Successful!</p>
              <p className="text-sm text-muted-foreground">Transaction ID: {resultInfo.trxID}</p>
              <p className="text-sm text-muted-foreground">Amount: ৳{resultInfo.amount}</p>
              <p className="text-xs text-muted-foreground mt-1">Your account has been updated automatically.</p>
            </div>
          </div>
        )}

        {paymentStatus === "failed" && resultInfo && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Payment Failed</p>
              <p className="text-sm text-muted-foreground">{resultInfo.error}</p>
            </div>
          </div>
        )}

        {paymentStatus === "redirecting" && (
          <div className="p-4 bg-accent/50 border rounded-lg mb-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Processing your payment...</p>
          </div>
        )}

        {/* Payment Form */}
        <div className="space-y-4 max-w-sm">
          {totalDue > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Current Due</p>
              <p className="text-2xl font-bold text-destructive">৳{totalDue.toLocaleString()}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pay-amount">Payment Amount (৳)</Label>
            <Input
              id="pay-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
            <div className="flex gap-2">
              {totalDue > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(totalDue.toString())}
                >
                  Full Due (৳{totalDue})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAmount(monthlyPrice.toString())}
              >
                Monthly (৳{monthlyPrice})
              </Button>
            </div>
          </div>

          <Button
            onClick={handlePayNow}
            disabled={loading || paymentStatus === "redirecting"}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            Pay ৳{amount || "0"} with bKash
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You will be redirected to bKash to complete the payment securely.
          </p>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm bKash Payment</DialogTitle>
            <DialogDescription>You are about to pay via bKash mobile banking</DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Amount</p>
            <p className="text-3xl font-bold">৳{parseFloat(amount || "0").toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Customer: {userId}</p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-accent/50 rounded-lg">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              You'll be redirected to bKash. Please complete the payment within 5 minutes.
              Do not close this window until the payment is complete.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={initiatePayment}>
              <Smartphone className="h-4 w-4 mr-2" />
              Proceed to bKash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
