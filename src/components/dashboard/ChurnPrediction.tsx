import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Brain, AlertTriangle, TrendingDown, Loader2, RefreshCw, Shield, Lightbulb } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ChurnPrediction {
  customer_id: string;
  user_id: string;
  name: string;
  risk_level: "high" | "medium";
  risk_score: number;
  reasons: string[];
  recommended_actions: string[];
}

interface ChurnResult {
  predictions: ChurnPrediction[];
  summary: string;
  total_analyzed: number;
  analyzed_at: string;
}

export function ChurnPredictionWidget() {
  const [result, setResult] = useState<ChurnResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-churn");
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast({ title: "Churn analysis complete", description: `Analyzed ${data.total_analyzed} customers` });
    } catch (err: any) {
      toast({
        title: "Analysis failed",
        description: err.message || "Could not run churn analysis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const highRisk = result?.predictions.filter(p => p.risk_level === "high") || [];
  const mediumRisk = result?.predictions.filter(p => p.risk_level === "medium") || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Churn Prediction
              </CardTitle>
              <CardDescription>
                AI-powered analysis of customer churn risk based on payment patterns, tickets, and account status
              </CardDescription>
            </div>
            <Button onClick={runAnalysis} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {loading ? "Analyzing..." : result ? "Re-analyze" : "Run Analysis"}
            </Button>
          </div>
        </CardHeader>

        {result && (
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm">{result.summary}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Analyzed {result.total_analyzed} customers • {new Date(result.analyzed_at).toLocaleString()}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">High Risk</p>
                      <p className="text-2xl font-bold">{highRisk.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Medium Risk</p>
                      <p className="text-2xl font-bold">{mediumRisk.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Safe</p>
                      <p className="text-2xl font-bold">{result.total_analyzed - highRisk.length - mediumRisk.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Predictions Table */}
            {result.predictions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.predictions.map((p) => (
                      <TableRow key={p.customer_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.user_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.risk_level === "high" ? "destructive" : "secondary"}>
                            {p.risk_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  p.risk_score >= 70 ? "bg-destructive" : "bg-secondary"
                                }`}
                                style={{ width: `${p.risk_score}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono">{p.risk_score}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="details" className="border-none">
                              <AccordionTrigger className="py-1 text-sm hover:no-underline">
                                View details
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs font-medium flex items-center gap-1 mb-1">
                                      <AlertTriangle className="h-3 w-3" /> Risk Factors
                                    </p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5">
                                      {p.reasons.map((r, i) => (
                                        <li key={i}>• {r}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium flex items-center gap-1 mb-1">
                                      <Lightbulb className="h-3 w-3" /> Recommended Actions
                                    </p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5">
                                      {p.recommended_actions.map((a, i) => (
                                        <li key={i}>• {a}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No at-risk customers found. All customers appear healthy! 🎉
              </p>
            )}
          </CardContent>
        )}

        {!result && !loading && (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Click "Run Analysis" to analyze customer churn risk using AI</p>
              <p className="text-xs mt-1">Analyzes payment patterns, ticket history, and account status</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
