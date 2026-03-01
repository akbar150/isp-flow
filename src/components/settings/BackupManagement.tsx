import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Download, HardDrive, Loader2, RefreshCw, CheckCircle, XCircle,
  Trash2, Upload, AlertTriangle, FileUp
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

// Parse multi-section CSV backup file into { tableName: rows[] }
function parseBackupCSV(content: string): Record<string, Record<string, string>[]> {
  const tables: Record<string, Record<string, string>[]> = {};
  const lines = content.split("\n");
  let currentTable = "";
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Section marker
    const match = line.match(/^=== (.+?) \(\d+ records\) ===$/);
    if (match) {
      currentTable = match[1];
      tables[currentTable] = [];
      headers = [];
      continue;
    }

    // Skip file header lines
    if (line.startsWith("=== FULL SYSTEM BACKUP") || line.startsWith("Generated:") ||
        line.startsWith("Total Records:") || line.match(/^[A-Za-z ]+: \d+ records$/)) {
      continue;
    }

    if (!currentTable) continue;

    // Parse CSV line (handles quoted fields)
    const fields = parseCSVLine(line);

    if (headers.length === 0) {
      headers = fields;
      continue;
    }

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] || "";
    }
    tables[currentTable].push(row);
  }

  return tables;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

export function BackupManagement() {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [cleanExisting, setCleanExisting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const tableCount = data.tables ? Object.keys(data.tables).length : 0;
      toast({
        title: "Backup completed",
        description: `${data.record_count} total records across ${tableCount} tables exported successfully.`,
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

  const deleteBackup = async (backup: BackupLog) => {
    setDeletingId(backup.id);
    try {
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from("customer-backups")
        .remove([backup.file_path]);
      if (storageError) throw storageError;

      // Delete log entry
      const { error: logError } = await supabase
        .from("backup_logs")
        .delete()
        .eq("id", backup.id);
      if (logError) throw logError;

      toast({ title: "Backup deleted", description: `${backup.file_name} has been permanently removed.` });
      fetchBackups();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete backup",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const content = await restoreFile.text();
      // Remove BOM if present
      const cleanContent = content.replace(/^\uFEFF/, "");
      const tables = parseBackupCSV(cleanContent);

      const tableNames = Object.keys(tables);
      if (tableNames.length === 0) {
        throw new Error("No valid data sections found in the backup file.");
      }

      const { data, error } = await supabase.functions.invoke("restore-customer-backup", {
        body: { tables, clean_existing: cleanExisting },
      });

      if (error) throw error;

      toast({
        title: "Restore completed",
        description: `${data.total_restored} records restored across ${Object.keys(data.details || {}).length} tables. ${data.total_errors > 0 ? `${data.total_errors} errors.` : ""}`,
      });

      // Reset form
      setRestoreFile(null);
      setCleanExisting(false);
      setConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message || "Something went wrong during restore",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
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
      {/* Backup Section */}
      <div className="form-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold">
            <HardDrive className="h-5 w-5" />
            Full System Data Backups
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
          Full system backup including Customers, Payments, Invoices, Billing, Accounting, Tickets, Service Tasks, Inventory, HRM, Reminders, Call Records, PPPoE Users, Packages, Routers, Resellers &amp; Areas. Runs daily at midnight (Dhaka UTC+6).
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
                  <th className="text-right p-3 font-medium">Actions</th>
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
                      <div className="flex items-center justify-end gap-1">
                        {b.status === "success" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadBackup(b)}
                            disabled={downloadingId === b.id}
                            title="Download"
                          >
                            {downloadingId === b.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === b.id}
                              title="Delete"
                            >
                              {deletingId === b.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <strong>{b.file_name}</strong> from storage. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteBackup(b)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Section */}
      <div className="form-section">
        <h3 className="flex items-center gap-2 text-base md:text-lg font-semibold mb-4">
          <Upload className="h-5 w-5" />
          Restore from Backup
        </h3>

        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Warning: Destructive Operation</p>
              <p className="text-muted-foreground mt-1">
                Restoring data can overwrite or duplicate existing records. If "Clear existing data" is checked, ALL current data will be permanently deleted before restoring. Use with extreme caution.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="backup-file" className="text-sm font-medium mb-1.5 block">
              Backup File (.csv)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="backup-file"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              {restoreFile && (
                <Badge variant="secondary" className="shrink-0">
                  <FileUp className="h-3 w-3 mr-1" />
                  {formatFileSize(restoreFile.size)}
                </Badge>
              )}
            </div>
          </div>

          {/* Clean existing checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="clean-existing"
              checked={cleanExisting}
              onCheckedChange={(c) => setCleanExisting(c === true)}
            />
            <Label htmlFor="clean-existing" className="text-sm text-destructive font-medium">
              Clear ALL existing data before restore
            </Label>
          </div>

          {/* Confirmation */}
          <div>
            <Label htmlFor="confirm-restore" className="text-sm font-medium mb-1.5 block">
              Type <strong>RESTORE</strong> to confirm
            </Label>
            <Input
              id="confirm-restore"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESTORE"
              className="max-w-xs"
            />
          </div>

          <Button
            onClick={handleRestore}
            disabled={!restoreFile || confirmText !== "RESTORE" || restoring}
            variant="destructive"
          >
            {restoring ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {restoring ? "Restoring..." : "Start Restore"}
          </Button>
        </div>
      </div>
    </div>
  );
}
