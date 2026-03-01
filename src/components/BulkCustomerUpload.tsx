import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2, Copy } from "lucide-react";
import { normalizePhone, isValidBDPhone } from "@/lib/phoneUtils";
import { format, addDays } from "date-fns";
import * as XLSX from "xlsx";

interface Package {
  id: string;
  name: string;
  speed_mbps: number;
  monthly_price: number;
  validity_days: number;
}

interface Area {
  id: string;
  name: string;
}

interface Router {
  id: string;
  name: string;
}

interface ParsedCustomer {
  full_name: string;
  phone: string;
  alt_phone: string;
  address: string;
  area_name: string;
  router_name: string;
  package_name: string;
  password: string;
  pppoe_username: string;
  pppoe_password: string;
  latitude: string;
  longitude: string;
  connection_type: string;
  billing_cycle: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

interface BulkCustomerUploadProps {
  packages: Package[];
  areas: Area[];
  routers: Router[];
  onSuccess: () => void;
}

// Column name auto-mapping
const COLUMN_MAP: Record<string, string> = {
  "full_name": "full_name",
  "full name": "full_name",
  "name": "full_name",
  "customer name": "full_name",
  "customer": "full_name",
  "phone": "phone",
  "mobile": "phone",
  "phone number": "phone",
  "alt_phone": "alt_phone",
  "alt phone": "alt_phone",
  "alternative phone": "alt_phone",
  "address": "address",
  "area_name": "area_name",
  "area": "area_name",
  "zone": "area_name",
  "router_name": "router_name",
  "router": "router_name",
  "package_name": "package_name",
  "package": "package_name",
  "package name": "package_name",
  "plan": "package_name",
  "password": "password",
  "pppoe_username": "pppoe_username",
  "pppoe username": "pppoe_username",
  "username": "pppoe_username",
  "user": "pppoe_username",
  "pppoe_password": "pppoe_password",
  "pppoe password": "pppoe_password",
  "pppoe pass": "pppoe_password",
  "latitude": "latitude",
  "lat": "latitude",
  "longitude": "longitude",
  "lng": "longitude",
  "lon": "longitude",
  "connection_type": "connection_type",
  "connection type": "connection_type",
  "connection": "connection_type",
  "billing_cycle": "billing_cycle",
  "billing cycle": "billing_cycle",
  "billing": "billing_cycle",
};

function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    if (COLUMN_MAP[normalized]) {
      mapping[header] = COLUMN_MAP[normalized];
    }
  }
  return mapping;
}

const SAMPLE_CSV = `full_name,phone,alt_phone,address,area_name,router_name,package_name,password,pppoe_username,pppoe_password,latitude,longitude,connection_type,billing_cycle
Mohammad Rahman,01712345678,,House 12 Road 5 Dhanmondi Dhaka,Zone A,Main Router,Basic 10Mbps,abc123,user001,pass01,23.7461,90.3742,pppoe,monthly
Fatima Begum,01898765432,01711111111,Flat 4B Green Tower Uttara Dhaka,Zone B,Sub Router,Standard 20Mbps,xyz789,user002,pass02,23.8765,90.3920,static,quarterly
Abdul Karim,01512345678,,Shop 23 Banani Commercial Area Dhaka,Zone A,Main Router,Premium 50Mbps,test123,user003,pass03,23.7938,90.4035,pppoe,yearly`;

