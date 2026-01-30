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
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";

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
  isValid: boolean;
  errors: string[];
}

interface BulkCustomerUploadProps {
  packages: Package[];
  areas: Area[];
  routers: Router[];
  onSuccess: () => void;
}

const SAMPLE_CSV = `full_name,phone,alt_phone,address,area_name,router_name,package_name,password,pppoe_username,pppoe_password
Mohammad Rahman,01712345678,,House 12 Road 5 Dhanmondi Dhaka,Zone A,Main Router,Basic 10Mbps,abc123,user001,pass01
Fatima Begum,01898765432,01711111111,Flat 4B Green Tower Uttara Dhaka,Zone B,Sub Router,Standard 20Mbps,xyz789,user002,pass02
Abdul Karim,01512345678,,Shop 23 Banani Commercial Area Dhaka,Zone A,Main Router,Premium 50Mbps,test123,user003,pass03`;

export function BulkCustomerUpload({ packages, areas, routers, onSuccess }: BulkCustomerUploadProps) {
  const [open, setOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
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

    // Name validation
    if (!row.full_name?.trim() || row.full_name.trim().length < 3) {
      errors.push("Name required (min 3 chars)");
    }

    // Phone validation
    const phoneRegex = /^(\+?880)?[0-9]{10,11}$/;
    const cleanPhone = (row.phone || "").replace(/[\s-]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      errors.push("Invalid phone");
    }

    // Address validation
    if (!row.address?.trim() || row.address.trim().length < 10) {
      errors.push("Address required (min 10 chars)");
    }

    // Package validation
    const pkg = packages.find(p => p.name.toLowerCase() === row.package_name?.toLowerCase().trim());
    if (!pkg) {
      errors.push("Invalid package");
    }

    // Password validation
    if (!row.password || row.password.length < 6) {
      errors.push("Password min 6 chars");
    } else if (!/^[a-zA-Z0-9]+$/.test(row.password)) {
      errors.push("Password alphanumeric only");
    }

    // PPPoE validation
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
      // Handle CSV fields with possible commas in quoted strings
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
        ...validation,
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedData(parsed);

      if (parsed.length === 0) {
        toast({
          title: "Empty file",
          description: "No valid data found in the CSV file",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast({
        title: "No valid data",
        description: "Please fix errors before importing",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: validRows.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        // Find related IDs
        const pkg = packages.find(p => p.name.toLowerCase() === row.package_name.toLowerCase().trim());
        const area = areas.find(a => a.name.toLowerCase() === row.area_name.toLowerCase().trim());
        const router = routers.find(r => r.name.toLowerCase() === row.router_name.toLowerCase().trim());

        if (!pkg) throw new Error("Package not found");

        // Generate user ID
        const { data: userId, error: idError } = await supabase.rpc("generate_customer_user_id");
        if (idError) throw idError;

        // Hash passwords
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

        // Create customer
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            user_id: userId,
            full_name: row.full_name.trim(),
            phone: row.phone.replace(/[\s-]/g, ""),
            alt_phone: row.alt_phone?.trim() || null,
            address: row.address.trim(),
            area_id: area?.id || null,
            router_id: router?.id || null,
            package_id: pkg.id,
            password_hash: hashedPassword,
            billing_start_date: format(today, "yyyy-MM-dd"),
            expiry_date: format(expiryDate, "yyyy-MM-dd"),
            status: "active",
            total_due: pkg.monthly_price,
          })
          .select("id")
          .single();

        if (customerError) throw customerError;

        // Create MikroTik user
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
        total: validRows.length,
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

  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.filter(r => !r.isValid).length;

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
              Upload a CSV file with customer data. Download sample for format reference.
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
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-4 w-4 mr-2" />
              {parsedData.length > 0 ? `${parsedData.length} rows loaded` : "Select CSV File"}
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
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{validCount} valid</span>
              </div>
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
                    <TableRow key={i} className={!row.isValid ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                      <TableCell>
                        {row.isValid ? (
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
                        {row.errors.length > 0 && (
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
            disabled={validCount === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {validCount} Customers
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
