import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Loader2, PenTool, Check } from "lucide-react";
import { format } from "date-fns";

interface Contract {
  id: string;
  start_date: string;
  end_date: string;
  terms_text: string;
  auto_renew: boolean;
  early_termination_fee: number;
  signature_data: string | null;
  signed_at: string | null;
  status: string;
}

interface ContractViewProps {
  customerId: string;
}

export default function ContractView({ customerId }: ContractViewProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchContracts();
  }, [customerId]);

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContracts((data as Contract[]) || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setLoading(false);
    }
  };

  const startSigning = (contractId: string) => {
    setSigning(contractId);
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
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
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

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const submitSignature = async () => {
    if (!signing || !canvasRef.current) return;

    const signatureData = canvasRef.current.toDataURL("image/png");

    try {
      const { error } = await supabase
        .from("contracts")
        .update({
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", signing);

      if (error) throw error;
      toast({ title: "Contract signed successfully!" });
      setSigning(null);
      fetchContracts();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save signature", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      pending_signature: "bg-yellow-100 text-yellow-800",
      active: "bg-green-100 text-green-800",
      expired: "bg-red-100 text-red-800",
      terminated: "bg-destructive/10 text-destructive",
    };
    return <Badge className={colors[status] || ""}>{status.replace("_", " ")}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (contracts.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No contracts available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => (
        <Card key={contract.id}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Service Agreement
              </span>
              {getStatusBadge(contract.status)}
            </CardTitle>
            <CardDescription>
              {format(new Date(contract.start_date), "dd MMM yyyy")} → {format(new Date(contract.end_date), "dd MMM yyyy")}
              {contract.auto_renew && " • Auto-renew"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {contract.terms_text}
            </div>

            {contract.signature_data ? (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Signed on {contract.signed_at ? format(new Date(contract.signed_at), "dd MMM yyyy HH:mm") : ""}
                </p>
                <div className="border rounded-lg p-2 bg-background inline-block">
                  <img src={contract.signature_data} alt="Your signature" className="max-h-20" />
                </div>
              </div>
            ) : contract.status === "pending_signature" ? (
              signing === contract.id ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Draw your signature below:</p>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="border rounded-lg cursor-crosshair touch-none w-full max-w-[400px]"
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={submitSignature}>
                      <Check className="h-4 w-4 mr-1" />
                      Submit Signature
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearCanvas}>
                      Clear
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSigning(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => startSigning(contract.id)}>
                  <PenTool className="h-4 w-4 mr-2" />
                  Sign Contract
                </Button>
              )
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
