import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Wrench, LogOut, MapPin, Navigation, Camera, CheckCircle, Loader2,
  Clock, AlertTriangle, Play, Phone, User, Calendar, PenTool
} from "lucide-react";
import { format } from "date-fns";
import { useIspSettings } from "@/hooks/useIspSettings";

interface ServiceTask {
  id: string;
  customer_id: string;
  task_type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  notes: string | null;
  photos: string[];
  customers: {
    full_name: string;
    user_id: string;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export default function TechnicianPortal() {
  const navigate = useNavigate();
  const { ispName } = useIspSettings();
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<ServiceTask | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [signing, setSigning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchTasks(user.id);
  };

  const fetchTasks = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_tasks")
        .select("*, customers!service_tasks_customer_id_fkey(full_name, user_id, phone, address, latitude, longitude)")
        .eq("assigned_to", userId)
        .in("status", ["pending", "in_progress"])
        .order("priority", { ascending: true })
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      setTasks((data as unknown as ServiceTask[]) || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const startTask = async (task: ServiceTask) => {
    try {
      const { error } = await supabase
        .from("service_tasks")
        .update({ status: "in_progress" })
        .eq("id", task.id);

      if (error) throw error;
      setActiveTask({ ...task, status: "in_progress" });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: "in_progress" } : t));
      toast({ title: "Task started" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to start task", variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeTask) return;

    setUploading(true);
    try {
      const newPhotos: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${activeTask.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("task-photos")
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("task-photos").getPublicUrl(path);
        newPhotos.push(data.publicUrl);
      }

      setPhotos(prev => [...prev, ...newPhotos]);
      toast({ title: `${newPhotos.length} photo(s) uploaded` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openSignaturePad = () => {
    setSigning(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }, 100);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => setIsDrawing(false);

  const saveSignature = () => {
    if (!canvasRef.current) return;
    setSignatureData(canvasRef.current.toDataURL("image/png"));
    setSigning(false);
  };

  const completeTask = async () => {
    if (!activeTask) return;

    setCompleting(true);
    try {
      let gpsLat: number | null = null;
      let gpsLng: number | null = null;

      // Try to get GPS
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        gpsLat = position.coords.latitude;
        gpsLng = position.coords.longitude;
      } catch {
        // GPS not available, continue without it
      }

      const { error } = await supabase
        .from("service_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          notes: completionNotes || null,
          photos: photos,
          customer_signature: signatureData,
          gps_lat: gpsLat,
          gps_lng: gpsLng,
        })
        .eq("id", activeTask.id);

      if (error) throw error;

      toast({ title: "Task completed successfully!" });
      setActiveTask(null);
      setCompletionNotes("");
      setPhotos([]);
      setSignatureData(null);
      setTasks(prev => prev.filter(t => t.id !== activeTask.id));
    } catch (error) {
      toast({ title: "Error", description: "Failed to complete task", variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  const priorityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-blue-100 text-blue-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const priorityIcons: Record<string, typeof Clock> = {
    low: Clock,
    medium: Clock,
    high: AlertTriangle,
    urgent: AlertTriangle,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">{ispName}</h1>
              <p className="text-xs text-muted-foreground">Technician Portal</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-lg">
        {/* Active Task Completion View */}
        {activeTask ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Active Task</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTask(null)}>
                Back to List
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{activeTask.title}</CardTitle>
                <CardDescription>{activeTask.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{activeTask.customers?.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${activeTask.customers?.phone}`} className="text-primary underline">
                    {activeTask.customers?.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{activeTask.customers?.address}</span>
                </div>
                {activeTask.customers?.latitude && activeTask.customers?.longitude && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeTask.customers?.latitude},${activeTask.customers?.longitude}`, "_blank")}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate to Customer
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Completion Form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Complete Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Work done, observations..."
                    className="min-h-[80px]"
                  />
                </div>

                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Photos</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Take / Upload Photo"}
                  </Button>
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p, i) => (
                        <img key={i} src={p} alt={`Photo ${i+1}`} className="rounded-lg border object-cover aspect-square" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Signature */}
                <div className="space-y-2">
                  <Label>Customer Signature</Label>
                  {signatureData ? (
                    <div className="space-y-2">
                      <div className="border rounded-lg p-2 bg-background inline-block">
                        <img src={signatureData} alt="Signature" className="max-h-16" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSignatureData(null); openSignaturePad(); }}>
                        Redo
                      </Button>
                    </div>
                  ) : signing ? (
                    <div className="space-y-2">
                      <canvas
                        ref={canvasRef}
                        width={350}
                        height={120}
                        className="border rounded-lg cursor-crosshair touch-none w-full"
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handlePointerUp}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveSignature}>Save</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const ctx = canvasRef.current?.getContext("2d");
                          if (ctx && canvasRef.current) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
                        }}>Clear</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={openSignaturePad}>
                      <PenTool className="h-4 w-4 mr-2" />
                      Capture Signature
                    </Button>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={completeTask}
                  disabled={completing}
                >
                  {completing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  {completing ? "Completing..." : "Mark as Complete"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Task List */
          <div className="space-y-4">
            <h2 className="font-semibold">
              My Tasks ({tasks.length})
            </h2>
            {tasks.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm">No pending tasks assigned to you.</p>
                </CardContent>
              </Card>
            ) : (
              tasks.map((task) => {
                const PriorityIcon = priorityIcons[task.priority] || Clock;
                return (
                  <Card key={task.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{task.title}</h3>
                          {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                        </div>
                        <div className="flex gap-1.5">
                          <Badge className={priorityColors[task.priority]} variant="secondary">
                            <PriorityIcon className="h-3 w-3 mr-1" />
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{task.customers?.full_name} ({task.customers?.user_id})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="line-clamp-1">{task.customers?.address}</span>
                        </div>
                        {task.scheduled_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{format(new Date(task.scheduled_date), "dd MMM yyyy")}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {task.status === "pending" ? (
                          <Button size="sm" className="flex-1" onClick={() => startTask(task)}>
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Start Task
                          </Button>
                        ) : (
                          <Button size="sm" className="flex-1" onClick={() => setActiveTask(task)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Complete
                          </Button>
                        )}
                        {task.customers?.latitude && task.customers?.longitude && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${task.customers?.latitude},${task.customers?.longitude}`, "_blank")}
                          >
                            <Navigation className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`tel:${task.customers?.phone}`)}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
