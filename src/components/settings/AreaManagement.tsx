import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, MapPin } from "lucide-react";

interface Area {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function AreaManagement() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("name");

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error("Error fetching areas:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load areas",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Area name is required",
      });
      return;
    }

    try {
      if (editingArea) {
        const { error } = await supabase
          .from("areas")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          })
          .eq("id", editingArea.id);

        if (error) throw error;
        toast({ title: "Success", description: "Area updated" });
      } else {
        const { error } = await supabase.from("areas").insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Area added" });
      }

      setDialogOpen(false);
      setEditingArea(null);
      resetForm();
      fetchAreas();
    } catch (error: unknown) {
      console.error("Error saving area:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save area",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this area? Customers using this area will be affected.")) {
      return;
    }

    try {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Area deleted" });
      fetchAreas();
    } catch (error: unknown) {
      console.error("Error deleting area:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot delete area (may have assigned customers)",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
    });
  };

  const openEditDialog = (area: Area) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      description: area.description || "",
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingArea(null);
    resetForm();
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Areas / Zones</h3>
          <p className="text-sm text-muted-foreground">
            Manage geographic areas for customer assignments
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Area
        </Button>
      </div>

      <div className="border rounded-lg">
        {areas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No areas defined yet</p>
            <p className="text-sm">Add your first area to organize customers by location</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={area.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {area.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {area.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(area)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(area.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingArea(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingArea ? "Edit Area" : "Add Area"}
            </DialogTitle>
            <DialogDescription>
              {editingArea 
                ? "Update the area details below" 
                : "Create a new area for customer assignments"
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Area Name *</Label>
              <Input
                id="area-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Zone A, Downtown, etc."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-description">Description</Label>
              <Input
                id="area-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>
            <Button type="submit" className="w-full">
              {editingArea ? "Update Area" : "Add Area"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
