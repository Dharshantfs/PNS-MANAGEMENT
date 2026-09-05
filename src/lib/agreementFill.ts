import { Tenant, Property, PGSettings, Room } from '../types';

// Substitutes {{token}} placeholders in a template body with real values from
// a tenant + property + (backward-compatible) settings object. Unknown
// tokens are left as-is rather than silently dropped, so a typo in a
// template is visible instead of producing blank gaps in a signed document.
export function fillAgreementTemplate(
  body: string,
  tenant: Tenant,
  property: Property | undefined,
  settings: PGSettings,
  room: Room | undefined
): string {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const tokens: Record<string, string> = {
    currentDate: today,
    pgName: settings.pgName || '',
    ownerName: settings.ownerName || '',
    ownerPhone: settings.ownerPhone || '',
    ownerEmail: settings.ownerEmail || '',
    propertyAddress: settings.address || '',
    propertyCity: property?.city || '',
    propertyState: property?.state || '',
    propertyPincode: property?.pincode || '',
    tenantName: tenant.name || '',
    tenantPhone: tenant.phone || '',
    tenantEmail: tenant.email || '',
    tenantAddress: tenant.kyc?.permanentAddress || tenant.hometown || '',
    aadhaarNumber: tenant.kyc?.aadhaar?.aadhaarNumber || '',
    fatherName: tenant.kyc?.fatherName || '',
    roomNumber: tenant.roomNumber || '',
    bedLabel: tenant.bedLabel || '',
    floor: String(tenant.floor ?? ''),
    sharingType: room ? String(room.totalBeds) + '-sharing' : '',
    monthlyRent: tenant.monthlyRent?.toLocaleString('en-IN') || '0',
    securityDeposit: tenant.securityDeposit?.toLocaleString('en-IN') || '0',
    checkInDate: tenant.checkInDate || '',
    rentDueDay: String(settings.rentDueDay ?? 5),
  };

  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match
  );
}

// Plain-English labels for every fillable field, grouped for a click-to-insert
// UI (see AgreementTemplatesCard) - the owner never has to type or read the
// {{tokenName}} syntax themselves, just click "Tenant Name" etc.
export const AGREEMENT_FIELD_GROUPS: Array<{ group: string; fields: Array<{ token: string; label: string }> }> = [
  {
    group: 'Tenant',
    fields: [
      { token: 'tenantName', label: 'Tenant Name' },
      { token: 'tenantPhone', label: 'Tenant Phone' },
      { token: 'tenantEmail', label: 'Tenant Email' },
      { token: 'tenantAddress', label: 'Tenant Address' },
      { token: 'aadhaarNumber', label: 'Aadhaar Number' },
      { token: 'fatherName', label: "Father's Name" },
    ],
  },
  {
    group: 'Room & Rent',
    fields: [
      { token: 'roomNumber', label: 'Room Number' },
      { token: 'bedLabel', label: 'Bed' },
      { token: 'floor', label: 'Floor' },
      { token: 'sharingType', label: 'Sharing Type' },
      { token: 'monthlyRent', label: 'Monthly Rent' },
      { token: 'securityDeposit', label: 'Security Deposit' },
      { token: 'checkInDate', label: 'Check-in Date' },
      { token: 'rentDueDay', label: 'Rent Due Day' },
    ],
  },
  {
    group: 'PG & Owner',
    fields: [
      { token: 'currentDate', label: "Today's Date" },
      { token: 'pgName', label: 'PG Name' },
      { token: 'ownerName', label: 'Owner Name' },
      { token: 'ownerPhone', label: 'Owner Phone' },
      { token: 'ownerEmail', label: 'Owner Email' },
      { token: 'propertyAddress', label: 'Property Address' },
      { token: 'propertyCity', label: 'City' },
      { token: 'propertyState', label: 'State' },
      { token: 'propertyPincode', label: 'Pincode' },
    ],
  },
];

