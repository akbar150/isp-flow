import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Download, HardDrive, Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface BackupLog {
  id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  record_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function BackupManagement() {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    const { data, error } = await supabase
      .from("backup_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch backups:", error);
    } else {
      setBackups((data as BackupLog[]) || []);
    }
    setLoading(false);
  };

  const runBackupNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-customer-backup");

      if (error) throw error;

      toast({
        title: "Backup completed",
        description: `${data.record_count} customers exported successfully.`,
      });
      fetchBackups();
    } catch (error: any) {
      toast({
        title: "Backup failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const downloadBackup = async (backup: BackupLog) => {
    setDownloadingId(backup.id);
    try {
      const { data, error } = await supabase.storage
        .from("customer-backups")
        .createSignedUrl(backup.file_path, 3600);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message || "Could not generate download link",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="form-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold">
            <HardDrive className="h-5 w-5" />
            Customer Data Backups
          </h3>
          <Button onClick={runBackupNow} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {running ? "Running..." : "Run Backup Now"}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Backups run automatically every day at midnight (Dhaka time). You can also trigger a manual backup.
        </p>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No backups yet. Run your first backup above.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">File</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">Records</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">Size</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      {format(new Date(b.created_at), "dd MMM yyyy, hh:mm a")}
                    </td>
                    <td className="p-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      {b.file_name}
                    </td>
                    <td className="p-3 text-right hidden md:table-cell">
                      {b.record_count}
                    </td>
                    <td className="p-3 text-right hidden md:table-cell">
                      {formatFileSize(b.file_size_bytes)}
                    </td>
                    <td className="p-3 text-center">
                      {b.status === "success" ? (
                        <Badge variant="outline" className="text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {b.status === "success" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadBackup(b)}
                          disabled={downloadingId === b.id}
                        >
                          {downloadingId === b.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
