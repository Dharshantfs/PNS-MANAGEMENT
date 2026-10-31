import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, deleteField, doc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import {
  UserRole,
  Room,
  Bed,
  Tenant,
  TenantKYC,
  PaymentRecord,
  Notice,
  MaintenanceTicket,
  PGSettings,
  Property,
  RoomTypeConfig,
  SharingConfig,
  DuesCategoryConfig,
  DueCharge,
  AgreementTemplateConfig,
  OwnerProfile,
  ActivityAction,
  ActivityLog,
  ExitSettlement,
} from '../types';
import { DEFAULT_AGREEMENT_BODY } from '../lib/agreementFill';
import {
  subscribeOwnerProperties,
  subscribeRooms,
  subscribeTenants,
  subscribePayments,
  subscribeNotices,
  subscribeTickets,
  subscribeCharges,
  createProperty as fsCreateProperty,
  updateProperty as fsUpdateProperty,
  createRoom,
  saveRoom,
  removeRoom,
  saveTenant,
  removeTenant,
  createPayment,
  receiptCounterRef,
  formatReceiptNumber,
  removeNotice,
  saveTicket,
  subscribeActivityLogs,
  subscribeForTenant,
  subscribeTenantDoc,
  subscribeRoomDoc,
  createActivityLog,
  getOwnerProfile,
  getProperty,
  getPropertiesByIds,
  findTenantByPhone,
  normalizePhone,
  newInviteToken,
  nowIso,
  todayIST,
  monthLabelIST,
} from '../services/firestoreService';

const round2 = (n: number) => Math.round(n * 100) / 100;

// How a payment changes a tenant's balances. Rent/dues payments reduce
// dueAmount, and anything paid beyond the due becomes advance credit
// (used up by the next rent or charge) instead of silently disappearing.
// A security-deposit payment is held as deposit; it only reduces dueAmount
// by the part of the deposit that was billed into dues as a 'deposit' charge.
function settlePayment(t: Tenant, amount: number, purpose: 'rent' | 'deposit', depositBilledFallback: number) {
  const due = Number(t.dueAmount) || 0;
  const updates: Record<string, unknown> = {};
  let newDue: number;
  if (purpose === 'deposit') {
    const received = Number(t.depositReceived) || 0;
    const billed = t.depositBilled ?? depositBilledFallback;
    const towardsDue = Math.min(amount, Math.max(0, billed - received), due);
    newDue = round2(due - towardsDue);
    const newReceived = round2(received + amount);
    const required = Number(t.securityDeposit) || 0;
    updates.depositReceived = newReceived;
    updates.depositPaid = required > 0 ? newReceived >= required : newReceived > 0;
  } else {
    const remaining = round2(due - amount);
    newDue = Math.max(0, remaining);
    if (remaining < 0) updates.advanceBalance = round2((Number(t.advanceBalance) || 0) - remaining);
  }
  updates.dueAmount = newDue;
  updates.rentStatus = newDue <= 0 ? 'paid' : newDue < due ? 'partial' : t.rentStatus;
  return { newDue, updates };
}
import { signOutCurrentUser } from '../services/authService';

interface FloorSummary {
  floor: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  totalRent: number;
}

const DEFAULT_SETTINGS: PGSettings = {
  pgName: 'My PG',
  ownerName: '',
  ownerPhone: '',
  ownerEmail: '',
  address: '',
  upiId: '',
  totalFloors: 4,
  gateClosingTime: '10:30 PM',
  rentDueDay: 5,
};

const DEFAULT_ROOM_TYPES: RoomTypeConfig[] = [{ id: 'rt-standard', name: 'Standard Room' }];

const SHARING_LABELS: Record<number, string> = {
  1: 'Single',
  2: '2-Sharing',
  3: '3-Sharing',
  4: '4-Sharing',
  5: '5-Sharing',
  6: '6-Sharing',
};

const DEFAULT_SHARING_OPTIONS: SharingConfig[] = [1, 2, 3, 4].map((occupancy) => ({
  id: `sh-${occupancy}`,
  occupancy,
  label: SHARING_LABELS[occupancy],
  defaultRent: 8000,
}));

const DEFAULT_DUES_CATEGORIES: DuesCategoryConfig[] = [
  { id: 'due-rent', name: 'Rent', categoryType: 'rent', amountType: 'variable', active: true },
  { id: 'due-deposit', name: 'Security Deposit', categoryType: 'deposit', amountType: 'variable', active: true },
];

const DEFAULT_AGREEMENT_TEMPLATES: AgreementTemplateConfig[] = [
  { id: 'agr-standard', name: 'Standard Leave & License Agreement', body: DEFAULT_AGREEMENT_BODY },
];

const emptyKYC = (): TenantKYC => ({
  status: 'unsubmitted',
  aadhaar: { aadhaarNumber: '', nameOnAadhaar: '', dob: '', gender: 'Male', address: '' },
  fatherName: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  permanentAddress: '',
  city: '',
  state: '',
  pincode: '',
  occupation: 'Working Professional',
  companyOrCollege: '',
  foodPreference: 'Veg',
});

interface PGContextType {
  // Auth / session
  authUser: FirebaseUser | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentTenantId: string;
  setCurrentTenantId: (id: string) => void;
  activeTenant: Tenant | undefined;
  logout: () => Promise<void>;
  ownerProfile: OwnerProfile | null;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;

