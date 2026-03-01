import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, AlertTriangle, CheckCircle2, RefreshCw, FileSpreadsheet, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";

interface ParsedRecord {
  username: string;
  expiry_date: string;
  package_name: string;
  status: string;
  bill?: number;
  phone?: string;
  name?: string;
  zone?: string;
}

// Column name mappings: key = normalized header, value = our field name
const COLUMN_MAP: Record<string, keyof ParsedRecord> = {
  "username": "username",
  "pppoe username": "username",
  "pppoe": "username",
  "user": "username",
  "expiry date": "expiry_date",
  "expiry": "expiry_date",
  "expire date": "expiry_date",
  "expire": "expiry_date",
  "expiration": "expiry_date",
  "package": "package_name",
  "package name": "package_name",
  "plan": "package_name",
  "status": "status",
  "bill": "bill",
  "monthly bill": "bill",
  "amount": "bill",
  "phone": "phone",
  "mobile": "phone",
  "contact": "phone",
  "name": "name",
  "full name": "name",
  "customer name": "name",
  "zone": "zone",
  "area": "zone",
};

function autoMapColumns(headers: string[]): Record<string, keyof ParsedRecord> {
  const mapping: Record<string, keyof ParsedRecord> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    if (COLUMN_MAP[normalized]) {
      mapping[header] = COLUMN_MAP[normalized];
    }
  }
  return mapping;
}

function normalizeExcelDate(value: unknown): string {
  if (!value) return "";
  // Excel serial number (days since 1900-01-01)
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(value).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // ISO with T
  if (str.includes("T")) return str.split("T")[0];
  // Has space
  if (str.includes(" ")) return str.split(" ")[0];
  // Try DD/MM/YYYY or MM/DD/YYYY — assume DD/MM for BD locale
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }
  return str;
}

