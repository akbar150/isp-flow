import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Package, Undo2, Loader2 } from "lucide-react";

interface AssetAssignment {
  id: string;
  inventory_item_id: string;
  customer_id: string;
  assigned_date: string;
  returned_date: string | null;
  condition_on_assign: string | null;
  condition_on_return: string | null;
  technician_name: string | null;
  item_condition: string | null;
  notes: string | null;
  inventory_items: {
    id: string;
    serial_number: string | null;
    mac_address: string | null;
    status: string;
    products: {
      id: string;
      name: string;
      brand: string | null;
      model: string | null;
    } | null;
  } | null;
}

interface CustomerAssetsProps {
  customerId: string;
  customerName: string;
  canEdit: boolean;
}

const conditionOptions = ["New", "Good", "Fair", "Poor", "Damaged"];

export function CustomerAssets({ customerId, customerName, canEdit }: CustomerAssetsProps) {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssetAssignment | null>(null);
  const [returnCondition, setReturnCondition] = useState("Good");
  const [returnNotes, setReturnNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [customerId]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          *,
          inventory_items (
            id,
            serial_number,
            mac_address,
            status,
            products (
              id,
              name,
              brand,
              model
            )
          )
        `)
        .eq("customer_id", customerId)
        .order("assigned_date", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedAssignment) return;

    setProcessing(true);
    try {
      // Update assignment with return info
      const { error: assignmentError } = await supabase
        .from("asset_assignments")
        .update({
          returned_date: new Date().toISOString().split("T")[0],
          condition_on_return: returnCondition,
          notes: returnNotes || selectedAssignment.notes,
        })
        .eq("id", selectedAssignment.id);

      if (assignmentError) throw assignmentError;

      // Update inventory item status back to returned
      const { error: itemError } = await supabase
        .from("inventory_items")
        .update({ status: "returned" })
        .eq("id", selectedAssignment.inventory_item_id);

      if (itemError) throw itemError;

      toast({ title: "Device returned successfully" });
      setReturnDialogOpen(false);
      setSelectedAssignment(null);
      setReturnCondition("Good");
      setReturnNotes("");
      fetchAssignments();
    } catch (error) {
      console.error("Error returning device:", error);
      toast({
        title: "Error",
        description: "Failed to process return",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeAssignments = assignments.filter(a => !a.returned_date);
  const returnedAssignments = assignments.filter(a => a.returned_date);

  return (
    <div className="space-y-6">
      {/* Active Assignments */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Active Devices ({activeAssignments.length})
        </h3>

        {activeAssignments.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">No devices assigned to this customer</p>
        ) : (
          <div className="space-y-3">
            {activeAssignments.map((assignment) => (
              <div key={assignment.id} className="p-4 border rounded-lg bg-card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      {assignment.inventory_items?.products?.name || "Unknown Product"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {assignment.inventory_items?.products?.brand} {assignment.inventory_items?.products?.model}
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Serial Number</p>
                    <p className="font-mono">{assignment.inventory_items?.serial_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">MAC Address</p>
                    <p className="font-mono">{assignment.inventory_items?.mac_address || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Assigned Date</p>
                    <p>{format(new Date(assignment.assigned_date), "dd MMM yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Condition</p>
                    <p>{assignment.condition_on_assign || assignment.item_condition || "-"}</p>
                  </div>
                </div>

                {assignment.technician_name && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Installed by: {assignment.technician_name}
                  </p>
                )}

                {canEdit && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAssignment(assignment);
                        setReturnDialogOpen(true);
                      }}
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      Return Device
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Return History */}
      {returnedAssignments.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 text-muted-foreground">
            Return History ({returnedAssignments.length})
          </h3>
          <div className="space-y-2">
            {returnedAssignments.map((assignment) => (
              <div key={assignment.id} className="p-3 border rounded-lg bg-muted/30">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{assignment.inventory_items?.products?.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({assignment.inventory_items?.mac_address || assignment.inventory_items?.serial_number || "N/A"})
                    </span>
                  </div>
                  <Badge variant="secondary">Returned</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Returned on {format(new Date(assignment.returned_date!), "dd MMM yyyy")} • 
                  Condition: {assignment.condition_on_return || "N/A"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedAssignment?.inventory_items?.products?.name}</p>
              <p className="text-sm text-muted-foreground font-mono">
                {selectedAssignment?.inventory_items?.mac_address || selectedAssignment?.inventory_items?.serial_number}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Condition on Return *</Label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Any notes about the return..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReturn} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Return
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
