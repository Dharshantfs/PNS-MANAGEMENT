// Firestore data-access layer. Every read is a real-time `onSnapshot` listener
// (replaces the old localStorage + `/api/state` 3.5s-polling approach) and every
// write goes straight to Firestore. Collections are scoped by `propertyId` so one
// owner account can run several properties without their data mixing.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  DueCharge,
  MaintenanceTicket,
  Notice,
  OwnerProfile,
  PaymentRecord,
  Property,
  Room,
  Tenant,
} from '../types';

export const nowIso = () => new Date().toISOString();

// Canonical phone format used everywhere a tenant's number is stored
// (+91XXXXXXXXXX, no spaces) so exact-match Firestore queries on `phone`
// work reliably instead of needing a full-collection client-side scan.
export const normalizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  return `+91${digits.slice(-10)}`;
};

const fromDocs = <T>(snap: QuerySnapshot<DocumentData>): T[] =>
  snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

// ---------------------------------------------------------------------------
// Owner profile (users/{uid}) — which properties this account can access.
// ---------------------------------------------------------------------------

export async function getOwnerProfile(uid: string): Promise<OwnerProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ uid, ...snap.data() } as OwnerProfile) : null;
}

// Used to load properties an invited team member has access to (their own
// users/{uid}.propertyIds, set server-side at invite time - see
// api/_lib/app.ts POST /api/team/invite). The property creator
// doesn't need this: isOwnerOfProperty in firestore.rules also matches a
// property's own `ownerId` field directly.
export async function getPropertiesByIds(ids: string[]): Promise<Property[]> {
  const results = await Promise.all(ids.map((id) => getProperty(id)));
  return results.filter((p): p is Property => p !== null);
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export function subscribeOwnerProperties(
  ownerId: string,
  cb: (properties: Property[]) => void
): () => void {
  const q = query(collection(db, 'properties'), where('ownerId', '==', ownerId));
  return onSnapshot(q, (snap) => cb(fromDocs<Property>(snap)));
}

export async function createProperty(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'properties'), {
    ...data,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return ref.id;
}

export async function updateProperty(propertyId: string, updates: Partial<Property>): Promise<void> {
  await updateDoc(doc(db, 'properties', propertyId), { ...updates, updatedAt: nowIso() });
}

// Used by the public tenant self-onboarding page when no `?property=` id is
// given in the link - falls back to whichever property was created first.
// Fine for an owner running a single property; owners with several should
// share onboarding links that include `?property=<id>`.
export async function getFirstProperty(): Promise<Property | null> {
  const snap = await getDocs(query(collection(db, 'properties'), orderBy('createdAt', 'asc'), limit(1)));
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Property) : null;
}

export async function getProperty(propertyId: string): Promise<Property | null> {
  const snap = await getDoc(doc(db, 'properties', propertyId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Property) : null;
}

// Cross-property phone lookup used by tenant login and public onboarding (a
// tenant doesn't know their own doc id ahead of time). Uses an exact-match
// query - not a full collection scan - so Firestore rules can restrict reads
// to "one matching document by phone" instead of exposing the whole
// `tenants` collection (which holds Aadhaar/KYC data) to anyone.
export async function findTenantByPhone(phone: string): Promise<Tenant | null> {
  const normalized = normalizePhone(phone);
  if (normalized === '+91') return null;
  const snap = await getDocs(query(collection(db, 'tenants'), where('phone', '==', normalized), limit(1)));
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Tenant) : null;
}

// ---------------------------------------------------------------------------
// Generic property-scoped collection helpers
// ---------------------------------------------------------------------------

function subscribeScoped<T>(
  collectionName: string,
  propertyId: string,
  cb: (items: T[]) => void
): () => void {
  const q = query(collection(db, collectionName), where('propertyId', '==', propertyId));
  return onSnapshot(q, (snap) => cb(fromDocs<T>(snap)));
}

export const subscribeRooms = (propertyId: string, cb: (rooms: Room[]) => void) =>
  subscribeScoped<Room>('rooms', propertyId, cb);

export const subscribeTenants = (propertyId: string, cb: (tenants: Tenant[]) => void) =>
  subscribeScoped<Tenant>('tenants', propertyId, cb);

export const subscribePayments = (propertyId: string, cb: (payments: PaymentRecord[]) => void) =>
  subscribeScoped<PaymentRecord>('payments', propertyId, cb);

export const subscribeNotices = (propertyId: string, cb: (notices: Notice[]) => void) =>
  subscribeScoped<Notice>('notices', propertyId, cb);

export const subscribeTickets = (propertyId: string, cb: (tickets: MaintenanceTicket[]) => void) =>
  subscribeScoped<MaintenanceTicket>('tickets', propertyId, cb);

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function createRoom(room: Omit<Room, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'rooms'), room);
  return ref.id;
}

export async function saveRoom(roomId: string, updates: Partial<Room>): Promise<void> {
  await updateDoc(doc(db, 'rooms', roomId), updates as DocumentData);
}

export async function removeRoom(roomId: string): Promise<void> {
  await deleteDoc(doc(db, 'rooms', roomId));
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export async function createTenant(tenant: Omit<Tenant, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tenants'), {
    ...tenant,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return ref.id;
}

export async function saveTenant(tenantId: string, updates: Partial<Tenant>): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId), { ...updates, updatedAt: nowIso() } as DocumentData);
}

// ---------------------------------------------------------------------------
// Payments — receipt numbers are generated atomically per property via a
// Firestore counter document, so two concurrent payments can never collide
// (the old client-side `payments.length + 1` numbering could).
// ---------------------------------------------------------------------------

export async function nextReceiptNumber(propertyId: string): Promise<string> {
  const counterRef = doc(db, 'properties', propertyId, 'counters', 'receipts');
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');

  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });

  return `PG-REC-${year}-${month}-${String(seq).padStart(3, '0')}`;
}

export async function createPayment(payment: Omit<PaymentRecord, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'payments'), payment);
  return ref.id;
}

// ---------------------------------------------------------------------------
// Notices & tickets
// ---------------------------------------------------------------------------

export async function createNotice(notice: Omit<Notice, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'notices'), notice);
  return ref.id;
}

export async function removeNotice(noticeId: string): Promise<void> {
  await deleteDoc(doc(db, 'notices', noticeId));
}

export async function createTicket(ticket: Omit<MaintenanceTicket, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tickets'), ticket);
  return ref.id;
}

export async function saveTicket(ticketId: string, updates: Partial<MaintenanceTicket>): Promise<void> {
  await updateDoc(doc(db, 'tickets', ticketId), updates as DocumentData);
}

// ---------------------------------------------------------------------------
// Dues charges - see DueCharge in types.ts.
// ---------------------------------------------------------------------------

export const subscribeCharges = (propertyId: string, cb: (charges: DueCharge[]) => void) =>
  subscribeScoped<DueCharge>('charges', propertyId, cb);

export async function createCharge(charge: Omit<DueCharge, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'charges'), charge);
  return ref.id;
}
