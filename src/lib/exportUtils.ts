import { format } from "date-fns";

/**
 * Export data to CSV format
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  headers: { key: string; label: string }[],
  filename: string
): void {
  const headerRow = headers.map(h => h.label).join(",");
  
  const rows = data.map(item => 
    headers.map(h => {
      const value = item[h.key];
      // Escape quotes and wrap in quotes if contains comma or newline
      if (typeof value === "string") {
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return value ?? "";
    }).join(",")
  );
  
  const csv = [headerRow, ...rows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export data to simple PDF format (table layout)
 * Uses browser print dialog for PDF generation
 */
export function exportToPDF(
  data: Record<string, unknown>[],
  headers: { key: string; label: string }[],
  title: string,
  filename: string
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export PDF");
    return;
  }

  const tableRows = data.map(item => 
    `<tr>${headers.map(h => `<td style="border: 1px solid #ddd; padding: 8px;">${item[h.key] ?? ""}</td>`).join("")}</tr>`
  ).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; text-align: left; }
        td { border: 1px solid #ddd; padding: 8px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .meta { color: #666; margin-bottom: 20px; font-size: 14px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Generated on ${format(new Date(), "dd MMM yyyy, hh:mm a")} | Total Records: ${data.length}</p>
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h.label}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Helper function to download a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(amount: number): string {
  return `৳${amount.toLocaleString()}`;
}

/**
 * Format date for export
 */
export function formatDateForExport(date: Date | string, formatStr: string = "dd MMM yyyy"): string {
  return format(new Date(date), formatStr);
}
