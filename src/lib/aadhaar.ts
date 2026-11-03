import type { AadhaarDetails } from '../types';

// Aadhaar numbers are shown masked everywhere: XXXX XXXX 1234. The full
// number is kept only on the server (kycDocuments); an owner can reveal it
// through POST /api/kyc/reveal-aadhaar, which is written to the activity log.
export function aadhaarLast4(a?: Partial<AadhaarDetails> | null): string {
  const digits = String(a?.aadhaarNumber || '').replace(/\D/g, '');
  return a?.aadhaarLast4 || digits.slice(-4);
}

export function maskAadhaar(a?: Partial<AadhaarDetails> | null): string {
  const last4 = aadhaarLast4(a);
  return last4 ? `XXXX XXXX ${last4}` : '';
}

export const formatAadhaar = (digits: string) => digits.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
