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
  ActivityLog,
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

// Calendar dates are always India time. `toISOString()` is UTC, which gives
// the previous day for anything done between 00:00 and 05:30 IST.
export const todayIST = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );

// "October 2026" - the month label used on payments and charges.
export const monthLabelIST = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }).format(date);

// Secret part of a tenant's KYC invite link - see api/_lib/app.ts.
export const newInviteToken = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Same rule as the server (api/_lib/app.ts inviteTokenExpired): links work
// for 7 days; tokens from before inviteTokenIssuedAt existed until 10 Nov 2026.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEGACY_INVITE_CUTOFF = Date.parse('2026-11-10T00:00:00+05:30');
export const inviteTokenExpired = (t: { inviteTokenIssuedAt?: string } | undefined): boolean => {
  const issued = Date.parse(String(t?.inviteTokenIssuedAt || ''));
  if (Number.isNaN(issued)) return Date.now() > LEGACY_INVITE_CUTOFF;
  return Date.now() - issued > INVITE_TTL_MS;
};

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

export async function getProperty(propertyId: string): Promise<Property | null> {
  const snap = await getDoc(doc(db, 'properties', propertyId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Property) : null;
}

// Finds an older phone-OTP tenant login's own record by its verified phone
// number (newer tenant logins carry their tenant id as a claim instead).
// firestore.rules only allow this query for the caller's own phone.
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
  return onSnapshot(q, (snap) => cb(fromDocs<T>(snap)), (err) => console.warn(`${collectionName} subscription failed`, err));
}

export const subscribeRooms = (propertyId: string, cb: (rooms: Room[]) => void) =>
  subscribeScoped<Room>('rooms', propertyId, cb);

export const subscribeTenants = (propertyId: string, cb: (tenants: Tenant[]) => void) =>
  subscribeScoped<Tenant>('tenants', propertyId, cb);

export const subscribePayments = (propertyId: string, cb: (payments: PaymentRecord[]) => void) =>
  subscribeScoped<PaymentRecord>('payments', propertyId, cb);

// Payments are only kept live for a recent window (see PAYMENTS_LIVE_MONTHS in
// PGContext) - the full history grows forever and every record would
// otherwise stream into the browser. Older payments are fetched once, on
// demand, for a report's date range or a tenant's statement.
//
// The date-window query needs the composite index (propertyId, paymentDate)
// in firestore.indexes.json. Until that index exists in Firebase the query
// fails with `failed-precondition`; we then fall back to the old
// whole-property subscription so nothing disappears from the screen.
export function subscribePaymentsSince(
  propertyId: string,
  sinceDate: string,
  cb: (payments: PaymentRecord[]) => void
): () => void {
  let fallbackUnsub: (() => void) | null = null;
  const q = query(collection(db, 'payments'), where('propertyId', '==', propertyId), where('paymentDate', '>=', sinceDate));
  const unsub = onSnapshot(
    q,
    (snap) => cb(fromDocs<PaymentRecord>(snap)),
    (err) => {
      console.warn('payments (recent) subscription failed - falling back to all payments', err);
      if (!fallbackUnsub) fallbackUnsub = subscribePayments(propertyId, cb);
    }
  );
  return () => {
    unsub();
    fallbackUnsub?.();
  };
}

// Tenant-reported payments waiting for confirmation - always live, whatever
// their date (equality-only query, no composite index needed).
export function subscribePendingPayments(propertyId: string, cb: (payments: PaymentRecord[]) => void): () => void {
  const q = query(collection(db, 'payments'), where('propertyId', '==', propertyId), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => cb(fromDocs<PaymentRecord>(snap)), (err) => console.warn('pending payments subscription failed', err));
}

// One-time read of a property's payments dated from..to (YYYY-MM-DD,
// inclusive). Falls back to reading the whole property if the index is missing.
export async function fetchPaymentsInRange(propertyId: string, from: string, to: string): Promise<PaymentRecord[]> {
  const inRange = (p: PaymentRecord) => (p.paymentDate || '') >= from && (p.paymentDate || '') <= to;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'payments'),
        where('propertyId', '==', propertyId),
        where('paymentDate', '>=', from),
        where('paymentDate', '<=', to)
      )
    );
    return fromDocs<PaymentRecord>(snap);
  } catch (err) {
    console.warn('payments range query failed - reading all payments instead', err);
    const snap = await getDocs(query(collection(db, 'payments'), where('propertyId', '==', propertyId)));
    return fromDocs<PaymentRecord>(snap).filter(inRange);
  }
}