// Used to render a "what will this look like" preview in Settings without
// requiring a real tenant to be selected first.
export const SAMPLE_AGREEMENT_TOKENS: Record<string, string> = {
  currentDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
  pgName: 'Your PG Name',
  ownerName: 'Owner Name',
  ownerPhone: '+91 98765 43210',
  ownerEmail: 'owner@example.com',
  propertyAddress: 'Property Address',
  propertyCity: 'City',
  propertyState: 'State',
  propertyPincode: '000000',
  tenantName: 'Tenant Name',
  tenantPhone: '+91 90000 00000',
  tenantEmail: 'tenant@example.com',
  tenantAddress: 'Tenant Permanent Address',
  aadhaarNumber: 'XXXX XXXX XXXX',
  fatherName: "Tenant's Father Name",
  roomNumber: '101',
  bedLabel: 'Bed A',
  floor: '1',
  sharingType: '2-sharing',
  monthlyRent: '8,500',
  securityDeposit: '15,000',
  checkInDate: '01 Jan 2026',
  rentDueDay: '5',
};

export function fillSampleTemplate(body: string): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(SAMPLE_AGREEMENT_TOKENS, key) ? SAMPLE_AGREEMENT_TOKENS[key] : match
  );
}

// A starting Leave & License style agreement, in plain English - NOT
// reviewed by a lawyer. Indian state stamp duty / registration rules vary a
// lot (some states require e-stamping + registration above certain rent
// thresholds); the owner should have this checked before relying on it as a
// legally binding document. Fully editable in Settings > Rental Agreement
// Templates once created.
export const DEFAULT_AGREEMENT_BODY = `LEAVE AND LICENSE AGREEMENT

This agreement is made on {{currentDate}} at {{propertyCity}}, between:

{{ownerName}} (hereinafter referred to as the "Licensor"), owner/manager of
{{pgName}}, located at {{propertyAddress}}, {{propertyCity}}, {{propertyState}} - {{propertyPincode}},
contact: {{ownerPhone}} / {{ownerEmail}},

AND

{{tenantName}}, son/daughter of {{fatherName}}, (hereinafter referred to as the
"Licensee"), permanent address: {{tenantAddress}}, contact: {{tenantPhone}},
Aadhaar No.: {{aadhaarNumber}}.

1. ACCOMMODATION
The Licensor agrees to permit the Licensee to use Bed "{{bedLabel}}" in Room
{{roomNumber}} ({{sharingType}}), Floor {{floor}}, at the above property, on a
leave-and-license basis, strictly for residential purposes.

2. TERM
This license commences from {{checkInDate}} and continues on a month-to-month
basis until terminated by either party as per Clause 6.

3. LICENSE FEE (RENT)
The Licensee shall pay a monthly license fee of Rs. {{monthlyRent}}/-, payable
in advance on or before the {{rentDueDay}} of each calendar month.

4. SECURITY DEPOSIT
The Licensee has paid a refundable interest-free security deposit of
Rs. {{securityDeposit}}/- to the Licensor, refundable upon vacating the
accommodation, subject to deduction of any dues or damages.

5. HOUSE RULES
The Licensee agrees to abide by the house rules, gate timings, and code of
conduct communicated by the Licensor from time to time, including but not
limited to visitor policy, noise restrictions, and maintenance of cleanliness.

6. TERMINATION
Either party may terminate this agreement by giving the other party written
notice as per the Licensor's standard notice period policy. The Licensee
shall vacate the accommodation and settle all dues before the security
deposit is refunded.

7. NO TENANCY RIGHTS
This agreement creates a purely personal license to use the accommodation
and does not create any tenancy, sub-tenancy, or other rights in favour of
the Licensee under any law relating to tenancy or rent control.

IN WITNESS WHEREOF, the parties have signed this agreement on the date
mentioned above.


_____________________________          _____________________________
Licensor ({{ownerName}})                Licensee ({{tenantName}})
`;
