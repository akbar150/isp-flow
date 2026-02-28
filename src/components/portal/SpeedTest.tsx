import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Gauge, Download, Upload, Activity, RotateCcw, CheckCircle, AlertTriangle } from "lucide-react";

interface SpeedTestProps {
  packageSpeedMbps?: number;
}

interface SpeedResult {
  download: number;
  upload: number;
  ping: number;
}

type TestPhase = "idle" | "ping" | "download" | "upload" | "done";

export default function SpeedTest({ packageSpeedMbps }: SpeedTestProps) {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const measurePing = async (): Promise<number> => {
    const pings: number[] = [];
    const testUrl = "https://www.google.com/generate_204";
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      try {
        await fetch(testUrl, { mode: "no-cors", cache: "no-store" });
      } catch {
        // no-cors may throw, but timing still works
      }
      pings.push(performance.now() - start);
    }
    pings.sort((a, b) => a - b);
    return Math.round(pings[1] ?? pings[0]); // use 2nd lowest (remove outlier)
  };

  const measureDownload = async (signal: AbortSignal): Promise<number> => {
    // Use a large public file for download test
    const urls = [
      `https://speed.cloudflare.com/__down?bytes=${10 * 1024 * 1024}&cachebust=${Date.now()}`,
    ];
    const startTime = performance.now();
    let totalBytes = 0;
    const duration = 8000; // test for 8 seconds

    try {
      for (const url of urls) {
        if (signal.aborted) break;
        const response = await fetch(url, { signal, cache: "no-store" });
        const reader = response.body?.getReader();
        if (!reader) continue;

        while (true) {
          if (signal.aborted) break;
          const elapsed = performance.now() - startTime;
          if (elapsed > duration) break;

          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;

          const mbps = (totalBytes * 8) / (elapsed / 1000) / 1_000_000;
          setCurrentSpeed(Math.round(mbps * 10) / 10);
          setProgress(Math.min(100, (elapsed / duration) * 100));
        }
        try { reader.cancel(); } catch {}
      }
    } catch (e) {
      if (signal.aborted) return 0;
    }

    const elapsed = performance.now() - startTime;
    return Math.round((totalBytes * 8) / (elapsed / 1000) / 1_000_000 * 10) / 10;
  };

  const measureUpload = async (signal: AbortSignal): Promise<number> => {
    const chunkSize = 1 * 1024 * 1024; // 1MB chunks
    const data = new Uint8Array(chunkSize);
    const startTime = performance.now();
    let totalBytes = 0;
    const duration = 6000;

    try {
      for (let i = 0; i < 10; i++) {
        if (signal.aborted) break;
        const elapsed = performance.now() - startTime;
        if (elapsed > duration) break;

        await fetch(`https://speed.cloudflare.com/__up?cachebust=${Date.now()}-${i}`, {
          method: "POST",
          body: data,
          signal,
          cache: "no-store",
        });
        totalBytes += chunkSize;

        const mbps = (totalBytes * 8) / (elapsed / 1000 || 0.001) / 1_000_000;
        setCurrentSpeed(Math.round(mbps * 10) / 10);
        setProgress(Math.min(100, (elapsed / duration) * 100));
      }
    } catch (e) {
      if (signal.aborted) return 0;
    }

    const elapsed = performance.now() - startTime;
    return Math.round((totalBytes * 8) / (elapsed / 1000) / 1_000_000 * 10) / 10;
  };

  const runTest = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setResult(null);
    setProgress(0);
    setCurrentSpeed(0);

    // Ping
    setPhase("ping");
    const ping = await measurePing();
    if (controller.signal.aborted) return;

    // Download
    setPhase("download");
    setProgress(0);
    const download = await measureDownload(controller.signal);
    if (controller.signal.aborted) return;

    // Upload
    setPhase("upload");
    setProgress(0);
    setCurrentSpeed(0);
    const upload = await measureUpload(controller.signal);
    if (controller.signal.aborted) return;

    setResult({ download, upload, ping });
    setPhase("done");
    setProgress(100);
  }, []);

  const stopTest = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setProgress(0);
  };

  const getSpeedQuality = (speed: number) => {
    if (!packageSpeedMbps) return null;
    const ratio = speed / packageSpeedMbps;
    if (ratio >= 0.8) return { label: "Excellent", color: "bg-green-500" };
    if (ratio >= 0.5) return { label: "Good", color: "bg-yellow-500" };
    return { label: "Below Expected", color: "bg-red-500" };
  };

  const isRunning = phase !== "idle" && phase !== "done";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Speed Test
        </CardTitle>
        <CardDescription>
          Test your internet speed{packageSpeedMbps ? ` — Your package: ${packageSpeedMbps} Mbps` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Speedometer display */}
        <div className="flex flex-col items-center gap-4">
          {isRunning && (
            <>
              <div className="text-5xl font-bold text-primary tabular-nums">
                {currentSpeed}
              </div>
              <p className="text-sm text-muted-foreground capitalize">
                {phase === "ping" ? "Measuring latency..." : `Testing ${phase}...`}
              </p>
              <Progress value={progress} className="w-full max-w-xs" />
            </>
          )}

          {phase === "idle" && !result && (
            <div className="text-center py-4">
              <Gauge className="h-16 w-16 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Press Start to test your connection speed</p>
            </div>
          )}

          {phase === "done" && result && (
            <div className="grid grid-cols-3 gap-4 w-full max-w-md">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Download className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{result.download}</p>
                <p className="text-xs text-muted-foreground">Mbps Down</p>
                {packageSpeedMbps && (() => {
                  const q = getSpeedQuality(result.download);
                  return q ? <Badge className={`${q.color} mt-1 text-[10px]`}>{q.label}</Badge> : null;
                })()}
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Upload className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold">{result.upload}</p>
                <p className="text-xs text-muted-foreground">Mbps Up</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <Activity className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                <p className="text-2xl font-bold">{result.ping}</p>
                <p className="text-xs text-muted-foreground">ms Ping</p>
              </div>
            </div>
          )}

          {phase === "done" && result && packageSpeedMbps && (
            <div className="flex items-center gap-2 text-sm">
              {result.download >= packageSpeedMbps * 0.8 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Your speed matches your package ({packageSpeedMbps} Mbps)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>Speed is below your package ({packageSpeedMbps} Mbps). Try again or contact support.</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3">
          {!isRunning ? (
            <Button onClick={runTest} size="lg">
              {result ? <RotateCcw className="h-4 w-4 mr-2" /> : <Gauge className="h-4 w-4 mr-2" />}
              {result ? "Test Again" : "Start Speed Test"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={stopTest} size="lg">
              Stop Test
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Speed test uses Cloudflare's network. Results may vary based on network conditions, time of day, and device performance.
        </p>
      </CardContent>
    </Card>
  );
}
