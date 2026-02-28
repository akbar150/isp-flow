import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Gift, Copy, CheckCircle, Clock, Users, Loader2, Share2, DollarSign,
} from "lucide-react";

interface Referral {
  id: string;
  status: string;
  credit_amount: number;
  credited_at: string | null;
  created_at: string;
  referred_customer: { user_id: string; full_name: string; status: string } | null;
}

interface ReferralProgramProps {
  customerId: string;
  customerName: string;
}

export default function ReferralProgram({ customerId, customerName }: ReferralProgramProps) {
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get or create referral code
      const { data: codeData } = await supabase.functions.invoke("referral-program", {
        body: { action: "get_or_create_code", customer_id: customerId },
      });
      if (codeData?.success) setReferralCode(codeData.code);

      // Get referrals
      const { data: refData } = await supabase.functions.invoke("referral-program", {
        body: { action: "get_referrals", customer_id: customerId },
      });
      if (refData?.success) {
        setReferrals(refData.referrals || []);
        setTotalCredit(refData.total_credit || 0);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      const shareText = `Join my ISP! Use my referral code: ${referralCode} when signing up. We both get bill credits! 🎁`;
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral message copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const shareText = `Join my ISP! Use my referral code: ${referralCode} when signing up. We both get bill credits! 🎁`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Referral Code", text: shareText });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const creditedCount = referrals.filter((r) => r.status === "credited").length;
  const pendingCount = referrals.filter((r) => r.status === "pending").length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Code Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Your Referral Code
          </CardTitle>
          <CardDescription>
            Share your code with friends. When they sign up and make their first payment, you both earn bill credits!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Input
                value={referralCode}
                readOnly
                className="text-center text-xl font-bold tracking-widest bg-muted"
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{referrals.length}</p>
            <p className="text-xs text-muted-foreground">Total Referrals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{creditedCount}</p>
            <p className="text-xs text-muted-foreground">Credited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">৳{totalCredit}</p>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Referred Friends</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No referrals yet. Share your code to start earning!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {ref.referred_customer?.full_name || "Pending signup"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ref.status === "pending" && (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />Pending
                      </Badge>
                    )}
                    {ref.status === "credited" && (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />৳{ref.credit_amount}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