  // Multi-property
  properties: Property[];
  activePropertyId: string | null;
  activeProperty: Property | undefined;
  switchProperty: (id: string) => void;
  createNewProperty: (data: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    totalFloors: number;
  }) => Promise<string>;
  updatePropertySettings: (updates: Partial<Property>) => Promise<void>;
  addRoomType: (name: string, description?: string) => Promise<void>;
  updateRoomType: (id: string, updates: Partial<RoomTypeConfig>) => Promise<void>;
  deleteRoomType: (id: string) => Promise<void>;
  addSharingOption: (occupancy: number, defaultRent: number, label?: string) => Promise<void>;
  updateSharingOption: (id: string, updates: Partial<SharingConfig>) => Promise<void>;
  deleteSharingOption: (id: string) => Promise<void>;
  addDuesCategory: (
    name: string,
    categoryType: DuesCategoryConfig['categoryType'],
    amountType: DuesCategoryConfig['amountType'],
    fixedAmount?: number
  ) => Promise<void>;
  updateDuesCategory: (id: string, updates: Partial<DuesCategoryConfig>) => Promise<void>;
  deleteDuesCategory: (id: string) => Promise<void>;
  charges: DueCharge[];
  addDueCharge: (tenantId: string, categoryId: string, amount: number, notes?: string) => Promise<void>;
  activityLogs: ActivityLog[];
  addAgreementTemplate: (name: string, body: string) => Promise<void>;
  updateAgreementTemplate: (id: string, updates: Partial<AgreementTemplateConfig>) => Promise<void>;
  deleteAgreementTemplate: (id: string) => Promise<void>;

  // Backward-compatible flattened settings (derived from activeProperty)
  settings: PGSettings;
  updateSettings: (updates: Partial<PGSettings>) => void;

  rooms: Room[];
  tenants: Tenant[];
  payments: PaymentRecord[];
  notices: Notice[];
  tickets: MaintenanceTicket[];

  // Room & Bed actions
  addRoom: (roomData: {
    roomNumber: string;
    floor: number;
    roomTypeId: string;
    sharingId: string;
    facilities: string[];
    pricePerBed: number;
    securityDeposit: number;
    availableForRent: boolean;
    notes?: string;
  }) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  // Rejects while anyone still lives in the room.
  deleteRoom: (roomId: string) => Promise<void>;
  // All bed moves run in one Firestore transaction against fresh data and
  // reject (with a readable message) if the bed was taken meanwhile.
  assignBed: (roomId: string, bedId: string, tenantId: string) => Promise<void>;
  // Frees a bed. Never checks a resident out - that's completeExit.
  vacateBed: (roomId: string, bedId: string) => Promise<void>;
  transferBed: (tenantId: string, targetRoomId: string, targetBedId: string) => Promise<void>;
  // Move-out: frees the bed, sets off the deposit against dues if asked,
  // and stores the settlement - all at once.
  completeExit: (
    tenantId: string,
    exit: { exitDate: string; settlement: ExitSettlement; depositOffset: number }
  ) => Promise<void>;

  // Tenant & KYC actions
  addTenant: (tenantData: {
    name: string;
    email?: string;
    phone: string;
    hometown?: string;
    roomId?: string;
    bedId?: string;
    monthlyRent?: number;
    securityDeposit?: number;
    checkInDate?: string;
  }) => string;
  updateTenant: (tenantId: string, updates: Partial<Tenant>) => void;
  // Permanently deletes the tenant record (admin only, see ExitedTenants).
  deleteTenant: (tenantId: string) => Promise<void>;
  submitKYC: (tenantId: string, kycData: Partial<TenantKYC>) => Promise<void>;
  approveKYC: (tenantId: string) => void;
  rejectKYC: (tenantId: string, reason: string) => void;

  // Payments - the receipt number, payment and tenant balance are written in
  // one transaction, so nothing is half-saved and nothing is counted twice.
  recordPayment: (paymentData: {
    tenantId: string;
    amount: number;
    month: string;
    paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';
    transactionId?: string;
    notes?: string;
    purpose?: 'rent' | 'deposit';
  }) => Promise<PaymentRecord>;
  // Tenant reports a UPI payment with its UTR - stays pending (no receipt)
  // until owner/staff confirm it.
  payRentAsTenant: (
    tenantId: string,
    amount: number,
    mode: 'UPI' | 'Card' | 'Bank Transfer',
    utr: string
  ) => Promise<PaymentRecord>;
  confirmPendingPayment: (paymentId: string) => Promise<void>;

  // Notices & Tickets
  addNotice: (notice: Omit<Notice, 'id' | 'date' | 'propertyId'>) => void;
  deleteNotice: (id: string) => void;
  raiseTicket: (ticket: Omit<MaintenanceTicket, 'id' | 'createdAt' | 'status' | 'propertyId'>) => void;
  updateTicketStatus: (id: string, status: MaintenanceTicket['status'], adminNote?: string) => void;

  // Helpers
  getRoommates: (tenantId: string) => Tenant[];
  getStats: () => {
    totalRooms: number;
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    occupancyRate: number;
    totalExpectedRevenue: number;
    totalReceivedRevenue: number;
    totalDueRevenue: number;
    verifiedKYCCount: number;
    pendingKYCCount: number;
    unsubmittedKYCCount: number;
    floorSummaries: FloorSummary[];
  };
  // No-op kept for backward compatibility with components that used to call an
  // explicit refresh against the old polling `/api/state` endpoint. Data is now
  // pushed live via Firestore `onSnapshot` listeners, so there is nothing to do.
  refreshStateFromServer: () => Promise<void>;
}

const PGContext = createContext<PGContextType | undefined>(undefined);

const ACTIVE_PROPERTY_KEY = (uid: string) => `pg_active_property_${uid}`;

