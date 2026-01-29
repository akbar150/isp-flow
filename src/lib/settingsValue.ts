// Utilities for safely reading/writing jsonb-backed settings values.

/**
 * Decode values from the `system_settings.value` (jsonb) column.
 * Handles legacy cases where values were stored via JSON.stringify(),
 * which results in strings like "\"foo\"" and escaped newlines (\n).
 */
export function decodeSettingValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";

  // If PostgREST returns jsonb strings, they typically arrive as JS strings.
  if (typeof raw === "string") {
    let s: string = raw;

    // Attempt to JSON.parse up to 2 times to unwrap accidental double-stringify.
    for (let i = 0; i < 2; i++) {
      const t = s.trim();
      if (t.startsWith('"') && t.endsWith('"')) {
        try {
          const parsed = JSON.parse(t);
          if (typeof parsed === "string") {
            s = parsed;
            continue;
          }
        } catch {
          // ignore
        }
      }
      break;
    }

    return normalizeNewlines(s);
  }

  if (typeof raw === "object") {
    // Preserve objects/arrays as JSON for template variables.
    return JSON.stringify(raw);
  }

  return String(raw);
}

/**
 * Normalize newlines: convert literal "\\n" sequences into real newlines.
 * Keeps real newlines intact.
 */
export function normalizeNewlines(input: string): string {
  return input.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

/**
 * Standardize template variables to the canonical format.
 */
export function normalizeTemplateVars(template: string): string {
  // User preference: standardize to {ISPName}
  return template.replace(/\{ISP Name\}/g, "{ISPName}");
}
