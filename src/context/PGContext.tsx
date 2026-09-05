import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
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
  OwnerProfile,
} from '../types';
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
  createTenant,
  saveTenant,
  createPayment,
  nextReceiptNumber,
  createNotice,
  removeNotice,
  createTicket,
  saveTicket,
  createCharge,
  getOwnerProfile,
  getPropertiesByIds,
  findTenantByPhone,
  normalizePhone,
  nowIso,
} from '../services/firestoreService';
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
  deleteRoom: (roomId: string) => void;
  assignBed: (roomId: string, bedId: string, tenantId: string) => boolean;
  vacateBed: (roomId: string, bedId: string) => void;
  transferBed: (tenantId: string, targetRoomId: string, targetBedId: string) => boolean;

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
  submitKYC: (tenantId: string, kycData: Partial<TenantKYC>) => void;
  approveKYC: (tenantId: string) => void;
  rejectKYC: (tenantId: string, reason: string) => void;

  // Payments (async - receipt numbers are generated atomically server-side)
  recordPayment: (paymentData: {
    tenantId: string;
    amount: number;
    month: string;
    paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';
    transactionId?: string;
    notes?: string;
  }) => Promise<PaymentRecord>;
  payRentAsTenant: (
    tenantId: string,
    amount: number,
    mode: 'UPI' | 'Card' | 'Bank Transfer',
    transactionId: string
  ) => Promise<PaymentRecord>;
  confirmPendingPayment: (paymentId: string) => void;

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

  // --- Firebase Auth session -------------------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (!user) {
        setOwnerProfile(null);
        setProperties([]);
        setActivePropertyId(null);
        setRole('owner');
        return;
      }

      if (user.phoneNumber && !user.email) {
        // Tenant sign-in (phone OTP). Their property is discovered once their
        // tenant record loads (see tenant-lookup effect below).
        setRole('tenant');
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
  // invite time - see server/app.ts). A team member's own uid never becomes
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

  // --- Tenant: find their own tenant record + property by phone --------------
  useEffect(() => {
    if (!authUser || role !== 'tenant' || !authUser.phoneNumber) return;
    // Tenants aren't scoped to a known property before login, so this looks
    // across all tenant docs and filters client-side by phone match. Fine at
    // the scale of a handful of PG properties; would move to a Cloud Function
    // lookup if this ever needs to scale further.
    let cancelled = false;
    findTenantByPhone(authUser.phoneNumber).then((match) => {
      if (cancelled || !match) return;
      setCurrentTenantIdState(match.id);
      setActivePropertyId(match.propertyId);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser, role]);

  // --- Property-scoped live data ----------------------------------------------
  useEffect(() => {
    if (!activePropertyId) {
      setRooms([]);
      setTenants([]);
      setPayments([]);
      setNotices([]);
      setTickets([]);
      setCharges([]);
      return;
    }
    const unsubs = [
      subscribeRooms(activePropertyId, setRooms),
      subscribeTenants(activePropertyId, setTenants),
      subscribePayments(activePropertyId, setPayments),
      subscribeNotices(activePropertyId, setNotices),
      subscribeTickets(activePropertyId, setTickets),
      subscribeCharges(activePropertyId, setCharges),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activePropertyId]);

  useEffect(() => {
    if (authUser?.uid && activePropertyId) {
      localStorage.setItem(ACTIVE_PROPERTY_KEY(authUser.uid), activePropertyId);
    }
  }, [authUser, activePropertyId]);

  const activeProperty = useMemo(
    () => properties.find((p) => p.id === activePropertyId),
    [properties, activePropertyId]
  );

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
    });
    // No need to also record this on the profile's propertyIds - the
    // creator is granted access via the property's own `ownerId` field
    // (see isOwnerOfProperty in firestore.rules). propertyIds is only for
    // invited team members, set server-side at invite time.
    setActivePropertyId(id);
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
    return updatePropertySettings({ roomTypes: [...activeProperty.roomTypes, newType] });
  };

  const updateRoomType = (id: string, updates: Partial<RoomTypeConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    return updatePropertySettings({
      roomTypes: activeProperty.roomTypes.map((rt) => (rt.id === id ? { ...rt, ...updates } : rt)),
    });
  };

  const deleteRoomType = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    return updatePropertySettings({ roomTypes: activeProperty.roomTypes.filter((rt) => rt.id !== id) });
  };

  const addSharingOption = (occupancy: number, defaultRent: number, label?: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    const clamped = Math.min(6, Math.max(1, occupancy));
    const id = `sh-${Date.now()}`;
    return updatePropertySettings({
      sharingOptions: [
        ...activeProperty.sharingOptions,
        { id, occupancy: clamped, label: label || SHARING_LABELS[clamped] || `${clamped}-Sharing`, defaultRent },
      ],
    });
  };

  const updateSharingOption = (id: string, updates: Partial<SharingConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    return updatePropertySettings({
      sharingOptions: activeProperty.sharingOptions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const deleteSharingOption = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    return updatePropertySettings({ sharingOptions: activeProperty.sharingOptions.filter((s) => s.id !== id) });
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
    return updatePropertySettings({ duesCategories: [...(activeProperty.duesCategories || []), newCategory] });
  };

  const updateDuesCategory = (id: string, updates: Partial<DuesCategoryConfig>) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    return updatePropertySettings({
      duesCategories: (activeProperty.duesCategories || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const deleteDuesCategory = (id: string) => {
    if (!activeProperty) return Promise.reject(new Error('No active property'));
    return updatePropertySettings({ duesCategories: (activeProperty.duesCategories || []).filter((c) => c.id !== id) });
  };

  // Charges a tenant's account against a dues category (e.g. "add a Late
  // Fine of ₹200") - increases dueAmount immediately. Distinct from a
  // PaymentRecord, which represents money actually received against a due.
  const addDueCharge = async (tenantId: string, categoryId: string, amount: number, notes?: string): Promise<void> => {
    if (!activePropertyId || !activeProperty) throw new Error('No active property selected');
    const tenant = tenants.find((t) => t.id === tenantId);
    const category = (activeProperty.duesCategories || []).find((c) => c.id === categoryId);
    if (!tenant || !category) throw new Error('Tenant or dues category not found');

    const charge: Omit<DueCharge, 'id'> = {
      propertyId: activePropertyId,
      tenantId,
      tenantName: tenant.name,
      categoryId,
      categoryName: category.name,
      categoryType: category.categoryType,
      amount,
      date: nowIso().split('T')[0],
      notes,
      addedBy: 'owner',
    };
    await createCharge(charge);
    await saveTenant(tenantId, {
      dueAmount: tenant.dueAmount + amount,
      rentStatus: 'due',
    });
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
    if (Object.keys(propertyUpdates).length > 0) updatePropertySettings(propertyUpdates);
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

    setDoc(ref, newRoom).catch((e) => console.warn('addRoom failed', e));
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const patch: Partial<Room> = { ...updates };
    if (updates.pricePerBed !== undefined) {
      patch.beds = room.beds.map((b) => ({ ...b, pricePerMonth: updates.pricePerBed! }));
    }
    saveRoom(roomId, patch).catch((e) => console.warn('updateRoom failed', e));
  };

  const deleteRoom = (roomId: string) => {
    // Firestore's updateDoc() rejects a literal `undefined` field value -
    // deleteField() is the correct way to clear a field via a partial update.
    tenants
      .filter((t) => t.roomId === roomId)
      .forEach((t) =>
        saveTenant(t.id, {
          roomId: deleteField(),
          roomNumber: deleteField(),
          bedId: deleteField(),
          bedLabel: deleteField(),
        } as unknown as Partial<Tenant>).catch((e) => console.warn('deleteRoom(tenant) failed', e))
      );
    removeRoom(roomId).catch((e) => console.warn('deleteRoom failed', e));
  };

  const assignBed = (roomId: string, bedId: string, tenantId: string): boolean => {
    const tenant = tenants.find((t) => t.id === tenantId);
    const room = rooms.find((r) => r.id === roomId);
    const bed = room?.beds.find((b) => b.id === bedId);
    if (!tenant || !room || !bed) return false;

    if (tenant.roomId && tenant.bedId) {
      vacateBed(tenant.roomId, tenant.bedId);
    }

    const updatedBeds = room.beds.map((b) =>
      b.id === bedId
        ? {
            ...b,
            status: 'occupied' as const,
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantPhone: tenant.phone,
            lastUpdated: nowIso(),
          }
        : b
    );
    saveRoom(roomId, { beds: updatedBeds }).catch((e) => console.warn('assignBed(room) failed', e));

    saveTenant(tenantId, {
      roomId: room.id,
      roomNumber: room.roomNumber,
      bedId: bed.id,
      bedLabel: bed.bedLabel,
      floor: room.floor,
      monthlyRent: bed.pricePerMonth || room.pricePerBed,
      securityDeposit: room.securityDeposit,
      dueAmount: tenant.dueAmount > 0 ? tenant.dueAmount : bed.pricePerMonth || room.pricePerBed,
      rentStatus: tenant.rentStatus === 'paid' ? 'paid' : 'due',
    }).catch((e) => console.warn('assignBed(tenant) failed', e));

    return true;
  };

  const vacateBed = (roomId: string, bedId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    const bed = room?.beds.find((b) => b.id === bedId);
    if (!room || !bed) return;
    const tenantId = bed.tenantId;

    // Rebuilding the bed without the tenant fields entirely (rather than
    // setting them to `undefined`) - these live inside the `beds` array
    // being overwritten wholesale, where Firestore's deleteField() sentinel
    // doesn't apply (that only works on a direct top-level update field).
    const updatedBeds = room.beds.map((b): typeof b => {
      if (b.id !== bedId) return b;
      const { tenantId: _t, tenantName: _n, tenantPhone: _p, ...rest } = b;
      return { ...rest, status: 'vacant', lastUpdated: nowIso() };
    });
    saveRoom(roomId, { beds: updatedBeds }).catch((e) => console.warn('vacateBed(room) failed', e));

    if (tenantId) {
      saveTenant(tenantId, {
        roomId: deleteField(),
        roomNumber: deleteField(),
        bedId: deleteField(),
        bedLabel: deleteField(),
        checkOutDate: nowIso().split('T')[0],
      } as unknown as Partial<Tenant>).catch((e) => console.warn('vacateBed(tenant) failed', e));
    }
  };

  const transferBed = (tenantId: string, targetRoomId: string, targetBedId: string): boolean => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return false;
    if (tenant.roomId && tenant.bedId) vacateBed(tenant.roomId, tenant.bedId);
    return assignBed(targetRoomId, targetBedId, tenantId);
  };

  // --- Tenants & KYC ------------------------------------------------------------

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

    const rent = tenantData.monthlyRent || targetBed?.pricePerMonth || targetRoom?.pricePerBed || 8000;
    const deposit = tenantData.securityDeposit || targetRoom?.securityDeposit || 15000;
    const floor = targetRoom ? targetRoom.floor : 1;

    const ref = doc(collection(db, 'tenants'));
    const newTenant: Tenant = {
      id: ref.id,
      propertyId: activePropertyId,
      name: tenantData.name,
      email: tenantData.email || `${tenantData.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      phone: normalizePhone(tenantData.phone),
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      // Firestore rejects a literal `undefined` field value - only include
      // room/bed fields when a room was actually assigned (an unassigned
      // walk-in registration is a normal, common case, not an edge case).
      ...(targetRoom ? { roomId: targetRoom.id, roomNumber: targetRoom.roomNumber } : {}),
      ...(targetBed ? { bedId: targetBed.id, bedLabel: targetBed.bedLabel } : {}),
      floor,
      monthlyRent: rent,
      securityDeposit: deposit,
      depositPaid: false,
      checkInDate: tenantData.checkInDate || nowIso().split('T')[0],
      rentStatus: 'due',
      dueAmount: rent,
      hometown: tenantData.hometown || '',
      kyc: emptyKYC(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setDoc(ref, newTenant).catch((e) => console.warn('addTenant failed', e));

    if (targetRoom && targetBed) {
      const updatedBeds = targetRoom.beds.map((b) =>
        b.id === targetBed.id
          ? { ...b, status: 'occupied' as const, tenantId: ref.id, tenantName: tenantData.name, tenantPhone: tenantData.phone, lastUpdated: nowIso() }
          : b
      );
      saveRoom(targetRoom.id, { beds: updatedBeds }).catch((e) => console.warn('addTenant(room) failed', e));
    }

    return ref.id;
  };

  const updateTenant = (tenantId: string, updates: Partial<Tenant>) => {
    saveTenant(tenantId, updates).catch((e) => console.warn('updateTenant failed', e));
  };

  const submitKYC = (tenantId: string, kycData: Partial<TenantKYC>) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    const updatedKYC: TenantKYC = {
      ...tenant.kyc,
      ...kycData,
      status: 'pending',
      submittedAt: nowIso().split('T')[0],
      aadhaar: {
        ...tenant.kyc.aadhaar,
        ...(kycData.aadhaar || {}),
        verificationMethod: 'manual',
      },
    };
    saveTenant(tenantId, { kyc: updatedKYC }).catch((e) => console.warn('submitKYC failed', e));
  };

  const approveKYC = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;
    saveTenant(tenantId, {
      kyc: {
        ...tenant.kyc,
        status: 'verified',
        verifiedByOwner: true,
        aadhaar: { ...tenant.kyc.aadhaar, verifiedAt: nowIso().split('T')[0] },
      },
    }).catch((e) => console.warn('approveKYC failed', e));
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
    }).catch((e) => console.warn('rejectKYC failed', e));
  };

  // --- Payments ------------------------------------------------------------------
  // Async: the receipt number comes from an atomic Firestore counter (see
  // firestoreService.nextReceiptNumber) so two concurrent payments can never
  // collide, unlike the old client-side `payments.length + 1` numbering.

  const recordPayment = async (paymentData: {
    tenantId: string;
    amount: number;
    month: string;
    paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';
    transactionId?: string;
    notes?: string;
  }): Promise<PaymentRecord> => {
    if (!activePropertyId) throw new Error('No active property selected');
    const tenant = tenants.find((t) => t.id === paymentData.tenantId);
    const receiptNumber = await nextReceiptNumber(activePropertyId);
    const today = nowIso().split('T')[0];

    const newPayment: Omit<PaymentRecord, 'id'> = {
      propertyId: activePropertyId,
      tenantId: paymentData.tenantId,
      tenantName: tenant?.name || 'Tenant',
      roomNumber: tenant?.roomNumber || 'N/A',
      bedLabel: tenant?.bedLabel || 'N/A',
      floor: tenant?.floor || 1,
      month: paymentData.month,
      amount: paymentData.amount,
      dueAmount: 0,
      status: 'paid',
      paymentMode: paymentData.paymentMode,
      // Recorded by hand today - no Cashfree keys configured yet. See
      // PaymentVerificationSource in types.ts for the future gateway path.
      verificationSource: 'manual',
      transactionId: paymentData.transactionId || `TXN-${Date.now().toString().slice(-6)}`,
      paymentDate: today,
      receiptNumber,
      notes: paymentData.notes,
    };

    const id = await createPayment(newPayment);

    if (tenant) {
      const newDue = Math.max(0, tenant.dueAmount - paymentData.amount);
      await saveTenant(paymentData.tenantId, {
        dueAmount: newDue,
        rentStatus: newDue === 0 ? 'paid' : 'partial',
        lastPaymentDate: today,
      });
    }

    return { id, ...newPayment };
  };

  // A tenant paying via the displayed UPI QR/deep-link happens outside the
  // app (in GPay/PhonePe/etc.), so this only *reports* the payment - it does
  // NOT touch the tenant's due amount. It stays 'pending' until the owner
  // reconciles it against their bank/UPI statement (see confirmPendingPayment)
  // and reflects the current no-payment-gateway-keys-yet reality (see
  // PaymentVerificationSource in types.ts).
  const payRentAsTenant = async (
    tenantId: string,
    amount: number,
    mode: 'UPI' | 'Card' | 'Bank Transfer',
    transactionId: string
  ): Promise<PaymentRecord> => {
    if (!activePropertyId) throw new Error('No active property selected');
    const tenant = tenants.find((t) => t.id === tenantId);
    const currentMonth = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
    const receiptNumber = await nextReceiptNumber(activePropertyId);
    const today = nowIso().split('T')[0];

    const newPayment: Omit<PaymentRecord, 'id'> = {
      propertyId: activePropertyId,
      tenantId,
      tenantName: tenant?.name || 'Tenant',
      roomNumber: tenant?.roomNumber || 'N/A',
      bedLabel: tenant?.bedLabel || 'N/A',
      floor: tenant?.floor || 1,
      month: currentMonth,
      amount,
      dueAmount: tenant?.dueAmount || 0,
      status: 'pending',
      paymentMode: mode,
      verificationSource: 'manual',
      transactionId,
      paymentDate: today,
      receiptNumber,
      notes: 'Reported paid by tenant - awaiting owner reconciliation',
    };

    const id = await createPayment(newPayment);
    return { id, ...newPayment };
  };

  // Owner confirms a tenant-reported payment actually cleared: only now does
  // it count against the tenant's due amount.
  const confirmPendingPayment = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== 'pending') return;
    const tenant = tenants.find((t) => t.id === payment.tenantId);
    if (tenant) {
      const newDue = Math.max(0, tenant.dueAmount - payment.amount);
      saveTenant(tenant.id, {
        dueAmount: newDue,
        rentStatus: newDue === 0 ? 'paid' : 'partial',
        lastPaymentDate: payment.paymentDate,
      }).catch((e) => console.warn('confirmPendingPayment(tenant) failed', e));
    }
    updateDoc(doc(db, 'payments', paymentId), { status: 'paid', dueAmount: 0 });
  };

  // --- Notices & tickets -----------------------------------------------------

  const addNotice = (notice: Omit<Notice, 'id' | 'date' | 'propertyId'>) => {
    if (!activePropertyId) return;
    const ref = doc(collection(db, 'notices'));
    const newNotice: Notice = { id: ref.id, propertyId: activePropertyId, ...notice, date: nowIso().split('T')[0] };
    setDoc(ref, newNotice).catch((e) => console.warn('addNotice failed', e));
  };

  const deleteNotice = (id: string) => {
    removeNotice(id).catch((e) => console.warn('deleteNotice failed', e));
  };

  const raiseTicket = (ticket: Omit<MaintenanceTicket, 'id' | 'createdAt' | 'status' | 'propertyId'>) => {
    if (!activePropertyId) return;
    const ref = doc(collection(db, 'tickets'));
    const newTicket: MaintenanceTicket = {
      id: ref.id,
      propertyId: activePropertyId,
      ...ticket,
      status: 'Open',
      createdAt: nowIso().split('T')[0],
    };
    setDoc(ref, newTicket).catch((e) => console.warn('raiseTicket failed', e));
  };

  const updateTicketStatus = (id: string, status: MaintenanceTicket['status'], adminNote?: string) => {
    const ticket = tickets.find((t) => t.id === id);
    saveTicket(id, {
      status,
      adminNote: adminNote !== undefined ? adminNote : ticket?.adminNote,
      resolvedAt: status === 'Resolved' ? nowIso().split('T')[0] : ticket?.resolvedAt,
    }).catch((e) => console.warn('updateTicketStatus failed', e));
  };

  // --- Helpers -----------------------------------------------------------------

  const getRoommates = (tenantId: string): Tenant[] => {
    const targetTenant = tenants.find((t) => t.id === tenantId);
    if (!targetTenant || !targetTenant.roomId) return [];
    return tenants.filter((t) => t.roomId === targetTenant.roomId && t.id !== tenantId);
  };

  const getStats = useCallback(() => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let totalExpectedRevenue = 0;

    rooms.forEach((r) => {
      totalBeds += r.beds.length;
      r.beds.forEach((b) => {
        if (b.status === 'occupied') {
          occupiedBeds++;
          totalExpectedRevenue += b.pricePerMonth || r.pricePerBed;
        }
      });
    });

    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const totalReceivedRevenue = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const totalDueRevenue = tenants.reduce((sum, t) => sum + (t.dueAmount || 0), 0);
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
          if (b.status === 'occupied') {
            fOccupiedBeds++;
            fTotalRent += b.pricePerMonth || r.pricePerBed;
          }
        });
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
        addTenant,
        updateTenant,
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