export const PGProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRoleState] = useState<UserRole>('owner');
  const [currentTenantId, setCurrentTenantIdState] = useState<string>('');
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [charges, setCharges] = useState<DueCharge[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  // Tenant logins carry their tenant id as a custom claim.
  const [tenantClaimId, setTenantClaimId] = useState('');
  const [tenantRoommates, setTenantRoommates] = useState<Tenant[]>([]);

  // --- Firebase Auth session -------------------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // Tenant logins are email + password too (created at KYC submit - see
      // api/_lib/app.ts POST /api/onboard/tenant-login), told apart from
      // owner/staff by their `role: tenant` claim. Phone-only accounts are
      // from the older phone-OTP login. Worked out before publishing the
      // user so the owner view never flashes for a tenant.
      if (user) {
        const claims = await user
          .getIdTokenResult()
          .then((r) => r.claims)
          .catch(() => ({} as Record<string, unknown>));
        if (claims.role === 'tenant' || (user.phoneNumber && !user.email)) {
          // Their property is discovered once their tenant record loads (see
          // tenant effects below).
          setTenantClaimId(typeof claims.tenantId === 'string' ? claims.tenantId : '');
          setRole('tenant');
          setAuthUser(user);
          setAuthLoading(false);
          return;
        }
      }

      setAuthUser(user);
      setAuthLoading(false);

      if (!user) {
        setOwnerProfile(null);
        setProperties([]);
        setActivePropertyId(null);
        setCurrentTenantIdState('');
        setTenantClaimId('');
        setRole('owner');
        return;
      }

      // Owner / staff sign-in (email + password).
      setRole('owner');
      // Profiles are never created from the client (see firestore.rules -
      // `users/{uid}` create is Admin-SDK-only) so a signed-in email/password
      // account can't just self-grant an owner profile. The very first owner
      // is bootstrapped by running `npm run bootstrap-owner` (scripts/bootstrapFirstOwner.ts);
      // every account after that comes from Settings > Team Access.
      const profile = await getOwnerProfile(user.uid);
      setOwnerProfile(profile);
    });
    return unsub;
  }, []);

  // --- Owner's properties -----------------------------------------------------
  // Two sources merged: properties this account directly created (ownerId
  // match - live-updating subscription) plus properties an existing owner
  // invited this account to (users/{uid}.propertyIds, set server-side at
  // invite time - see api/_lib/app.ts). A team member's own uid never becomes
  // a property's `ownerId`, so without this second source they'd see no
  // properties at all despite firestore.rules granting them access.
  useEffect(() => {
    if (!authUser || role !== 'owner') return;
    let ownedProps: Property[] = [];
    let memberProps: Property[] = [];
    let cancelled = false;

    const applyMerged = () => {
      const merged = [...ownedProps];
      memberProps.forEach((p) => {
        if (!merged.some((m) => m.id === p.id)) merged.push(p);
      });
      setProperties(merged);
      setActivePropertyId((prev) => {
        if (prev && merged.some((p) => p.id === prev)) return prev;
        const saved = localStorage.getItem(ACTIVE_PROPERTY_KEY(authUser.uid));
        if (saved && merged.some((p) => p.id === saved)) return saved;
        return merged[0]?.id || null;
      });
    };

    const unsub = subscribeOwnerProperties(authUser.uid, (props) => {
      ownedProps = props;
      applyMerged();
    });

    if (ownerProfile?.propertyIds?.length) {
      getPropertiesByIds(ownerProfile.propertyIds).then((props) => {
        if (cancelled) return;
        memberProps = props;
        applyMerged();
      });
    }

    return () => {
      unsub();
      cancelled = true;
    };
  }, [authUser, role, ownerProfile]);

  // --- Tenant: their own record ---------------------------------------------
  // firestore.rules let a tenant read only their own tenant document, room,
  // payments, tickets and charges, plus their property's notices - so the
  // tenant portal subscribes to exactly those (by tenant id), never to the
  // whole property.
  useEffect(() => {
    if (!authUser || role !== 'tenant') return;
    if (tenantClaimId) {
      setCurrentTenantIdState(tenantClaimId);
      return;
    }
    // Older phone-OTP tenant accounts: find their record by verified phone.
    if (!authUser.phoneNumber) return;
    let cancelled = false;
    findTenantByPhone(authUser.phoneNumber)
      .then((match) => {
        if (!cancelled && match) setCurrentTenantIdState(match.id);
      })
      .catch((e) => console.warn('Tenant lookup failed', e));
    return () => {
      cancelled = true;
    };
  }, [authUser, role, tenantClaimId]);

  useEffect(() => {
    if (!authUser || role !== 'tenant' || !currentTenantId) return;
    const unsubs = [
      subscribeTenantDoc(currentTenantId, (t) => {
        setTenants(t ? [t] : []);
        if (t?.propertyId) setActivePropertyId(t.propertyId);
      }),
      subscribeForTenant<PaymentRecord>('payments', currentTenantId, setPayments),
      subscribeForTenant<MaintenanceTicket>('tickets', currentTenantId, setTickets),
      subscribeForTenant<DueCharge>('charges', currentTenantId, setCharges),
    ];
    return () => unsubs.forEach((u) => u());
  }, [authUser, role, currentTenantId]);

  const tenantRoomId = role === 'tenant' ? tenants.find((t) => t.id === currentTenantId)?.roomId : undefined;

  // The tenant's property (name, UPI id) and its notices.
  useEffect(() => {
    if (!authUser || role !== 'tenant' || !activePropertyId) return;
    let cancelled = false;
    getProperty(activePropertyId)
      .then((p) => {
        if (!cancelled && p) setProperties([p]);
      })
      .catch((e) => console.warn('Property load failed', e));
    const unsub = subscribeNotices(activePropertyId, setNotices);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authUser, role, activePropertyId]);

  // The tenant's own room, and their roommates (from the server, which
  // returns only the fields the Roommates screen shows).
  useEffect(() => {
    if (!authUser || role !== 'tenant') return;
    if (!tenantRoomId) {
      setRooms([]);
      setTenantRoommates([]);
      return;
    }
    const unsub = subscribeRoomDoc(tenantRoomId, (r) => setRooms(r ? [r] : []));
    let cancelled = false;
    authUser
      .getIdToken()
      .then((token) => fetch('/api/tenant/roommates', { headers: { Authorization: `Bearer ${token}` } }))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success) setTenantRoommates(data.roommates as Tenant[]);
      })
      .catch((e) => console.warn('Roommates load failed', e));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authUser, role, tenantRoomId]);

  // --- Owner/staff: property-scoped live data ------------------------------
  useEffect(() => {
    if (authUser && role === 'tenant') return; // handled by the tenant effects above
    if (!activePropertyId || !authUser) {
      // Signed out (login screen, public onboarding): nothing is read from
      // Firestore - the onboarding page talks to the server instead.
      setRooms([]);
      setTenants([]);
      setPayments([]);
      setNotices([]);
      setTickets([]);
      setCharges([]);
      setActivityLogs([]);
      return;
    }
    const unsubs = [
      subscribeRooms(activePropertyId, setRooms),
      subscribeTenants(activePropertyId, setTenants),
      subscribePayments(activePropertyId, setPayments),
      subscribeNotices(activePropertyId, setNotices),
      subscribeTickets(activePropertyId, setTickets),
      subscribeCharges(activePropertyId, setCharges),
      subscribeActivityLogs(activePropertyId, setActivityLogs),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activePropertyId, role, authUser]);

  useEffect(() => {
    if (authUser?.uid && activePropertyId) {
      localStorage.setItem(ACTIVE_PROPERTY_KEY(authUser.uid), activePropertyId);
    }
  }, [authUser, activePropertyId]);

  const activeProperty = useMemo(
    () => properties.find((p) => p.id === activePropertyId),
    [properties, activePropertyId]
  );

  // Records one entry in the property's Activity Log (see ActivityLog in
  // types.ts) - fire-and-forget, alongside the mutation it describes. Only
  // owner/staff actions are logged (tenants have no users/{uid} profile, so
  // firestore.rules would reject a tenant-authored entry anyway - see
  // isOwnerOfProperty there). Failures are swallowed: a logging failure
  // should never block the actual action it's describing.
  const logActivity = (action: ActivityAction, summary: string, propertyIdOverride?: string) => {
    const propertyId = propertyIdOverride || activePropertyId;
    if (!propertyId || !authUser || role !== 'owner') return;
    createActivityLog({
      propertyId,
      actorUid: authUser.uid,
      actorName: ownerProfile?.name || authUser.email || 'Unknown',
      actorRole: ownerProfile?.role || 'owner',
      action,
      summary,
    }).catch((e) => console.warn('logActivity failed', e));
  };

  const setRole = (newRole: UserRole) => setRoleState(newRole);
  const setCurrentTenantId = (id: string) => setCurrentTenantIdState(id);
  const setIsAuthenticated = (_auth: boolean) => {
    // Kept only for backward compatibility with components' prop signatures.
    // Real auth state now comes from Firebase (`authUser`), not this flag.
  };

  const logout = async () => {
    await signOutCurrentUser();
    setCurrentTenantIdState('');
  };

  const activeTenant = tenants.find((t) => t.id === currentTenantId);
  const isAuthenticated = !!authUser;
  const mustChangePassword = !!ownerProfile?.mustChangePassword;

  const clearMustChangePassword = () => {
    if (!authUser) return;
    updateDoc(doc(db, 'users', authUser.uid), { mustChangePassword: false }).catch((e) =>
      console.warn('clearMustChangePassword failed', e)
    );
    setOwnerProfile((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  };

  // --- Multi-property management ----------------------------------------------

  const switchProperty = (id: string) => setActivePropertyId(id);

  const createNewProperty = async (data: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    totalFloors: number;
  }): Promise<string> => {
    if (!authUser) throw new Error('Must be signed in to create a property');
    const id = await fsCreateProperty({
      ownerId: authUser.uid,
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      totalFloors: data.totalFloors,
      gateClosingTime: '10:30 PM',
      rentDueDay: 5,
      roomTypes: DEFAULT_ROOM_TYPES,
      sharingOptions: DEFAULT_SHARING_OPTIONS,
      duesCategories: DEFAULT_DUES_CATEGORIES,
      agreementTemplates: DEFAULT_AGREEMENT_TEMPLATES,
    });
    // No need to also record this on the profile's propertyIds - the
    // creator is granted access via the property's own `ownerId` field
    // (see isOwnerOfProperty in firestore.rules). propertyIds is only for
    // invited team members, set server-side at invite time.
    setActivePropertyId(id);
    logActivity('property.create', `Created property "${data.name}"`, id);
    // Give the rest of the team (co-owners/staff on this owner's other
    // properties) access too - api/_lib/app.ts POST /api/team/share-property.
    authUser
      .getIdToken()
      .then((token) =>
        fetch('/api/team/share-property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ propertyId: id }),
        })
      )
      .catch((e) => console.warn('Sharing the new property with the team failed', e));
    return id;
  };

  // Returns a Promise (instead of the old fire-and-forget-with-console.warn)
  // so the Settings UI can actually show the user when a write is rejected
  // (e.g. by firestore.rules) rather than the button just silently doing
  // nothing, which is impossible to tell apart from "it worked."
  const updatePropertySettings = (updates: Partial<Property>): Promise<void> => {
    if (!activePropertyId) return Promise.reject(new Error('No active property selected'));
    return fsUpdateProperty(activePropertyId, updates);
  };

  const addRoomType = (name: string, description?: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const id = `rt-${Date.now()}`;
    // Firestore rejects a field whose value is `undefined` outright - only
    // include `description` when one was actually given.
    const newType: RoomTypeConfig = description ? { id, name, description } : { id, name };
    return updatePropertySettings({ roomTypes: [...activeProperty.roomTypes, newType] }).then(() =>
      logActivity('roomtype.add', `Added room type "${name}"`)
    );
  };

  const updateRoomType = (id: string, updates: Partial<RoomTypeConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const name = activeProperty.roomTypes.find((rt) => rt.id === id)?.name || id;
    return updatePropertySettings({
      roomTypes: activeProperty.roomTypes.map((rt) => (rt.id === id ? { ...rt, ...updates } : rt)),
    }).then(() => logActivity('roomtype.update', `Updated room type "${name}"`));
  };

  const deleteRoomType = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const name = activeProperty.roomTypes.find((rt) => rt.id === id)?.name || id;
    return updatePropertySettings({ roomTypes: activeProperty.roomTypes.filter((rt) => rt.id !== id) }).then(() =>
      logActivity('roomtype.delete', `Deleted room type "${name}"`)
    );
  };

  const addSharingOption = (occupancy: number, defaultRent: number, label?: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const clamped = Math.min(6, Math.max(1, occupancy));
    const id = `sh-${Date.now()}`;
    const finalLabel = label || SHARING_LABELS[clamped] || `${clamped}-Sharing`;
    return updatePropertySettings({
      sharingOptions: [...activeProperty.sharingOptions, { id, occupancy: clamped, label: finalLabel, defaultRent }],
    }).then(() => logActivity('sharing.add', `Added sharing option "${finalLabel}" (₹${defaultRent}/bed)`));
  };

  const updateSharingOption = (id: string, updates: Partial<SharingConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const label = activeProperty.sharingOptions.find((s) => s.id === id)?.label || id;
    return updatePropertySettings({
      sharingOptions: activeProperty.sharingOptions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }).then(() => logActivity('sharing.update', `Updated sharing option "${label}"`));
  };

  const deleteSharingOption = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const label = activeProperty.sharingOptions.find((s) => s.id === id)?.label || id;
    return updatePropertySettings({ sharingOptions: activeProperty.sharingOptions.filter((s) => s.id !== id) }).then(
      () => logActivity('sharing.delete', `Deleted sharing option "${label}"`)
    );
  };

  // --- Dues packages (Rent / Deposit / custom fee categories) ------------------

  const addDuesCategory = (
    name: string,
    categoryType: DuesCategoryConfig['categoryType'],
    amountType: DuesCategoryConfig['amountType'],
    fixedAmount?: number
  ) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const id = `due-${Date.now()}`;
    const newCategory: DuesCategoryConfig =
      amountType === 'fixed'
        ? { id, name, categoryType, amountType, fixedAmount: fixedAmount || 0, active: true }
        : { id, name, categoryType, amountType, active: true };
    return updatePropertySettings({ duesCategories: [...(activeProperty.duesCategories || []), newCategory] }).then(
      () => logActivity('dues.add', `Added dues category "${name}"`)
    );
  };

  const updateDuesCategory = (id: string, updates: Partial<DuesCategoryConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const name = (activeProperty.duesCategories || []).find((c) => c.id === id)?.name || id;
    return updatePropertySettings({
      duesCategories: (activeProperty.duesCategories || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }).then(() => logActivity('dues.update', `Updated dues category "${name}"`));
  };

  const deleteDuesCategory = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const name = (activeProperty.duesCategories || []).find((c) => c.id === id)?.name || id;
    return updatePropertySettings({ duesCategories: (activeProperty.duesCategories || []).filter((c) => c.id !== id) }).then(
      () => logActivity('dues.delete', `Deleted dues category "${name}"`)
    );
  };

  // Charges a tenant's account against a dues category (e.g. "add a Late
  // Fine of ₹200") - increases dueAmount immediately. Distinct from a
  // PaymentRecord, which represents money actually received against a due.
  const addDueCharge = async (tenantId: string, categoryId: string, amount: number, notes?: string): Promise<void> => {
    if (!activePropertyId || !activeProperty) throw new Error('No active property selected');
    const tenant = tenants.find((t) => t.id === tenantId);
    const category = (activeProperty.duesCategories || []).find((c) => c.id === categoryId);
    if (!tenant || !category) throw new Error('Tenant or dues category not found');

    const value = round2(Number(amount));
    if (!(value > 0)) throw new Error('Enter an amount greater than zero.');
    const isDeposit = category.categoryType === 'deposit';
    const depositBilledFallback = charges
      .filter((c) => c.tenantId === tenantId && c.categoryType === 'deposit')
      .reduce((s, c) => s + c.amount, 0);

    const chargeRef = doc(collection(db, 'charges'));
    const tenantRef = doc(db, 'tenants', tenantId);
    let fromAdvance = 0;
    // Read-modify-write of the tenant's balance inside a transaction, so two
    // people adding charges / recording payments at once can't overwrite
    // each other's change.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(tenantRef);
      if (!snap.exists()) throw new Error('Tenant not found.');
      const t = { id: snap.id, ...snap.data() } as Tenant;
      const advance = Number(t.advanceBalance) || 0;
      // Advance credit pays rent/fees first - never a security deposit.
      fromAdvance = isDeposit ? 0 : Math.min(advance, value);
      const newDue = round2((Number(t.dueAmount) || 0) + value - fromAdvance);
      const charge: Omit<DueCharge, 'id'> = {
        propertyId: activePropertyId,
        tenantId,
        tenantName: t.name,
        categoryId,
        categoryName: category.name,
        categoryType: category.categoryType,
        amount: value,
        date: todayIST(),
        addedBy: 'owner',
        // Firestore rejects a literal `undefined` field value.
        ...(notes || fromAdvance > 0
          ? { notes: [notes, fromAdvance > 0 ? `₹${fromAdvance} adjusted from advance` : ''].filter(Boolean).join(' - ') }
          : {}),
      };
      tx.set(chargeRef, charge);
      tx.update(tenantRef, {
        dueAmount: newDue,
        rentStatus: newDue > 0 ? 'due' : 'paid',
        ...(fromAdvance > 0 ? { advanceBalance: round2(advance - fromAdvance) } : {}),
        ...(isDeposit ? { depositBilled: round2((t.depositBilled ?? depositBilledFallback) + value) } : {}),
        updatedAt: nowIso(),
      });
    });
    logActivity('charge.add', `Added ₹${value.toLocaleString('en-IN')} ${category.name} charge to ${tenant.name}`);
  };

  // --- Rental agreement templates ----------------------------------------------

  const addAgreementTemplate = (name: string, body: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const id = `agr-${Date.now()}`;
    return updatePropertySettings({
      agreementTemplates: [...(activeProperty.agreementTemplates || []), { id, name, body }],
    }).then(() => logActivity('agreement.add', `Added agreement template "${name}"`));
  };

  const updateAgreementTemplate = (id: string, updates: Partial<AgreementTemplateConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const name = (activeProperty.agreementTemplates || []).find((t) => t.id === id)?.name || id;
    return updatePropertySettings({
      agreementTemplates: (activeProperty.agreementTemplates || []).map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }).then(() => logActivity('agreement.update', `Updated agreement template "${name}"`));
  };

  const deleteAgreementTemplate = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const name = (activeProperty.agreementTemplates || []).find((t) => t.id === id)?.name || id;
    return updatePropertySettings({
      agreementTemplates: (activeProperty.agreementTemplates || []).filter((t) => t.id !== id),
    }).then(() => logActivity('agreement.delete', `Deleted agreement template "${name}"`));
  };

  // --- Backward-compatible flattened settings ---------------------------------

  const settings: PGSettings = activeProperty
    ? {
        pgName: activeProperty.name,
        ownerName: ownerProfile?.name || '',
        ownerPhone: ownerProfile?.phone || '',
        ownerEmail: ownerProfile?.email || '',
        address: activeProperty.address,
        upiId: activeProperty.upiId || '',
        totalFloors: activeProperty.totalFloors,
        gateClosingTime: activeProperty.gateClosingTime,
        rentDueDay: activeProperty.rentDueDay,
      }
    : DEFAULT_SETTINGS;

  const updateSettings = (updates: Partial<PGSettings>) => {
    const propertyUpdates: Partial<Property> = {};
    if (updates.pgName !== undefined) propertyUpdates.name = updates.pgName;
    if (updates.address !== undefined) propertyUpdates.address = updates.address;
    if (updates.upiId !== undefined) propertyUpdates.upiId = updates.upiId;
    if (updates.totalFloors !== undefined) propertyUpdates.totalFloors = updates.totalFloors;
    if (updates.gateClosingTime !== undefined) propertyUpdates.gateClosingTime = updates.gateClosingTime;
    if (updates.rentDueDay !== undefined) propertyUpdates.rentDueDay = updates.rentDueDay;
    if (Object.keys(propertyUpdates).length > 0) {
      updatePropertySettings(propertyUpdates).then(() =>
        logActivity('settings.update', `Updated property settings (${Object.keys(propertyUpdates).join(', ')})`)
      );
    }
  };

  // --- Rooms & beds ------------------------------------------------------------

  const addRoom = (roomData: {
    roomNumber: string;
    floor: number;
    roomTypeId: string;
    sharingId: string;
    facilities: string[];
    pricePerBed: number;
    securityDeposit: number;
    availableForRent: boolean;
    notes?: string;
  }) => {
    if (!activePropertyId) return;
    const sharing = activeProperty?.sharingOptions.find((s) => s.id === roomData.sharingId);
    const bedCount = sharing?.occupancy || 1;
    const labels = ['Bed A', 'Bed B', 'Bed C', 'Bed D', 'Bed E', 'Bed F'];

    const ref = doc(collection(db, 'rooms'));
    const beds: Bed[] = Array.from({ length: bedCount }).map((_, i) => ({
      id: `${ref.id}-bed-${i + 1}`,
      roomId: ref.id,
      roomNumber: roomData.roomNumber,
      floor: roomData.floor,
      bedLabel: bedCount === 1 ? 'Single Bed' : labels[i] || `Bed ${i + 1}`,
      status: 'vacant',
      pricePerMonth: roomData.pricePerBed,
    }));

    const newRoom: Room = {
      id: ref.id,
      propertyId: activePropertyId,
      roomNumber: roomData.roomNumber,
      floor: roomData.floor,
      roomTypeId: roomData.roomTypeId,
      sharingId: roomData.sharingId,
      facilities: roomData.facilities,
      pricePerBed: roomData.pricePerBed,
      securityDeposit: roomData.securityDeposit,
      availableForRent: roomData.availableForRent,
      totalBeds: bedCount,
      beds,
      // Firestore rejects a literal `undefined` field value - only include
      // notes when something was actually typed.
      ...(roomData.notes ? { notes: roomData.notes } : {}),
    };

    setDoc(ref, newRoom)
      .then(() => logActivity('room.add', `Added room ${roomData.roomNumber} (Floor ${roomData.floor})`))
      .catch((e) => console.warn('addRoom failed', e));
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const patch: Partial<Room> = { ...updates };
    if (updates.pricePerBed !== undefined) {
      patch.beds = room.beds.map((b) => ({ ...b, pricePerMonth: updates.pricePerBed! }));
    }
    saveRoom(roomId, patch)
      .then(() => logActivity('room.update', `Updated room ${room.roomNumber}`))
      .catch((e) => console.warn('updateRoom failed', e));
  };

  const deleteRoom = async (roomId: string): Promise<void> => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const occupied = room.beds.some((b) => b.status === 'occupied');
    const residents = tenants.filter((t) => t.roomId === roomId && !t.checkOutDate);
    if (occupied || residents.length > 0) {
      throw new Error(`Room ${room.roomNumber} still has residents. Transfer or check them out first.`);
    }
    await removeRoom(roomId);
    logActivity('room.delete', `Deleted room ${room.roomNumber}`);
  };

  // Bed without any tenant fields. Rebuilt rather than set to `undefined`:
  // these live inside the `beds` array, where deleteField() doesn't apply.
  const freeBed = (b: Bed): Bed => {
    const { tenantId: _t, tenantName: _n, tenantPhone: _p, ...rest } = b;
    return { ...rest, status: 'vacant', lastUpdated: nowIso() };
  };

  // Assigns (or, for someone who already has a bed, transfers) a tenant to a
  // bed. Everything is read fresh inside one transaction, so a stale screen
  // can't double-book a bed or leave the old bed marked occupied.
  // Billing: a first assignment (rent not set yet) or a re-admission bills
  // the first month; a transfer between beds never changes the balance.
  const assignBed = async (roomId: string, bedId: string, tenantId: string): Promise<void> => {
    const tenantRef = doc(db, 'tenants', tenantId);
    const targetRoomRef = doc(db, 'rooms', roomId);
    const today = todayIST();
    let summary = '';

    await runTransaction(db, async (tx) => {
      const tSnap = await tx.get(tenantRef);
      const rSnap = await tx.get(targetRoomRef);
      if (!tSnap.exists() || !rSnap.exists()) throw new Error('Tenant or room not found.');
      const t = { id: tSnap.id, ...tSnap.data() } as Tenant;
      const room = { id: rSnap.id, ...rSnap.data() } as Room;
      const bed = room.beds.find((b) => b.id === bedId);
      if (!bed) throw new Error('Bed not found.');
      if (bed.status !== 'vacant') throw new Error(`${bed.bedLabel} in Room ${room.roomNumber} is no longer vacant.`);

      const oldRoomId = t.roomId && t.bedId ? t.roomId : undefined;
      const oldRoomSnap = oldRoomId && oldRoomId !== roomId ? await tx.get(doc(db, 'rooms', oldRoomId)) : null;

      // Target room: take the new bed (and free the old one if it's the same room).
      let targetBeds = room.beds.map((b) =>
        b.id === bedId
          ? { ...b, status: 'occupied' as const, tenantId: t.id, tenantName: t.name, lastUpdated: nowIso() }
          : b
      );
      const isTheirs = (b: Bed) => b.id === t.bedId && (!b.tenantId || b.tenantId === t.id);
      if (oldRoomId === roomId) targetBeds = targetBeds.map((b) => (isTheirs(b) && b.id !== bedId ? freeBed(b) : b));
      tx.update(targetRoomRef, { beds: targetBeds });
      if (oldRoomSnap?.exists()) {
        const oldBeds = ((oldRoomSnap.data().beds || []) as Bed[]).map((b) => (isTheirs(b) ? freeBed(b) : b));
        tx.update(oldRoomSnap.ref, { beds: oldBeds });
      }

      const rent = bed.pricePerMonth || room.pricePerBed || 0;
      const isTransfer = !!oldRoomId;
      const billFirstMonth = !isTransfer && rent > 0 && (!(Number(t.monthlyRent) > 0) || !!t.checkOutDate);
      const due = Number(t.dueAmount) || 0;
      const advance = Number(t.advanceBalance) || 0;
      const fromAdvance = billFirstMonth ? Math.min(advance, rent) : 0;
      const newDue = billFirstMonth ? round2(due + rent - fromAdvance) : due;

      tx.update(tenantRef, {
        roomId: room.id,
        roomNumber: room.roomNumber,
        bedId: bed.id,
        bedLabel: bed.bedLabel,
        floor: room.floor,
        monthlyRent: rent || t.monthlyRent || 0,
        securityDeposit: Number(t.securityDeposit) > 0 ? t.securityDeposit : room.securityDeposit || 0,
        dueAmount: newDue,
        rentStatus: newDue > 0 ? (billFirstMonth ? 'due' : t.rentStatus === 'paid' ? 'due' : t.rentStatus) : 'paid',
        ...(billFirstMonth ? { lastRentPeriod: today.slice(0, 7) } : {}),
        ...(fromAdvance > 0 ? { advanceBalance: round2(advance - fromAdvance) } : {}),
        // Re-admitting someone who had moved out brings them back to Tenants.
        ...(t.checkOutDate ? { checkOutDate: deleteField(), exitSettlement: deleteField(), checkInDate: today } : {}),
        ...(t.preferredRoomId ? { preferredRoomId: deleteField() } : {}),
        updatedAt: nowIso(),
      });
      if (billFirstMonth) {
        tx.set(doc(collection(db, 'charges')), {
          ...firstMonthCharge(t.id, t.name, rent),
          propertyId: room.propertyId,
          ...(fromAdvance > 0 ? { notes: `₹${fromAdvance} adjusted from advance` } : {}),
        });
      }
      summary = isTransfer
        ? `Moved ${t.name} from Room ${t.roomNumber} to Room ${room.roomNumber} (${bed.bedLabel})`
        : `Assigned ${t.name} to Room ${room.roomNumber} (${bed.bedLabel})`;
    });
    logActivity('bed.assign', summary);
  };

  const vacateBed = async (roomId: string, bedId: string): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    let label = '';
    await runTransaction(db, async (tx) => {
      const rSnap = await tx.get(roomRef);
      if (!rSnap.exists()) throw new Error('Room not found.');
      const room = { id: rSnap.id, ...rSnap.data() } as Room;
      const bed = room.beds.find((b) => b.id === bedId);
      if (!bed) throw new Error('Bed not found.');
      const tSnap = bed.tenantId ? await tx.get(doc(db, 'tenants', bed.tenantId)) : null;
      tx.update(roomRef, { beds: room.beds.map((b) => (b.id === bedId ? freeBed(b) : b)) });
      // Only unlink the tenant if this really is their bed. Moving out (exit
      // date, settlement) is completeExit's job, not this.
      if (tSnap?.exists() && tSnap.data().bedId === bedId) {
        tx.update(tSnap.ref, {
          roomId: deleteField(),
          roomNumber: deleteField(),
          bedId: deleteField(),
          bedLabel: deleteField(),
          updatedAt: nowIso(),
        });
      }
      label = `${bed.bedLabel} in Room ${room.roomNumber}`;
    });
    logActivity('bed.vacate', `Vacated ${label}`);
  };

  const transferBed = (tenantId: string, targetRoomId: string, targetBedId: string): Promise<void> =>
    assignBed(targetRoomId, targetBedId, tenantId);

  const completeExit = async (
    tenantId: string,
    exit: { exitDate: string; settlement: ExitSettlement; depositOffset: number }
  ): Promise<void> => {
    const tenantRef = doc(db, 'tenants', tenantId);
    let name = '';
    await runTransaction(db, async (tx) => {
      const tSnap = await tx.get(tenantRef);
      if (!tSnap.exists()) throw new Error('Tenant not found.');
      const t = { id: tSnap.id, ...tSnap.data() } as Tenant;
      if (t.checkOutDate) throw new Error(`${t.name} has already moved out.`);
      const roomSnap = t.roomId ? await tx.get(doc(db, 'rooms', t.roomId)) : null;
      if (roomSnap?.exists()) {
        const beds = ((roomSnap.data().beds || []) as Bed[]).map((b) =>
          b.id === t.bedId && (!b.tenantId || b.tenantId === t.id) ? freeBed(b) : b
        );
        tx.update(roomSnap.ref, { beds });
      }
      const due = Number(t.dueAmount) || 0;
      const offset = Math.min(Math.max(0, exit.depositOffset), due);
      const newDue = round2(due - offset);
      tx.update(tenantRef, {
        roomId: deleteField(),
        roomNumber: deleteField(),
        bedId: deleteField(),
        bedLabel: deleteField(),
        checkOutDate: exit.exitDate,
        exitSettlement: exit.settlement,
        dueAmount: newDue,
        rentStatus: newDue > 0 ? t.rentStatus : 'paid',
        // The deposit is settled (refunded / adjusted) at exit.
        depositReceived: 0,
        depositBilled: 0,
        depositPaid: false,
        updatedAt: nowIso(),
      });
      name = t.name;
    });
    logActivity(
      'tenant.exit',
      `Checked out ${name} (deposit ₹${exit.settlement.depositHeld.toLocaleString('en-IN')}, refund ₹${exit.settlement.refundAmount.toLocaleString('en-IN')})`
    );
  };

  // --- Tenants & KYC ------------------------------------------------------------

  // The first month's rent is recorded as a charge, so a tenant's statement
  // (charges minus payments) always adds up to their dues.
  const firstMonthCharge = (tenantId: string, tenantName: string, amount: number): Omit<DueCharge, 'id'> => ({
    propertyId: activePropertyId || '',
    tenantId,
    tenantName,
    categoryId: 'auto-rent',
    categoryName: `Rent - ${monthLabelIST()} (first month)`,
    categoryType: 'rent',
    amount,
    date: todayIST(),
    addedBy: 'system',
  });

  const addTenant = (tenantData: {
    name: string;
    email?: string;
    phone: string;
    hometown?: string;
    roomId?: string;
    bedId?: string;
    monthlyRent?: number;
    securityDeposit?: number;
    checkInDate?: string;
  }): string => {
    if (!activePropertyId) return '';
    const targetRoom = tenantData.roomId ? rooms.find((r) => r.id === tenantData.roomId) : undefined;
    const targetBed = targetRoom && tenantData.bedId ? targetRoom.beds.find((b) => b.id === tenantData.bedId) : undefined;

    // No made-up fallback amounts - 0 means "not set yet" for the owner to fill in.
    const rent = tenantData.monthlyRent || targetBed?.pricePerMonth || targetRoom?.pricePerBed || 0;
    const deposit = tenantData.securityDeposit || targetRoom?.securityDeposit || 0;
    const floor = targetRoom ? targetRoom.floor : 1;

    const ref = doc(collection(db, 'tenants'));
    const checkInDate = tenantData.checkInDate || todayIST();
    const newTenant: Tenant = {
      id: ref.id,
      propertyId: activePropertyId,
      name: tenantData.name,
      // No made-up address - empty until the tenant gives their real email.
      email: (tenantData.email || '').trim().toLowerCase(),
      phone: normalizePhone(tenantData.phone),
      photoUrl: '', // no photo yet - TenantAvatar shows initials
      floor,
      monthlyRent: rent,
      securityDeposit: deposit,
      depositPaid: false,
      depositReceived: 0,
      checkInDate,
      rentStatus: rent > 0 ? 'due' : 'paid',
      dueAmount: rent, // first month
      ...(rent > 0 ? { lastRentPeriod: todayIST().slice(0, 7) } : {}),
      hometown: tenantData.hometown || '',
      kyc: emptyKYC(),
      inviteToken: newInviteToken(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    // The tenant and their bed are written together, and only if the bed is
    // still vacant - otherwise the tenant is saved without a bed.
    runTransaction(db, async (tx) => {
      const roomSnap = targetRoom && targetBed ? await tx.get(doc(db, 'rooms', targetRoom.id)) : null;
      const freshBeds = roomSnap?.exists() ? ((roomSnap.data().beds || []) as Bed[]) : [];
      const freshBed = freshBeds.find((b) => b.id === targetBed?.id);
      if (roomSnap && targetRoom && freshBed && freshBed.status === 'vacant') {
        tx.update(roomSnap.ref, {
          beds: freshBeds.map((b) =>
            b.id === freshBed.id
              ? { ...b, status: 'occupied' as const, tenantId: ref.id, tenantName: tenantData.name, lastUpdated: nowIso() }
              : b
          ),
        });
        tx.set(ref, { ...newTenant, roomId: targetRoom.id, roomNumber: targetRoom.roomNumber, bedId: freshBed.id, bedLabel: freshBed.bedLabel });
        if (rent > 0) tx.set(doc(collection(db, 'charges')), firstMonthCharge(ref.id, tenantData.name, rent));
        return true;
      }
      tx.set(ref, newTenant);
      if (rent > 0) tx.set(doc(collection(db, 'charges')), firstMonthCharge(ref.id, tenantData.name, rent));
      return !targetBed;
    })
      .then((gotBed) => {
        logActivity('tenant.add', `Added tenant ${tenantData.name}`);
        if (!gotBed) window.alert(`${tenantData.name} was added, but the chosen bed was just taken - assign a bed from the Bed Matrix.`);
      })
      .catch((e) => {
        console.warn('addTenant failed', e);
        window.alert(`Could not add ${tenantData.name}: ${e?.message || 'please try again.'}`);
      });

    return ref.id;
  };

  const updateTenant = (tenantId: string, updates: Partial<Tenant>) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    saveTenant(tenantId, updates)
      .then(() => logActivity('tenant.update', `Updated tenant ${tenant?.name || tenantId}`))
      .catch((e) => console.warn('updateTenant failed', e));
  };

  const deleteTenant = async (tenantId: string): Promise<void> => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant || role !== 'owner' || ownerProfile?.role !== 'owner') return;
    // A resident still in a bed must go through exit formalities first.
    if (tenant.roomId && tenant.bedId) throw new Error('This resident still has a bed. Complete their exit first.');
    // Free the tenant's login first so the same email can be registered again.
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/tenant/remove-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tenantId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Could not remove the tenant login.');
    await removeTenant(tenantId);
    logActivity('tenant.delete', `Permanently deleted tenant ${tenant.name}`);
  };

  const submitKYC = async (tenantId: string, kycData: Partial<TenantKYC>): Promise<void> => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('Tenant not found.');
    const aadhaarNumber = String(kycData.aadhaar?.aadhaarNumber ?? tenant.kyc?.aadhaar?.aadhaarNumber ?? '').replace(/\D/g, '');
    const updatedKYC: TenantKYC = {
      ...tenant.kyc,
      ...kycData,
      // Always lands as pending for owner review (firestore.rules also
      // refuse anything else from a tenant).
      status: 'pending',
      verifiedByOwner: false,
      submittedAt: todayIST(),
      aadhaar: {
        ...tenant.kyc.aadhaar,
        ...(kycData.aadhaar || {}),
        aadhaarNumber,
        aadhaarLast4: aadhaarNumber.slice(-4),
        verificationMethod: 'manual',
      },
    };
    // Firestore rejects `undefined` anywhere in the data - drop such fields.
    await saveTenant(tenantId, { kyc: JSON.parse(JSON.stringify(updatedKYC)) });
    logActivity('kyc.submit', `Submitted KYC for ${tenant.name}`);
  };

  const approveKYC = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    saveTenant(tenantId, {
      kyc: {
        ...tenant.kyc,
        status: 'verified',
        verifiedByOwner: true,
        aadhaar: { ...tenant.kyc.aadhaar, verifiedAt: todayIST() },
      },
      // Verified - the KYC invite link has no further use.
      inviteToken: deleteField(),
    } as unknown as Partial<Tenant>)
      .then(() => logActivity('kyc.approve', `Approved KYC for ${tenant.name}`))
      .catch((e) => console.warn('approveKYC failed', e));
  };

  const rejectKYC = (tenantId: string, reason: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    saveTenant(tenantId, {
      kyc: {
        ...tenant.kyc,
        status: 'rejected',
        verifiedByOwner: false,
        aadhaar: { ...tenant.kyc.aadhaar, rejectionReason: reason },
      },
    })
      .then(() => logActivity('kyc.reject', `Rejected KYC for ${tenant.name}: ${reason}`))
      .catch((e) => console.warn('rejectKYC failed', e));
  };

  // --- Payments ------------------------------------------------------------------
  // Async: the receipt number comes from an atomic Firestore counter (see
  // firestoreService.nextReceiptNumber) so two concurrent payments can never
  // collide, unlike the old client-side `payments.length + 1` numbering.

  // Deposit billed as charges during the current stay (for records from
  // before depositBilled was tracked).
  const depositChargesFor = (tenantId: string) => {
    const since = tenants.find((t) => t.id === tenantId)?.checkInDate || '';
    return charges
      .filter((c) => c.tenantId === tenantId && c.categoryType === 'deposit' && (c.date || '') >= since)
      .reduce((s, c) => s + c.amount, 0);
  };

  const recordPayment = async (paymentData: {
    tenantId: string;
    amount: number;
    month: string;
    paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';
    transactionId?: string;
    notes?: string;
    purpose?: 'rent' | 'deposit';
  }): Promise<PaymentRecord> => {
    if (!activePropertyId) throw new Error('No active property selected');
    const propertyId = activePropertyId;
    const amount = round2(Number(paymentData.amount));
    if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
    const purpose = paymentData.purpose || 'rent';
    const today = todayIST();
    const paymentRef = doc(collection(db, 'payments'));
    const tenantRef = doc(db, 'tenants', paymentData.tenantId);
    const counterRef = receiptCounterRef(propertyId);
    const depositBilledFallback = depositChargesFor(paymentData.tenantId);

    // Receipt number, payment and tenant balance in one transaction.
    const newPayment = await runTransaction(db, async (tx) => {
      const tSnap = await tx.get(tenantRef);
      const cSnap = await tx.get(counterRef);
      if (!tSnap.exists()) throw new Error('Tenant not found.');
      const t = { id: tSnap.id, ...tSnap.data() } as Tenant;
      const seq = (cSnap.exists() ? Number(cSnap.data().value) || 0 : 0) + 1;
      const { newDue, updates } = settlePayment(t, amount, purpose, depositBilledFallback);
      const record: Omit<PaymentRecord, 'id'> = {
        propertyId,
        tenantId: t.id,
        tenantName: t.name || 'Tenant',
        roomNumber: t.roomNumber || 'N/A',
        bedLabel: t.bedLabel || 'N/A',
        floor: t.floor || 1,
        month: paymentData.month,
        amount,
        dueAmount: newDue,
        status: 'paid',
        purpose,
        paymentMode: paymentData.paymentMode,
        // Recorded by hand - no payment gateway configured yet.
        verificationSource: 'manual',
        transactionId: paymentData.transactionId || `TXN-${Date.now().toString().slice(-6)}`,
        paymentDate: today,
        receiptNumber: formatReceiptNumber(seq),
        ...(paymentData.notes ? { notes: paymentData.notes } : {}),
      };
      tx.set(counterRef, { value: seq }, { merge: true });
      tx.set(paymentRef, record);
      tx.update(tenantRef, { ...updates, lastPaymentDate: today, updatedAt: nowIso() });
      return record;
    });

    logActivity(
      'payment.record',
      `Recorded ₹${amount.toLocaleString('en-IN')} ${paymentData.paymentMode} ${purpose === 'deposit' ? 'deposit' : 'payment'} for ${newPayment.tenantName} (${paymentData.month})`
    );
    return { id: paymentRef.id, ...newPayment };
  };

  // A tenant paying via the displayed UPI QR / deep-link happens outside the
  // app, so this only *reports* the payment with its UTR. It does NOT touch
  // the tenant's balance and gets no receipt number until owner/staff
  // confirm it against their bank/UPI statement (confirmPendingPayment).
  const payRentAsTenant = async (
    tenantId: string,
    amount: number,
    mode: 'UPI' | 'Card' | 'Bank Transfer',
    utr: string
  ): Promise<PaymentRecord> => {
    if (!activePropertyId) throw new Error('No active property selected');
    const reference = utr.trim();
    if (!/^[A-Za-z0-9]{6,30}$/.test(reference)) throw new Error('Enter the UTR / reference number from your UPI app.');
    const value = round2(Number(amount));
    if (!(value > 0)) throw new Error('Nothing to pay right now.');
    const tenant = tenants.find((t) => t.id === tenantId);

    const newPayment: Omit<PaymentRecord, 'id'> = {
      propertyId: activePropertyId,
      tenantId,
      tenantName: tenant?.name || 'Tenant',
      roomNumber: tenant?.roomNumber || 'N/A',
      bedLabel: tenant?.bedLabel || 'N/A',
      floor: tenant?.floor || 1,
      month: monthLabelIST(),
      amount: value,
      dueAmount: tenant?.dueAmount || 0,
      status: 'pending',
      purpose: 'rent',
      paymentMode: mode,
      verificationSource: 'manual',
      transactionId: reference,
      paymentDate: todayIST(),
      receiptNumber: '',
      notes: 'Reported paid by tenant - awaiting owner confirmation',
    };

    const id = await createPayment(newPayment);
    return { id, ...newPayment };
  };

  // Owner/staff confirm a tenant-reported payment actually arrived: only now
  // does it reduce the balance and get a receipt number. Runs as one
  // transaction that first checks the payment is still pending, so two
  // people confirming at once can't count it twice.
  const confirmPendingPayment = async (paymentId: string): Promise<void> => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error('Payment not found.');
    const paymentRef = doc(db, 'payments', paymentId);
    const tenantRef = doc(db, 'tenants', payment.tenantId);
    const counterRef = receiptCounterRef(payment.propertyId);
    const depositBilledFallback = depositChargesFor(payment.tenantId);

    await runTransaction(db, async (tx) => {
      const pSnap = await tx.get(paymentRef);
      const tSnap = await tx.get(tenantRef);
      const cSnap = await tx.get(counterRef);
      if (!pSnap.exists() || pSnap.data().status !== 'pending') throw new Error('This payment was already confirmed.');
      const p = pSnap.data() as PaymentRecord;
      // Always our own receipt number - never one supplied with the claim.
      const seq = (cSnap.exists() ? Number(cSnap.data().value) || 0 : 0) + 1;
      const receiptNumber = formatReceiptNumber(seq);
      let newDue = 0;
      if (tSnap.exists()) {
        const t = { id: tSnap.id, ...tSnap.data() } as Tenant;
        const settled = settlePayment(t, Number(p.amount) || 0, 'rent', depositBilledFallback);
        newDue = settled.newDue;
        tx.update(tenantRef, { ...settled.updates, lastPaymentDate: p.paymentDate, updatedAt: nowIso() });
      }
      tx.set(counterRef, { value: seq }, { merge: true });
      tx.update(paymentRef, { status: 'paid', dueAmount: newDue, receiptNumber, confirmedAt: nowIso() });
    });
    logActivity('payment.confirm', `Confirmed ₹${payment.amount.toLocaleString('en-IN')} payment for ${payment.tenantName}`);
  };

  // --- Notices & tickets -----------------------------------------------------

  const addNotice = (notice: Omit<Notice, 'id' | 'date' | 'propertyId'>) => {
    if (!activePropertyId) return;
    const ref = doc(collection(db, 'notices'));
    const newNotice: Notice = { id: ref.id, propertyId: activePropertyId, ...notice, date: todayIST() };
    setDoc(ref, newNotice)
      .then(() => logActivity('notice.add', `Posted notice "${notice.title}"`))
      .catch((e) => console.warn('addNotice failed', e));
  };

  const deleteNotice = (id: string) => {
    const notice = notices.find((n) => n.id === id);
    removeNotice(id)
      .then(() => logActivity('notice.delete', `Deleted notice "${notice?.title || id}"`))
      .catch((e) => console.warn('deleteNotice failed', e));
  };

  const raiseTicket = (ticket: Omit<MaintenanceTicket, 'id' | 'createdAt' | 'status' | 'propertyId'>) => {
    if (!activePropertyId) return;
    const ref = doc(collection(db, 'tickets'));
    const newTicket: MaintenanceTicket = {
      id: ref.id,
      propertyId: activePropertyId,
      ...ticket,
      status: 'Open',
      createdAt: todayIST(),
    };
    setDoc(ref, newTicket)
      .then(() => logActivity('ticket.raise', `Raised ${ticket.category} ticket for ${ticket.tenantName}`))
      .catch((e) => console.warn('raiseTicket failed', e));
  };

  const updateTicketStatus = (id: string, status: MaintenanceTicket['status'], adminNote?: string) => {
    const ticket = tickets.find((t) => t.id === id);
    // Firestore rejects `undefined` values - only send fields that have one.
    saveTicket(id, {
      status,
      ...(adminNote !== undefined ? { adminNote } : {}),
      ...(status === 'Resolved' ? { resolvedAt: todayIST() } : {}),
    })
      .then(() => logActivity('ticket.update', `Updated ${ticket?.tenantName || 'a'} ticket to "${status}"`))
      .catch((e) => console.warn('updateTicketStatus failed', e));
  };

  // --- Helpers -----------------------------------------------------------------

  const getRoommates = (tenantId: string): Tenant[] => {
    // A tenant can't read other tenants' records - their roommates come
    // from the server (see the tenant effects above).
    if (role === 'tenant') return tenantRoommates;
    const targetTenant = tenants.find((t) => t.id === tenantId);
    if (!targetTenant || !targetTenant.roomId) return [];
    return tenants.filter((t) => t.roomId === targetTenant.roomId && t.id !== tenantId && !t.checkOutDate);
  };

  const getStats = useCallback(() => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let totalExpectedRevenue = 0;

    rooms.forEach((r) => {
      totalBeds += r.beds.length;
      r.beds.forEach((b) => {
        if (b.status === 'occupied') occupiedBeds++;
      });
    });

    // Expected = the rent each staying resident actually agreed to (not the
    // bed's list price). Received = confirmed rent/dues payments this month
    // (India time) - not all-time, and never deposits or pending claims.
    const staying = tenants.filter((t) => !t.checkOutDate && t.bedId);
    totalExpectedRevenue = staying.reduce((sum, t) => sum + (Number(t.monthlyRent) || 0), 0);
    const thisMonth = todayIST().slice(0, 7);
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const totalReceivedRevenue = payments
      .filter((p) => p.status === 'paid' && p.purpose !== 'deposit' && (p.paymentDate || '').slice(0, 7) === thisMonth)
      .reduce((sum, p) => sum + p.amount, 0);
    const totalDueRevenue = tenants.filter((t) => !t.checkOutDate).reduce((sum, t) => sum + (t.dueAmount || 0), 0);
    const verifiedKYCCount = tenants.filter((t) => t.kyc?.status === 'verified').length;
    const pendingKYCCount = tenants.filter((t) => t.kyc?.status === 'pending').length;
    const unsubmittedKYCCount = tenants.filter((t) => !t.kyc || t.kyc?.status === 'unsubmitted' || t.kyc?.status === 'rejected').length;

    const floorCount = activeProperty?.totalFloors || 4;
    const floorSummaries: FloorSummary[] = Array.from({ length: floorCount }, (_, i) => i + 1).map((floorNum) => {
      const floorRooms = rooms.filter((r) => r.floor === floorNum);
      let fTotalBeds = 0;
      let fOccupiedBeds = 0;
      let fTotalRent = 0;
      floorRooms.forEach((r) => {
        fTotalBeds += r.beds.length;
        r.beds.forEach((b) => {
          if (b.status === 'occupied') fOccupiedBeds++;
        });
        fTotalRent += staying.filter((t) => t.roomId === r.id).reduce((s, t) => s + (Number(t.monthlyRent) || 0), 0);
      });
      return {
        floor: floorNum,
        totalRooms: floorRooms.length,
        totalBeds: fTotalBeds,
        occupiedBeds: fOccupiedBeds,
        vacantBeds: fTotalBeds - fOccupiedBeds,
        occupancyRate: fTotalBeds > 0 ? Math.round((fOccupiedBeds / fTotalBeds) * 100) : 0,
        totalRent: fTotalRent,
      };
    });

    return {
      totalRooms: rooms.length,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
      totalExpectedRevenue,
      totalReceivedRevenue,
      totalDueRevenue,
      verifiedKYCCount,
      pendingKYCCount,
      unsubmittedKYCCount,
      floorSummaries,
    };
  }, [rooms, tenants, payments, activeProperty]);

  const refreshStateFromServer = async () => {
    // Intentional no-op - Firestore onSnapshot listeners keep state live.
  };

  return (
    <PGContext.Provider
      value={{
        authUser,
        authLoading,
        isAuthenticated,
        setIsAuthenticated,
        role,
        setRole,
        currentTenantId,
        setCurrentTenantId,
        activeTenant,
        logout,
        ownerProfile,
        mustChangePassword,
        clearMustChangePassword,
        properties,
        activePropertyId,
        activeProperty,
        switchProperty,
        createNewProperty,
        updatePropertySettings,
        addRoomType,
        updateRoomType,
        deleteRoomType,
        addSharingOption,
        updateSharingOption,
        deleteSharingOption,
        addDuesCategory,
        updateDuesCategory,
        deleteDuesCategory,
        charges,
        addDueCharge,
        activityLogs,
        addAgreementTemplate,
        updateAgreementTemplate,
        deleteAgreementTemplate,
        settings,
        updateSettings,
        rooms,
        tenants,
        payments,
        notices,
        tickets,
        addRoom,
        updateRoom,
        deleteRoom,
        assignBed,
        vacateBed,
        transferBed,
        completeExit,
        addTenant,
        updateTenant,
        deleteTenant,
        submitKYC,
        approveKYC,
        rejectKYC,
        recordPayment,
        payRentAsTenant,
        confirmPendingPayment,
        addNotice,
        deleteNotice,
        raiseTicket,
        updateTicketStatus,
        getRoommates,
        getStats,
        refreshStateFromServer,
      }}
    >
      {children}
    </PGContext.Provider>
  );
};

export const usePG = () => {
  const context = useContext(PGContext);
  if (!context) {
    throw new Error('usePG must be used within a PGProvider');
  }
  return context;
};
