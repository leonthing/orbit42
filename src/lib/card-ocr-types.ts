// Client-safe types for business-card scanning. Kept apart from card-ocr.ts
// (which calls the Anthropic API server-side) so client components can import
// the shapes without pulling a server module into their bundle.

export interface ScannedCardFields {
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
}

export type ScanCardError = "no_api_key" | "no_text" | "extract_failed";

export interface ScanCardResult {
  fields: ScannedCardFields | null;
  // If the scanned card matches an existing contact (by email or phone),
  // we surface it so the user can update instead of creating a duplicate.
  duplicateId: string | null;
  duplicateName: string | null;
  error?: ScanCardError;
}