export function CustomerDataImport() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncResult, setSyncResult] = useState<{ updated: number; not_found: number; errors: string[]; unmatched: string[] } | null>(null);

  // File upload state
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setSyncResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          setParseError("No data found in the file.");
          setParsedRecords([]);
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const mapping = autoMapColumns(headers);
        setColumnMapping(mapping);

        if (!Object.values(mapping).includes("username")) {
          setParseError("Could not find a 'Username' or 'PPPoE Username' column. Please check your file.");
          setParsedRecords([]);
          return;
        }

        const usernameCol = Object.entries(mapping).find(([, v]) => v === "username")?.[0];
        const expiryCol = Object.entries(mapping).find(([, v]) => v === "expiry_date")?.[0];
        const packageCol = Object.entries(mapping).find(([, v]) => v === "package_name")?.[0];
        const statusCol = Object.entries(mapping).find(([, v]) => v === "status")?.[0];
        const billCol = Object.entries(mapping).find(([, v]) => v === "bill")?.[0];
        const phoneCol = Object.entries(mapping).find(([, v]) => v === "phone")?.[0];
        const nameCol = Object.entries(mapping).find(([, v]) => v === "name")?.[0];
        const zoneCol = Object.entries(mapping).find(([, v]) => v === "zone")?.[0];

        const records: ParsedRecord[] = jsonData
          .map((row) => ({
            username: String(row[usernameCol!] || "").trim(),
            expiry_date: normalizeExcelDate(expiryCol ? row[expiryCol] : ""),
            package_name: String(packageCol ? row[packageCol] : "").trim(),
            status: String(statusCol ? row[statusCol] : "active").trim().toLowerCase(),
            bill: billCol ? Number(row[billCol]) || 0 : undefined,
            phone: phoneCol ? String(row[phoneCol]).trim() : undefined,
            name: nameCol ? String(row[nameCol]).trim() : undefined,
            zone: zoneCol ? String(row[zoneCol]).trim() : undefined,
          }))
          .filter((r) => r.username.length > 0);

        setParsedRecords(records);
        toast({ title: "File parsed", description: `Found ${records.length} records in "${file.name}"` });
      } catch (err) {
        setParseError(`Failed to parse file: ${String(err)}`);
        setParsedRecords([]);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, []);

  const clearFile = () => {
    setParsedRecords([]);
    setFileName(null);
    setColumnMapping({});
    setParseError(null);
    setSyncResult(null);
  };

  const handleSyncExpiry = async () => {
    if (parsedRecords.length === 0) {
      toast({ title: "No data", description: "Please upload an Excel or CSV file first.", variant: "destructive" });
      return;
    }

    if (!confirm(
      `This will sync expiry dates and missing packages for ${parsedRecords.length} records by matching PPPoE usernames. No data will be deleted. Continue?`
    )) return;

    setSyncing(true);
    setProgress(10);
    setSyncResult(null);

    try {
      setProgress(30);

      const records = parsedRecords.map((c) => ({
        username: c.username,
        expiry_date: c.expiry_date,
        package_name: c.package_name,
        status: c.status,
      }));

      const { data, error } = await supabase.functions.invoke("sync-expiry-dates", {
        body: { records },
      });

      setProgress(100);

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      setSyncResult(data);
      toast({
        title: "Sync Complete",
        description: `Updated ${data.updated} customers, ${data.not_found} not found${data.errors?.length ? `, ${data.errors.length} errors` : ""}`,
      });
    } catch (err) {
      toast({ title: "Sync failed", description: String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const mappedFields = Object.entries(columnMapping);
  const previewRows = parsedRecords.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <div className="p-4 border border-primary/50 rounded-lg bg-primary/5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-primary">Upload Excel/CSV File</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your Excel (.xlsx) or CSV file with customer data. The system will auto-detect columns like
              Username, Expiry Date, Package, Status, etc.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" />
                  Choose File
                </span>
              </label>

              {fileName && (
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{fileName}</span>
                  <span className="text-muted-foreground">({parsedRecords.length} records)</span>
                  <button onClick={clearFile} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {parseError && (
              <div className="mt-3 p-3 border border-destructive/50 rounded bg-destructive/5 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}

            {/* Column Mapping Display */}
            {mappedFields.length > 0 && (
              <div className="mt-3 p-3 border rounded bg-muted/30">
                <p className="text-sm font-medium mb-2">Detected Columns:</p>
                <div className="flex flex-wrap gap-2">
                  {mappedFields.map(([excelCol, field]) => (
                    <span key={excelCol} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {excelCol} → <strong>{field}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Data Preview */}
            {previewRows.length > 0 && (
              <div className="mt-3 border rounded overflow-hidden">
                <p className="text-sm font-medium px-3 py-2 bg-muted/50">
                  Preview (first {previewRows.length} of {parsedRecords.length})
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.username}</TableCell>
                          <TableCell>{r.expiry_date}</TableCell>
                          <TableCell>{r.package_name}</TableCell>
                          <TableCell>{r.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Section */}
      <div className="p-4 border border-primary/50 rounded-lg bg-primary/5">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-primary">Sync Expiry Dates & Packages (Safe)</p>
            <p className="text-sm text-muted-foreground mt-1">
              Matches PPPoE usernames from the uploaded file against existing customers. Updates <strong>expiry_date</strong> and <strong>status</strong>. 
              If a customer has no package assigned, it will also assign the matching package. No data is deleted.
            </p>
          </div>
        </div>

        {syncing && (
          <div className="space-y-2 mt-3">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">Syncing expiry dates...</p>
          </div>
        )}

        {syncResult && (
          <div className="p-3 border rounded-lg bg-muted/50 space-y-2 mt-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {syncResult.updated} updated, {syncResult.not_found} not found
              </span>
            </div>
            {syncResult.unmatched?.length > 0 && (
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                <p className="font-medium">Unmatched usernames:</p>
                {syncResult.unmatched.map((u, i) => (
                  <p key={i}>• {u}</p>
                ))}
              </div>
            )}
            {syncResult.errors?.length > 0 && (
              <div className="text-sm text-destructive max-h-32 overflow-y-auto">
                {syncResult.errors.map((e, i) => (
                  <p key={i}>• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSyncExpiry}
          disabled={syncing || parsedRecords.length === 0}
          className="mt-3"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {syncing ? "Syncing..." : `Sync Expiry Dates (${parsedRecords.length} records)`}
        </Button>

        {parsedRecords.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">Upload a file above to enable sync.</p>
        )}
      </div>
    </div>
  );
}
