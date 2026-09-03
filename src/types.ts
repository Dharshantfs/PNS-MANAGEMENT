export type UserRole = 'owner' | 'staff' | 'tenant';

export type KYCStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';

export type BedStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance';

export type PaymentStatus = 'paid' | 'due' | 'partial' | 'overdue';

// How a tenant's Aadhaar/KYC was verified. 'manual' = owner reviewed self-reported
// details + uploaded documents (used today, no verification API keys configured yet).
// 'ekyc' is reserved for a future Cashfree Aadhaar OTP e-KYC integration.
export type KYCVerificationMethod = 'manual' | 'ekyc';

export interface AadhaarDetails {
  aadhaarNumber: string; // 12 digits - full number, only ever shown to the owner, never exported/logged
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
  rentStatus: PaymentStatus;
  dueAmount: number;
  lastPaymentDate?: string;
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

export interface Room {
  id: string; // e.g. "room-101"
  propertyId: string;
  roomNumber: string; // e.g. "101", "102", "201"
  floor: number;
  roomTypeId: string; // references Property.roomTypes[].id
  sharingId: string; // references Property.sharingOptions[].id (occupancy 1-6)
  totalBeds: number;
  acType: 'AC' | 'Non-AC';
  washroomType: 'Attached' | 'Common';
  hasBalcony: boolean;
  hasGeyser: boolean;
  hasWifi: boolean;
  hasCupboard: boolean;
  pricePerBed: number;
  securityDeposit: number;
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
  paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';
  // 'manual' = owner reconciled it by hand (default today, no payment gateway keys yet).
  // 'gateway' is reserved for a future Cashfree order/webhook integration.
  verificationSource: PaymentVerificationSource;
  transactionId?: string;
  paymentDate: string;
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
  roomTypes: RoomTypeConfig[];
  sharingOptions: SharingConfig[];
  createdAt?: string;
  updatedAt?: string;
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

// Minimal profile for the signed-in owner/staff Firebase Auth account, stored in
// Firestore at users/{uid}. Holds which properties this account can access.
export interface OwnerProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: 'owner' | 'staff';
  propertyIds: string[];
  createdAt?: string;
}
