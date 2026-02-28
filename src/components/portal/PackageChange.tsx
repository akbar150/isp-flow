import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Package, ArrowRight, Loader2, CheckCircle, XCircle, Clock, Zap,
} from "lucide-react";

interface PackageInfo {
  id: string;
  name: string;
  speed_mbps: number;
  monthly_price: number;
  validity_days: number;
  description: string | null;
}

interface ChangeRequest {
  id: string;
  status: string;
  prorated_credit: number;
  prorated_charge: number;
  admin_notes: string | null;
  created_at: string;
  current_package: { name: string; speed_mbps: number; monthly_price: number } | null;
  requested_package: { name: string; speed_mbps: number; monthly_price: number } | null;
}

interface PackageChangeProps {
  customerId: string;
  userId: string;
  currentPackageId: string | null;
  currentPackageName: string | null;
  currentPackageSpeed: number | null;
  currentPackagePrice: number | null;
  daysRemaining: number;
}

export default function PackageChange({
  customerId, userId, currentPackageId, currentPackageName,
  currentPackageSpeed, currentPackagePrice, daysRemaining,
}: PackageChangeProps) {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch available packages
      const { data: pkgs } = await supabase
        .from("packages")
        .select("id, name, speed_mbps, monthly_price, validity_days, description")
        .eq("is_active", true)
        .order("monthly_price", { ascending: true });

      setPackages((pkgs || []) as PackageInfo[]);

      // Fetch existing requests
      const { data } = await supabase.functions.invoke("package-change", {
        body: { action: "list", customer_id: customerId },
      });
      if (data?.success) setRequests(data.requests || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasPendingRequest = requests.some((r) => r.status === "pending");

  const handleSelectPackage = (pkg: PackageInfo) => {
    if (pkg.id === currentPackageId) return;
    setSelectedPackage(pkg);
    setPassword("");
    setConfirmOpen(true);
  };

  const calculateProration = () => {
    if (!selectedPackage || !currentPackagePrice) return { credit: 0, charge: 0, net: 0 };
    const dailyCurrent = currentPackagePrice / 30;
    const dailyNew = selectedPackage.monthly_price / selectedPackage.validity_days;
    const credit = Math.round(daysRemaining * dailyCurrent);
    const charge = Math.round(daysRemaining * dailyNew);
    return { credit, charge, net: charge - credit };
  };

  const handleSubmit = async () => {
    if (!selectedPackage || !password) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("package-change", {
        body: {
          action: "submit",
          customer_id: customerId,
          current_package_id: currentPackageId,
          requested_package_id: selectedPackage.id,
          user_id: userId,
          password,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to submit");

      toast({ title: "Request Submitted", description: data.message });
      setConfirmOpen(false);
      setPassword("");
      fetchData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const proration = calculateProration();

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
      {/* Current Package */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Package</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{currentPackageName || "No package"}</p>
              <p className="text-sm text-muted-foreground">
                {currentPackageSpeed} Mbps • ৳{currentPackagePrice}/month • {daysRemaining} days remaining
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Request Banner */}
      {hasPendingRequest && (
        <div className="p-4 bg-accent/50 border border-accent rounded-lg flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm">You have a pending package change request. Please wait for admin approval.</p>
        </div>
      )}

      {/* Available Packages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Packages</CardTitle>
          <CardDescription>Select a package to upgrade or downgrade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => {
              const isCurrent = pkg.id === currentPackageId;
              const isUpgrade = currentPackagePrice ? pkg.monthly_price > currentPackagePrice : false;
              return (
                <button
                  key={pkg.id}
                  disabled={isCurrent || hasPendingRequest}
                  onClick={() => handleSelectPackage(pkg)}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/5 cursor-default"
                      : hasPendingRequest
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:border-primary hover:shadow-sm cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{pkg.name}</span>
                    {isCurrent && <Badge variant="secondary">Current</Badge>}
                    {!isCurrent && isUpgrade && (
                      <Badge className="bg-green-500/10 text-green-700 border-green-200">Upgrade</Badge>
                    )}
                    {!isCurrent && !isUpgrade && !isCurrent && (
                      <Badge variant="outline">Downgrade</Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold">৳{pkg.monthly_price}</p>
                  <p className="text-sm text-muted-foreground">{pkg.speed_mbps} Mbps • {pkg.validity_days} days</p>
                  {pkg.description && (
                    <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Request History */}
      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Request History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{req.current_package?.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{req.requested_package?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                    {req.status === "pending" && (
                      <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                    )}
                    {req.status === "approved" && (
                      <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
                    )}
                    {req.status === "rejected" && (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Package Change</DialogTitle>
            <DialogDescription>
              Review the details before submitting your request
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Current</p>
                  <p className="font-medium">{currentPackageName}</p>
                  <p className="text-sm">৳{currentPackagePrice}/mo</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="font-medium">{selectedPackage.name}</p>
                  <p className="text-sm">৳{selectedPackage.monthly_price}/mo</p>
                </div>
              </div>

              <div className="text-sm space-y-1 p-3 border rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit for remaining {daysRemaining} days</span>
                  <span className="text-green-600">-৳{proration.credit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New package charge ({daysRemaining} days)</span>
                  <span>৳{proration.charge}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                  <span>Net {proration.net >= 0 ? "charge" : "credit"}</span>
                  <span className={proration.net >= 0 ? "text-destructive" : "text-green-600"}>
                    {proration.net >= 0 ? "৳" : "-৳"}{Math.abs(proration.net)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Enter your password to confirm</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your portal password"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !password}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
