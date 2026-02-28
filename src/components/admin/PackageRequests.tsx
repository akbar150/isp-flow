import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight, Loader2, CheckCircle, XCircle, Clock, Package, RefreshCw,
} from "lucide-react";

interface PackageRequest {
  id: string;
  customer_id: string;
  status: string;
  prorated_credit: number;
  prorated_charge: number;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  current_package: { name: string; speed_mbps: number; monthly_price: number } | null;
  requested_package: { name: string; speed_mbps: number; monthly_price: number } | null;
  customer: { user_id: string; full_name: string; phone: string } | null;
}

export default function PackageRequests() {
  const [requests, setRequests] = useState<PackageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PackageRequest | null>(null);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("package_change_requests")
        .select(`
          *,
          current_package:packages!package_change_requests_current_package_id_fkey(name, speed_mbps, monthly_price),
          requested_package:packages!package_change_requests_requested_package_id_fkey(name, speed_mbps, monthly_price),
          customer:customers!package_change_requests_customer_id_fkey(user_id, full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data || []) as unknown as PackageRequest[]);
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (request: PackageRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setDialogAction(action);
    setAdminNotes("");
  };

  const processRequest = async () => {
    if (!selectedRequest || !dialogAction) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("package-change", {
        body: {
          action: dialogAction,
          request_id: selectedRequest.id,
          admin_notes: adminNotes || undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed");

      toast({ title: "Success", description: data.message });
      setDialogAction(null);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Operation failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Package Change Requests
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
            )}
          </CardTitle>
          <CardDescription>Manage customer package upgrade/downgrade requests</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No package change requests yet</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const net = req.prorated_charge - req.prorated_credit;
              return (
                <div key={req.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {req.customer?.full_name} ({req.customer?.user_id})
                      </p>
                      <p className="text-sm text-muted-foreground">{req.customer?.phone}</p>
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

                  <div className="flex items-center gap-3 text-sm">
                    <div className="p-2 bg-muted rounded">
                      <p className="font-medium">{req.current_package?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.current_package?.speed_mbps} Mbps • ৳{req.current_package?.monthly_price}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="p-2 bg-primary/5 border border-primary/20 rounded">
                      <p className="font-medium">{req.requested_package?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.requested_package?.speed_mbps} Mbps • ৳{req.requested_package?.monthly_price}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-muted-foreground">Net {net >= 0 ? "charge" : "credit"}</p>
                      <p className={`font-semibold ${net >= 0 ? "text-destructive" : "text-green-600"}`}>
                        {net >= 0 ? "৳" : "-৳"}{Math.abs(net)}
                      </p>
                    </div>
                  </div>

                  {req.admin_notes && (
                    <p className="text-sm text-muted-foreground italic">Notes: {req.admin_notes}</p>
                  )}

                  {req.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => handleAction(req, "approve")}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(req, "reject")}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!dialogAction} onOpenChange={() => { setDialogAction(null); setSelectedRequest(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve" : "Reject"} Package Change
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? "This will update the customer's package, recalculate billing, and adjust their expiry date."
                : "The customer will be notified that their request was rejected."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedRequest && (
              <div className="text-sm p-3 bg-muted rounded-lg">
                <p><strong>{selectedRequest.customer?.full_name}</strong> ({selectedRequest.customer?.user_id})</p>
                <p>{selectedRequest.current_package?.name} → {selectedRequest.requested_package?.name}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add a note..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAction(null)}>Cancel</Button>
            <Button
              onClick={processRequest}
              disabled={processing}
              variant={dialogAction === "reject" ? "destructive" : "default"}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogAction === "approve" ? "Approve & Apply" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
