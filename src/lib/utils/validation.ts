export function isValidIata(code: string): boolean {
  if (!code) return false;
  return /^[A-Za-z]{3}$/.test(code.trim());
}

export function sanitizeString(input: string, maxLength: number = 500): string {
  if (!input) return "";
  return String(input).replace(/<[^>]+>/g, "").trim().slice(0, maxLength);
}

interface ReportInput {
  airport_code: string;
  checkpoint: string;
  lane_type: string;
  wait_minutes: number;
  note?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateReport(input: ReportInput): ValidationResult {
  if (!isValidIata(input.airport_code)) return { valid: false, error: "Invalid airport code" };
  if (!input.checkpoint || input.checkpoint.trim().length === 0) return { valid: false, error: "Checkpoint is required" };
  if (!["standard", "precheck", "clear"].includes(input.lane_type)) return { valid: false, error: "Invalid lane type" };
  if (typeof input.wait_minutes !== "number" || input.wait_minutes < 0 || input.wait_minutes > 300) return { valid: false, error: "Wait time must be 0-300 minutes" };
  return { valid: true };
}