export function BulkCustomerUpload({ packages, areas, routers, onSuccess }: BulkCustomerUploadProps) {
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sample_customers.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const validateRow = (row: Record<string, string>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!row.full_name?.trim() || row.full_name.trim().length < 3) {
      errors.push("Name required (min 3 chars)");
    }

    if (!isValidBDPhone(row.phone || "")) {
      errors.push("Invalid phone (use 8801XXXXXXXXX)");
    }

    if (!row.address?.trim() || row.address.trim().length < 10) {
      errors.push("Address required (min 10 chars)");
    }

    const pkg = packages.find(p => p.name.toLowerCase() === row.package_name?.toLowerCase().trim());
    if (!pkg) {
      errors.push("Invalid package");
    }

    if (!row.password || row.password.length < 6) {
      errors.push("Password min 6 chars");
    } else if (!/^[a-zA-Z0-9]+$/.test(row.password)) {
      errors.push("Password alphanumeric only");
    }

    if (!row.pppoe_username?.trim() || row.pppoe_username.trim().length < 3) {
      errors.push("PPPoE username min 3 chars");
    }
    if (!row.pppoe_password || row.pppoe_password.length < 4) {
      errors.push("PPPoE password min 4 chars");
    } else if (!/^[a-zA-Z0-9]+$/.test(row.pppoe_password)) {
      errors.push("PPPoE password alphanumeric only");
    }

    return { isValid: errors.length === 0, errors };
  };

  const parseCSV = (content: string): ParsedCustomer[] => {
    const lines = content.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));

    return lines.slice(1).map(line => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || "";
      });

      const validation = validateRow(row);

      return {
        full_name: row.full_name || "",
        phone: row.phone || "",
        alt_phone: row.alt_phone || "",
        address: row.address || "",
        area_name: row.area_name || "",
        router_name: row.router_name || "",
        package_name: row.package_name || "",
        password: row.password || "",
        pppoe_username: row.pppoe_username || "",
        pppoe_password: row.pppoe_password || "",
        latitude: row.latitude || "",
        longitude: row.longitude || "",
        connection_type: row.connection_type || "pppoe",
        billing_cycle: row.billing_cycle || "monthly",
        isDuplicate: false,
        ...validation,
      };
    });
  };

  const parseExcel = (data: ArrayBuffer): ParsedCustomer[] => {
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

    if (jsonData.length === 0) return [];

    // Auto-map columns
    const rawHeaders = Object.keys(jsonData[0]);
    const columnMapping = autoMapColumns(rawHeaders);

    return jsonData.map((rawRow) => {
      const row: Record<string, string> = {};
      for (const [originalCol, mappedCol] of Object.entries(columnMapping)) {
        row[mappedCol] = String(rawRow[originalCol] ?? "").trim();
      }

      const validation = validateRow(row);

      return {
        full_name: row.full_name || "",
        phone: row.phone || "",
        alt_phone: row.alt_phone || "",
        address: row.address || "",
        area_name: row.area_name || "",
        router_name: row.router_name || "",
        package_name: row.package_name || "",
        password: row.password || "",
        pppoe_username: row.pppoe_username || "",
        pppoe_password: row.pppoe_password || "",
        latitude: row.latitude || "",
        longitude: row.longitude || "",
        connection_type: row.connection_type || "pppoe",
        billing_cycle: row.billing_cycle || "monthly",
        isDuplicate: false,
        ...validation,
      };
    });
  };

  const checkDuplicates = async (data: ParsedCustomer[]): Promise<ParsedCustomer[]> => {
    setCheckingDuplicates(true);
    try {
      // Fetch all existing PPPoE usernames
      const { data: existingUsers, error } = await supabase
        .from("mikrotik_users_safe")
        .select("username");

      if (error) {
        console.error("Failed to fetch existing usernames:", error);
        toast({
          title: "Warning",
          description: "Could not check for duplicates. Proceeding without duplicate detection.",
          variant: "destructive",
        });
        return data;
      }

      const existingSet = new Set(
        (existingUsers || []).map(u => u.username?.toLowerCase().trim()).filter(Boolean)
      );

      return data.map(row => {
        const isDuplicate = existingSet.has(row.pppoe_username?.toLowerCase().trim());
        return { ...row, isDuplicate };
      });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv = file.name.endsWith(".csv");

    if (!isExcel && !isCsv) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV or Excel (.xlsx/.xls) file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      let parsed: ParsedCustomer[] = [];

      if (isExcel) {
        parsed = parseExcel(event.target?.result as ArrayBuffer);
      } else {
        parsed = parseCSV(event.target?.result as string);
      }

      if (parsed.length === 0) {
        toast({
          title: "Empty file",
          description: "No valid data found in the file",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicates
      const withDuplicates = await checkDuplicates(parsed);
      setParsedData(withDuplicates);

      const dupCount = withDuplicates.filter(r => r.isDuplicate).length;
      const newCount = withDuplicates.filter(r => !r.isDuplicate && r.isValid).length;
      toast({
        title: `${parsed.length} rows loaded`,
        description: `${newCount} new, ${dupCount} duplicates detected`,
      });
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    const importableRows = parsedData.filter(r => r.isValid && !r.isDuplicate);
    if (importableRows.length === 0) {
      toast({
        title: "No importable data",
        description: "All rows are either duplicates or have errors",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: importableRows.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < importableRows.length; i++) {
      const row = importableRows[i];
      try {
        const pkg = packages.find(p => p.name.toLowerCase() === row.package_name.toLowerCase().trim());
        const area = areas.find(a => a.name.toLowerCase() === row.area_name.toLowerCase().trim());
        const router = routers.find(r => r.name.toLowerCase() === row.router_name.toLowerCase().trim());

        if (!pkg) throw new Error("Package not found");

        const { data: userId, error: idError } = await supabase.rpc("generate_customer_user_id");
        if (idError) throw idError;

        const { data: hashedPassword, error: hashError } = await supabase.rpc("hash_password", {
          raw_password: row.password,
        });
        if (hashError) throw hashError;

        const { data: hashedPppoePassword, error: pppoeHashError } = await supabase.rpc("hash_password", {
          raw_password: row.pppoe_password,
        });
        if (pppoeHashError) throw pppoeHashError;

        const today = new Date();
        const expiryDate = addDays(today, pkg.validity_days);

        const connectionType = ['pppoe', 'static', 'dhcp'].includes(row.connection_type)
          ? row.connection_type as 'pppoe' | 'static' | 'dhcp'
          : 'pppoe' as const;
        const billingCycle = ['monthly', 'quarterly', 'yearly'].includes(row.billing_cycle)
          ? row.billing_cycle as 'monthly' | 'quarterly' | 'yearly'
          : 'monthly' as const;

        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            user_id: userId,
            full_name: row.full_name.trim(),
            phone: normalizePhone(row.phone),
            alt_phone: row.alt_phone?.trim() || null,
            address: row.address.trim(),
            area_id: area?.id || null,
            router_id: router?.id || null,
            package_id: pkg.id,
            password_hash: hashedPassword,
            billing_start_date: format(today, "yyyy-MM-dd"),
            expiry_date: format(expiryDate, "yyyy-MM-dd"),
            status: "active" as const,
            total_due: pkg.monthly_price,
            latitude: row.latitude ? parseFloat(row.latitude) : null,
            longitude: row.longitude ? parseFloat(row.longitude) : null,
            connection_type: connectionType,
            billing_cycle: billingCycle,
          })
          .select("id")
          .single();

        if (customerError) throw customerError;

        await supabase.from("mikrotik_users").insert({
          customer_id: newCustomer.id,
          username: row.pppoe_username.trim(),
          password_encrypted: hashedPppoePassword,
          router_id: router?.id || null,
          profile: pkg.name,
          status: "enabled",
        });

        successCount++;
      } catch (error) {
        console.error(`Failed to import row ${i + 1}:`, error);
        failedCount++;
      }

      setImportProgress({
        current: i + 1,
        total: importableRows.length,
        success: successCount,
        failed: failedCount,
      });
    }

    setImporting(false);

    toast({
      title: "Import complete",
      description: `Successfully imported ${successCount} customers. ${failedCount} failed.`,
      variant: failedCount > 0 ? "destructive" : "default",
    });

    if (successCount > 0) {
      onSuccess();
      setParsedData([]);
      setOpen(false);
    }
  };

  const newValidCount = parsedData.filter(r => r.isValid && !r.isDuplicate).length;
  const duplicateCount = parsedData.filter(r => r.isDuplicate).length;
  const invalidCount = parsedData.filter(r => !r.isValid && !r.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Bulk Import</span>
          <span className="sm:hidden">Import</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Customer Import</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Instructions */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel (.xlsx) file. Duplicate PPPoE usernames will be auto-skipped.
            </p>
            <Button variant="outline" size="sm" onClick={downloadSampleCSV}>
              <Download className="h-4 w-4 mr-2" />
              Sample CSV
            </Button>
          </div>

          {/* File Upload */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={checkingDuplicates}
            >
              {checkingDuplicates ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking duplicates...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {parsedData.length > 0 ? `${parsedData.length} rows loaded` : "Select CSV / Excel File"}
                </>
              )}
            </Button>
            {parsedData.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParsedData([])}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Validation Summary */}
          {parsedData.length > 0 && (
            <div className="flex gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{newValidCount} new</span>
              </div>
              {duplicateCount > 0 && (
                <div className="flex items-center gap-1 text-amber-500">
                  <Copy className="h-4 w-4" />
                  <span>{duplicateCount} duplicates (will skip)</span>
                </div>
              )}
              {invalidCount > 0 && (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{invalidCount} with errors</span>
                </div>
              )}
            </div>
          )}

          {/* Data Preview */}
          {parsedData.length > 0 && (
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>PPPoE User</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, i) => (
                    <TableRow
                      key={i}
                      className={
                        row.isDuplicate
                          ? "bg-amber-500/10"
                          : !row.isValid
                          ? "bg-destructive/5"
                          : ""
                      }
                    >
                      <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                      <TableCell>
                        {row.isDuplicate ? (
                          <Badge variant="outline" className="text-amber-500 border-amber-500 text-xs">
                            Duplicate
                          </Badge>
                        ) : row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.full_name || "-"}</TableCell>
                      <TableCell>{row.phone || "-"}</TableCell>
                      <TableCell>{row.package_name || "-"}</TableCell>
                      <TableCell>{row.pppoe_username || "-"}</TableCell>
                      <TableCell>
                        {row.errors.length > 0 && !row.isDuplicate && (
                          <div className="flex flex-wrap gap-1">
                            {row.errors.map((err, j) => (
                              <Badge key={j} variant="destructive" className="text-xs">
                                {err}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  Importing {importProgress.current} of {importProgress.total}...
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="text-green-500">✓ {importProgress.success} success</span>
                {importProgress.failed > 0 && (
                  <span className="text-destructive">✗ {importProgress.failed} failed</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={newValidCount === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {newValidCount} New Customers
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
