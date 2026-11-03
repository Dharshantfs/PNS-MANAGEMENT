export type UserRole = 'owner' | 'staff' | 'tenant';

export type KYCStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';

export type BedStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance';

export type PaymentStatus = 'paid' | 'due' | 'partial' | 'overdue';

// How a tenant's Aadhaar/KYC was verified. 'manual' = owner reviewed self-reported
// details + uploaded documents (used today, no verification API keys configured yet).
// 'ekyc' is reserved for a future Cashfree Aadhaar OTP e-KYC integration.
export type KYCVerificationMethod = 'manual' | 'ekyc';

export interface AadhaarDetails {
  // Always '' on tenant records now: the full number is kept server-side only
  // (kycDocuments) and an owner reveals it via POST /api/kyc/reveal-aadhaar.
  // Forms still use this field to SEND a newly entered number to the server.
  aadhaarNumber: string;
  aadhaarLast4?: string; // safe to display in lists/exports
  nameOnAadhaar: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  address: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  selfieUrl?: string;
  verificationMethod?: KYCVerificationMethod;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface TenantKYC {
  status: KYCStatus;
  aadhaar: AadhaarDetails;
  fatherName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  permanentAddress: string;
  city: string;
  state: string;
  pincode: string;
  occupation: 'Working Professional' | 'Student' | 'Self-Employed' | 'Other';
  companyOrCollege: string;
  officeAddress?: string;
  workIdImageUrl?: string;
  foodPreference: 'Veg' | 'Non-Veg' | 'Eggetarian';
  bloodGroup?: string;
  submittedAt?: string;
  verifiedByOwner?: boolean;
  // Day the Aadhaar photos and number were deleted (90 days after checkout).
  purgedAt?: string;
}

export interface ExitSettlement {
  completedAt: string;
  depositHeld: number;
  deductions: number; // damages / other charges taken from the deposit
  deductionNotes?: string;
  // Set only when an admin let the resident leave with dues still pending.
  duesOutstanding?: number;
  duesOverrideReason?: string;
  // Part of the deposit used to clear dues at exit.
  depositAdjustedAgainstDues?: number;
  refundAmount: number; // depositHeld - deductions (0 if the deposit was never paid)
  refundMode?: 'UPI' | 'Cash' | 'Bank Transfer';
  checklist: { keyReturned: boolean; roomInspected: boolean; noticeGiven: boolean };
}

export interface Tenant {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  roomId?: string;
  roomNumber?: string;
  bedId?: string;
  bedLabel?: string;
  floor: number;
  monthlyRent: number;
  securityDeposit: number;
  depositPaid: boolean;
  checkInDate: string;
  checkOutDate?: string;
  // Exit formalities, filled in when the owner completes a move-out.
  exitSettlement?: ExitSettlement;
  rentStatus: PaymentStatus;
  dueAmount: number;
  // Money paid beyond what was due - used up by the next rent / charges.
  advanceBalance?: number;
  // Security deposit actually received so far (deposit payments), and how
  // much of it was billed into dueAmount through 'deposit' dues charges.
  depositReceived?: number;
  depositBilled?: number;
  // Last month (YYYY-MM, India time) the monthly rent was billed for.
  lastRentPeriod?: string;
  lastPaymentDate?: string;
  authUid?: string; // Tenant Portal login (Firebase Auth uid), created at KYC submit
  // Secret part of the KYC invite link (?onboard=<id>&t=<token>).
  inviteToken?: string;
  // When inviteToken was issued - invite links stop working after 7 days.
  inviteTokenIssuedAt?: string;
  // Room a self-registered applicant asked for (no bed until the owner assigns one).
  preferredRoomId?: string;
  kyc: TenantKYC;
  hometown: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Bed {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  bedLabel: string; // e.g., "Bed A", "Bed B", "Bed 1", "Bed 2"
  status: BedStatus;
  tenantId?: string;
  tenantName?: string;
  tenantPhone?: string;
  pricePerMonth: number;
  lastUpdated?: string;
}

// A room "type" a property owner defines for their own property, e.g. "1BHK",
// "2BHK", "Studio", "Dormitory" - fully custom per property, not a fixed enum.
export interface RoomTypeConfig {
  id: string; // e.g. "rt-1bhk"
  name: string;
  description?: string;
}

// A sharing/occupancy option a property owner defines, e.g. "Single", "2-Sharing"
// ... up to "6-Sharing", each with its own default rent.
export interface SharingConfig {
  id: string; // e.g. "sh-2"
  occupancy: number; // 1 to 6
  label: string; // "Single", "2-Sharing", "3-Sharing" ... "6-Sharing"
  defaultRent: number;
}

// A flexible amenity checklist (AC, TV, Geyser, CCTV, ...) instead of a fixed
// set of booleans - see FACILITY_OPTIONS in FloorBedMatrix.tsx for the full
// catalog. Stores the `key` of each facility the room actually has.
export type FacilityKey = string;

export interface Room {
  id: string; // e.g. "room-101"
  propertyId: string;
  roomNumber: string; // e.g. "101", "102", "201"
  floor: number;
  roomTypeId: string; // references Property.roomTypes[].id
  sharingId: string; // references Property.sharingOptions[].id (occupancy 1-6)
  totalBeds: number;
  facilities: FacilityKey[];
  pricePerBed: number;
  securityDeposit: number;
  availableForRent: boolean; // owner can mark a room not-for-rent (e.g. personal/storage use)
  beds: Bed[];
  notes?: string;
}

export type PaymentVerificationSource = 'manual' | 'gateway';

export interface PaymentRecord {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  bedLabel: string;
  floor: number;
  month: string; // e.g. "August 2026"
  amount: number;
  dueAmount: number;
  status: 'paid' | 'partial' | 'pending';
  // What the money is for. Missing on older records = rent/dues.
  purpose?: 'rent' | 'deposit';
  paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';
  // 'manual' = owner reconciled it by hand (default today, no payment gateway keys yet).
  // 'gateway' is reserved for a future Cashfree order/webhook integration.
  verificationSource: PaymentVerificationSource;
  transactionId?: string;
  paymentDate: string;
  // Issued when the payment is recorded or confirmed - empty while a
  // tenant-reported payment is still pending.
  receiptNumber: string;
  notes?: string;
}

export interface Notice {
  id: string;
  propertyId: string;
  title: string;
  content: string;
  category: 'General' | 'Maintenance' | 'Food' | 'Rules' | 'Payment';
  floorTarget?: number | 'all'; // 'all' or specific floor
  date: string;
  urgent: boolean;
  author: string;
}

export interface MaintenanceTicket {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantName: string;
  roomNumber: string;
  bedLabel: string;
  floor: number;
  category: 'Plumbing' | 'Electrical' | 'Air Conditioner' | 'Carpentry' | 'Cleaning' | 'Wi-Fi' | 'Other';
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
  resolvedAt?: string;
  adminNote?: string;
}

export interface DailyMenu {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  special?: string;
}

// One PG/hostel property owned by an owner account. An owner can have several -
// everything else (rooms, tenants, payments, notices, tickets) is scoped to one.
// A billable fee category an owner defines, e.g. "Rent", "Security Deposit",
// "3 Months Rent Package", "Manual Late Fine", "Joining Fee" - separate from
// room/sharing pricing so a charge can be added to a tenant's account
// on-demand (see DueCharge below) rather than only ever being the
// auto-computed monthly rent.
export type DuesCategoryType = 'rent' | 'deposit' | 'fee';

export interface DuesCategoryConfig {
  id: string;
  name: string;
  categoryType: DuesCategoryType;
  amountType: 'fixed' | 'variable';
  fixedAmount?: number; // only meaningful when amountType === 'fixed'
  active: boolean;
}

// A rental/leave-and-license agreement template with {{placeholder}} tokens
// (see src/lib/agreementFill.ts for the full token list) that get filled in
// with a specific tenant + property's details when generating a real
// agreement - see AgreementModal.tsx.
export interface AgreementTemplateConfig {
  id: string;
  name: string;
  body: string;
}

export interface Property {
  id: string;
  ownerId: string; // Firebase Auth uid of the owning account
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  upiId?: string;
  totalFloors: number;
  gateClosingTime: string;
  rentDueDay: number; // e.g., 5th of every month
  // Bill every staying resident one month's rent on the due day (server
  // cron, api/_lib/app.ts /api/cron/monthly-rent).
  autoMonthlyRent?: boolean;
  // First month (YYYY-MM) automatic rent may bill - set when it's switched on.
  autoRentFrom?: string;
  roomTypes: RoomTypeConfig[];
  sharingOptions: SharingConfig[];
  duesCategories: DuesCategoryConfig[];
  agreementTemplates: AgreementTemplateConfig[];
  createdAt?: string;
  updatedAt?: string;
}

// A charge added to a tenant's account against one of the property's
// DuesCategoryConfig entries (e.g. "add a Late Fine of ₹200"). Increases the
// tenant's dueAmount immediately - distinct from PaymentRecord, which
// represents money actually received (or reported) against that due.
export interface DueCharge {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantName: string;
  categoryId: string;
  categoryName: string;
  categoryType: DuesCategoryType;
  amount: number;
  date: string;
  notes?: string;
  addedBy: 'owner' | 'system';
}

// Backward-compatible flattened view of the active Property's settings, kept so
// existing components (FinancialReports, ReceiptModal, Navbar, etc.) that read
// `settings.pgName` / `settings.upiId` / ... don't need to change.
export interface PGSettings {
  pgName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  address: string;
  upiId: string;
  totalFloors: number;
  gateClosingTime: string;
  rentDueDay: number;
}

// A record of one action a staff/owner account took in the app - shown to the
// owner in the Activity Log tab so they can see what co-owners/staff did
// (and when). Written client-side alongside the mutation it describes (see
// PGContext's `logActivity` helper) plus server-side for the one action that
// happens in api/_lib/app.ts (inviting a new team member). Immutable once
// written - firestore.rules allows create but not update/delete.
export type ActivityAction =
  | 'property.create'
  | 'settings.update'
  | 'roomtype.add' | 'roomtype.update' | 'roomtype.delete'
  | 'sharing.add' | 'sharing.update' | 'sharing.delete'
  | 'dues.add' | 'dues.update' | 'dues.delete'
  | 'agreement.add' | 'agreement.update' | 'agreement.delete'
  | 'room.add' | 'room.update' | 'room.delete'
  | 'bed.assign' | 'bed.vacate'
  | 'tenant.add' | 'tenant.update' | 'tenant.delete' | 'tenant.exit'
  | 'kyc.submit' | 'kyc.approve' | 'kyc.reject'
  | 'kyc.reveal' | 'kyc.view-photos' | 'kyc.purge' // written by the server (api/_lib/app.ts)
  | 'charge.add'
  | 'payment.record' | 'payment.confirm'
  | 'notice.add' | 'notice.delete'
  | 'ticket.raise' | 'ticket.update'
  | 'team.invite';

export interface ActivityLog {
  id: string;
  propertyId: string;
  actorUid: string;
  actorName: string;
  actorRole: 'owner' | 'staff' | 'tenant'; // 'tenant' = KYC submitted from an invite link
  action: ActivityAction;
  summary: string; // human-readable, e.g. "Recorded ₹8,500 UPI payment for Ramesh (Room 101)"
  createdAt: string; // ISO timestamp
}

// Minimal profile for the signed-in owner/staff Firebase Auth account, stored in
// Firestore at users/{uid}. Holds which properties this account can access.
export interface OwnerProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: 'owner' | 'staff';
  propertyIds: string[];
  // True for an account created by another owner via Settings > Team Access
  // (see api/_lib/app.ts POST /api/team/invite) - forces a
  // change-password screen on first login instead of using the shared
  // temporary password indefinitely.
  mustChangePassword?: boolean;
  createdAt?: string;
}