// One-time read of one tenant's full payment history in a property (for the
// tenant statement). Equality-only query, no composite index needed.
export async function fetchTenantPayments(propertyId: string, tenantId: string): Promise<PaymentRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'payments'), where('propertyId', '==', propertyId), where('tenantId', '==', tenantId))
  );
  return fromDocs<PaymentRecord>(snap);
}

export const subscribeNotices = (propertyId: string, cb: (notices: Notice[]) => void) =>
  subscribeScoped<Notice>('notices', propertyId, cb);

export const subscribeTickets = (propertyId: string, cb: (tickets: MaintenanceTicket[]) => void) =>
  subscribeScoped<MaintenanceTicket>('tickets', propertyId, cb);

// A signed-in tenant may only read their own records (see firestore.rules),
// so their screens subscribe by tenant id instead of by property.
export function subscribeForTenant<T>(
  collectionName: 'payments' | 'tickets' | 'charges',
  tenantId: string,
  cb: (items: T[]) => void
): () => void {
  const q = query(collection(db, collectionName), where('tenantId', '==', tenantId));
  return onSnapshot(q, (snap) => cb(fromDocs<T>(snap)), (err) => console.warn(`${collectionName} subscription failed`, err));
}

export function subscribeTenantDoc(tenantId: string, cb: (tenant: Tenant | null) => void): () => void {
  return onSnapshot(
    doc(db, 'tenants', tenantId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Tenant) : null),
    (err) => console.warn('tenant subscription failed', err)
  );
}

export function subscribeRoomDoc(roomId: string, cb: (room: Room | null) => void): () => void {
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Room) : null),
    (err) => console.warn('room subscription failed', err)
  );
}

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

export async function removeTenant(tenantId: string): Promise<void> {
  await deleteDoc(doc(db, 'tenants', tenantId));
}

export async function saveTenant(tenantId: string, updates: Partial<Tenant>): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId), { ...updates, updatedAt: nowIso() } as DocumentData);
}

// ---------------------------------------------------------------------------
// Payments — receipt numbers are generated atomically per property via a
// Firestore counter document, so two concurrent payments can never collide
// (the old client-side `payments.length + 1` numbering could).
// ---------------------------------------------------------------------------

export const receiptCounterRef = (propertyId: string) => doc(db, 'properties', propertyId, 'counters', 'receipts');

// Short, fixed code for a property (first 4 characters of its id), so two
// properties never issue the same receipt number.
export const propertyReceiptCode = (propertyId: string): string =>
  (propertyId || 'XXXX').slice(0, 4).toUpperCase();

// Receipt number for counter value `seq`, dated in India time, e.g.
// PG-REC-AB12-2026-11-001. Receipts issued before this change keep their
// old PG-REC-2026-11-001 numbers.
export function formatReceiptNumber(seq: number, propertyId: string): string {
  const [year, month] = todayIST().split('-');
  return `PG-REC-${propertyReceiptCode(propertyId)}-${year}-${month}-${String(seq).padStart(3, '0')}`;
}

export async function nextReceiptNumber(propertyId: string): Promise<string> {
  const counterRef = receiptCounterRef(propertyId);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return formatReceiptNumber(seq, propertyId);
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

// ---------------------------------------------------------------------------
// Activity log - see ActivityLog in types.ts. Capped to the most recent 500
// entries per property so the owner's Activity Log tab doesn't have to page
// through an ever-growing collection; older history is still in Firestore,
// just not subscribed to live.
// ---------------------------------------------------------------------------

export const subscribeActivityLogs = (propertyId: string, cb: (logs: ActivityLog[]) => void) => {
  const q = query(
    collection(db, 'activityLogs'),
    where('propertyId', '==', propertyId),
    orderBy('createdAt', 'desc'),
    limit(500)
  );
  return onSnapshot(q, (snap) => cb(fromDocs<ActivityLog>(snap)));
};

export async function createActivityLog(entry: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'activityLogs'), { ...entry, createdAt: nowIso() });
  return ref.id;
}
