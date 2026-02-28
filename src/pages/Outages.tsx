import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Plus, WifiOff, CheckCircle, Clock, Loader2, MapPin, Send, Users
} from "lucide-react";
import { format } from "date-fns";

interface Area {
  id: string;
  name: string;
}

interface Outage {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "resolved";
  area_ids: string[];
  estimated_restore: string | null;
  actual_restore: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function Outages() {
  const { user } = useAuth();
  const [outages, setOutages] = useState<Outage[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [broadcasting, setBroadcasting] = useState<string | null>(null);

  const [newOutage, setNewOutage] = useState({
    title: "",
    description: "",
    area_ids: [] as string[],
    estimated_restore: "",
  });

  useEffect(() => {
    fetchOutages();
    fetchAreas();
  }, []);

  const fetchOutages = async () => {
    try {
      const { data, error } = await supabase
        .from("network_outages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOutages((data || []) as Outage[]);
    } catch (error) {
      console.error("Error fetching outages:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    const { data } = await supabase.from("areas").select("id, name").order("name");
    setAreas(data || []);
  };

  const getAreaNames = (areaIds: string[]) => {
    return areaIds
      .map(id => areas.find(a => a.id === id)?.name || "Unknown")
      .join(", ");
  };

  const toggleAreaSelection = (areaId: string) => {
    setNewOutage(prev => ({
      ...prev,
      area_ids: prev.area_ids.includes(areaId)
        ? prev.area_ids.filter(id => id !== areaId)
        : [...prev.area_ids, areaId],
    }));
  };

  const handleCreate = async () => {
    if (!newOutage.title || newOutage.area_ids.length === 0) {
      toast({ title: "Error", description: "Title and at least one area are required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("network_outages").insert({
        title: newOutage.title,
        description: newOutage.description || null,
        area_ids: newOutage.area_ids,
        estimated_restore: newOutage.estimated_restore ? new Date(newOutage.estimated_restore).toISOString() : null,
        created_by: user?.id || null,
      });

      if (error) throw error;
      toast({ title: "Success", description: "Outage reported successfully" });
      setCreateOpen(false);
      setNewOutage({ title: "", description: "", area_ids: [], estimated_restore: "" });
      fetchOutages();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (outageId: string) => {
    try {
      const { error } = await supabase
        .from("network_outages")
        .update({ status: "resolved" as any, actual_restore: new Date().toISOString() })
        .eq("id", outageId);

      if (error) throw error;
      toast({ title: "Resolved", description: "Outage marked as resolved" });
      fetchOutages();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBroadcastWhatsApp = async (outage: Outage) => {
    setBroadcasting(outage.id);
    try {
      // Fetch customers in affected areas
      const { data: customers } = await supabase
        .from("customers_safe")
        .select("full_name, phone, area_id")
        .in("area_id", outage.area_ids);

      if (!customers || customers.length === 0) {
        toast({ title: "No customers", description: "No customers found in the affected areas", variant: "destructive" });
        return;
      }

      const areaNames = getAreaNames(outage.area_ids);
      const restoreTime = outage.estimated_restore
        ? format(new Date(outage.estimated_restore), "dd MMM yyyy hh:mm a")
        : "to be announced";

      // Open WhatsApp for each customer (batch - user sends manually)
      const message = `⚠️ *Network Outage Alert*\n\n${outage.title}\n\nAffected Areas: ${areaNames}\nEstimated Restore: ${restoreTime}\n\n${outage.description || ""}\n\nWe apologize for the inconvenience.`;

      // For bulk, we'll open the first customer's WhatsApp as a demo
      // In production, this would use the SMS/WhatsApp API
      const firstCustomer = customers[0];
      if (firstCustomer?.phone) {
        const phone = firstCustomer.phone.replace(/[^0-9]/g, "");
        const encoded = encodeURIComponent(message);
        window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
      }

      toast({
        title: "Broadcast initiated",
        description: `${customers.length} customers in affected areas. First WhatsApp opened. Use SMS for bulk broadcast.`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setBroadcasting(null);
    }
  };

  const activeOutages = outages.filter(o => o.status === "active");
  const resolvedOutages = outages.filter(o => o.status === "resolved");

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Network Outages</h1>
          <p className="page-description">Report and track network outages by area</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Report Outage</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Report Network Outage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={newOutage.title}
                  onChange={e => setNewOutage({ ...newOutage, title: e.target.value })}
                  placeholder="e.g. Fiber cut in Mirpur area"
                  maxLength={200}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newOutage.description}
                  onChange={e => setNewOutage({ ...newOutage, description: e.target.value })}
                  placeholder="Details about the outage..."
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div>
                <Label>Affected Areas *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {areas.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-2">No areas configured. Add areas in Settings.</p>
                  ) : (
                    areas.map(area => (
                      <label key={area.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newOutage.area_ids.includes(area.id)}
                          onChange={() => toggleAreaSelection(area.id)}
                          className="rounded"
                        />
                        {area.name}
                      </label>
                    ))
                  )}
                </div>
                {newOutage.area_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{newOutage.area_ids.length} area(s) selected</p>
                )}
              </div>
              <div>
                <Label>Estimated Restore Time</Label>
                <Input
                  type="datetime-local"
                  value={newOutage.estimated_restore}
                  onChange={e => setNewOutage({ ...newOutage, estimated_restore: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Report Outage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Active Outages</p>
              <p className="stat-card-value text-[hsl(var(--status-expired))]">{activeOutages.length}</p>
            </div>
            <div className="metric-icon metric-icon-danger"><WifiOff className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Resolved Today</p>
              <p className="stat-card-value text-[hsl(var(--status-active))]">
                {resolvedOutages.filter(o => o.actual_restore && format(new Date(o.actual_restore), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")).length}
              </p>
            </div>
            <div className="metric-icon metric-icon-success"><CheckCircle className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-card-label">Total Outages</p>
              <p className="stat-card-value">{outages.length}</p>
            </div>
            <div className="metric-icon metric-icon-primary"><Clock className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* Active Outages */}
      {activeOutages.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-[hsl(var(--status-expired))]" />
            Active Outages
          </h2>
          <div className="space-y-4">
            {activeOutages.map(outage => (
              <Card key={outage.id} className="border-l-4 border-l-[hsl(var(--status-expired))]">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{outage.title}</h3>
                        <Badge className="bg-[hsl(var(--status-expired)/0.15)] text-[hsl(var(--status-expired))]">Active</Badge>
                      </div>
                      {outage.description && (
                        <p className="text-sm text-muted-foreground mb-2">{outage.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getAreaNames(outage.area_ids)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started: {format(new Date(outage.created_at), "dd MMM yyyy hh:mm a")}
                        </span>
                        {outage.estimated_restore && (
                          <span className="flex items-center gap-1">
                            ETA: {format(new Date(outage.estimated_restore), "dd MMM yyyy hh:mm a")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBroadcastWhatsApp(outage)}
                        disabled={broadcasting === outage.id}
                      >
                        {broadcasting === outage.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Notify
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="default">
                            <CheckCircle className="h-4 w-4 mr-1" /> Resolve
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Resolve Outage?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Mark "{outage.title}" as resolved? This will update the Customer Portal.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleResolve(outage.id)}>Resolve</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Outages History */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Outage History</h2>
        {resolvedOutages.length === 0 && activeOutages.length === 0 ? (
          <div className="form-section text-center py-12">
            <WifiOff className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No outages recorded</p>
          </div>
        ) : resolvedOutages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resolved outages yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Areas</th>
                  <th>Started</th>
                  <th>Resolved</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resolvedOutages.slice(0, 20).map(outage => {
                  const duration = outage.actual_restore
                    ? Math.round((new Date(outage.actual_restore).getTime() - new Date(outage.created_at).getTime()) / (1000 * 60))
                    : null;
                  const durationStr = duration !== null
                    ? duration >= 60
                      ? `${Math.floor(duration / 60)}h ${duration % 60}m`
                      : `${duration}m`
                    : "N/A";

                  return (
                    <tr key={outage.id}>
                      <td className="font-medium">{outage.title}</td>
                      <td className="text-sm">{getAreaNames(outage.area_ids)}</td>
                      <td className="text-sm">{format(new Date(outage.created_at), "dd MMM yyyy hh:mm a")}</td>
                      <td className="text-sm">{outage.actual_restore ? format(new Date(outage.actual_restore), "dd MMM yyyy hh:mm a") : "-"}</td>
                      <td className="font-mono text-sm">{durationStr}</td>
                      <td>
                        <Badge className="bg-[hsl(var(--status-active)/0.15)] text-[hsl(var(--status-active))]">Resolved</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
