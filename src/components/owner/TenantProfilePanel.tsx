import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Tenant } from '../../types';
import { getSharingLabel } from '../../lib/roomLabels';
import { AgreementModal } from './AgreementModal';
import {
  X,
  Phone,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  FileCheck2,
  CheckCircle,
  XCircle,
  IndianRupee,
  Calendar,
  Clock,
  BedDouble,
  AlertCircle,
  FileText,
  CheckCircle2,
} from 'lucide-react';

interface TenantProfilePanelProps {
  tenant: Tenant;
  onClose: () => void;
  onViewDossier: () => void;
}

const stayingSince = (checkInDate: string): string => {
  const start = new Date(checkInDate).getTime();
  if (Number.isNaN(start)) return '-';
  const days = Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remDays = days - years * 365 - months * 30;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (years === 0 && (remDays > 0 || parts.length === 0)) parts.push(`${remDays} day${remDays !== 1 ? 's' : ''}`);
  return parts.join(' ');
};

export const TenantProfilePanel: React.FC<TenantProfilePanelProps> = ({ tenant, onClose, onViewDossier }) => {
  const { rooms, tickets, activeProperty, approveKYC, rejectKYC, transferBed, recordPayment } = usePG();
  const [changingRoom, setChangingRoom] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState(tenant.dueAmount || tenant.monthlyRent);
  const [payMode, setPayMode] = useState<'UPI' | 'Cash' | 'Bank Transfer' | 'Card'>('Cash');
  const [payBusy, setPayBusy] = useState(false);

  const room = rooms.find((r) => r.id === tenant.roomId);
  const kycStatus = tenant.kyc?.status || 'unsubmitted';
  const openTickets = tickets.filter((t) => t.tenantId === tenant.id && t.status !== 'Resolved');
  const cleanPhone = tenant.phone.replace(/\D/g, '');
  const isActive = !tenant.checkOutDate;

  const vacantBeds = rooms.flatMap((r) =>
    r.beds.filter((b) => b.status === 'vacant').map((b) => ({ room: r, bed: b }))
  );

  const handleTransfer = (roomId: string, bedId: string) => {
    if (!roomId || !bedId) return;
    transferBed(tenant.id, roomId, bedId);
    setChangingRoom(false);
  };

  const handleRecordPayment = async () => {
    if (payAmount <= 0) return;
    setPayBusy(true);
    try {
      const month = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
      await recordPayment({ tenantId: tenant.id, amount: payAmount, month, paymentMode: payMode });
      setShowPayForm(false);
    } finally {
      setPayBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-brand-700 text-white px-5 py-4 flex items-center justify-between shadow-sm z-10">
          <h2 className="font-bold text-sm">{tenant.name}'s Profile</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-slate-900">
          {/* Identity block */}
          <div className="flex items-center space-x-3.5">
            <img src={tenant.photoUrl} alt={tenant.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-600 shadow-sm shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 truncate">{tenant.name}</h3>
              <p className="text-xs text-slate-500 font-mono">+91 {cleanPhone}</p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isActive ? 'Active' : 'Moved Out'}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${cleanPhone}`} className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border border-slate-300">
              <Phone className="w-3.5 h-3.5 text-brand-700" />
              <span>Call</span>
            </a>
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* KYC status + quick approve/reject */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                {kycStatus === 'verified' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : kycStatus === 'pending' ? (
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                ) : (
                  <ShieldQuestion className="w-4 h-4 text-rose-500" />
                )}
                <span>KYC: {kycStatus}</span>
              </span>
              <button type="button" onClick={onViewDossier} className="text-[11px] text-brand-700 hover:text-brand-900 font-bold flex items-center space-x-1">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Full Dossier</span>
              </button>
            </div>
            {kycStatus !== 'verified' && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => approveKYC(tenant.id)}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReject((v) => !v)}
                  className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            )}
            {showReject && (
              <div className="flex items-center space-x-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection"
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-rose-300 focus:outline-none focus:border-rose-600"
                />
                <button
                  type="button"
                  onClick={() => { if (rejectReason.trim()) { rejectKYC(tenant.id, rejectReason.trim()); setShowReject(false); setRejectReason(''); } }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>

          {/* Record a payment (front-desk/staff-friendly - doesn't need the full Finance tab) */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                <IndianRupee className="w-4 h-4" />
                <span>Record Payment</span>
              </span>
              <button type="button" onClick={() => setShowPayForm((v) => !v)} className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold">
                {showPayForm ? 'Cancel' : 'Add'}
              </button>
            </div>
            {showPayForm && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-emerald-300 focus:outline-none focus:border-emerald-600"
                  />
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-emerald-300 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={payBusy}
                  onClick={handleRecordPayment}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{payBusy ? 'Saving...' : 'Save & Issue Receipt'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Generate rental agreement */}
          <button
            type="button"
            onClick={() => setShowAgreement(true)}
            className="w-full py-2.5 bg-white hover:bg-slate-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate Rental Agreement</span>
          </button>

          {/* Room info */}
          <div className="bg-brand-50/60 border border-brand-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                <BedDouble className="w-4 h-4 text-brand-700" />
                <span>Room: {tenant.roomNumber ? `${tenant.roomNumber} - ${tenant.bedLabel}` : 'Unassigned'}</span>
              </span>
              <button type="button" onClick={() => setChangingRoom((v) => !v)} className="text-[11px] text-brand-700 hover:text-brand-900 font-bold">
                Change
              </button>
            </div>
            {room && (
              <p className="text-[11px] text-slate-500">{getSharingLabel(activeProperty, room.sharingId)} • Floor {room.floor}</p>
            )}
            {changingRoom && (
              <select
                defaultValue=""
                onChange={(e) => {
                  const [roomId, bedId] = e.target.value.split('::');
                  if (roomId && bedId) handleTransfer(roomId, bedId);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-brand-300 focus:outline-none focus:border-brand-600"
              >
                <option value="">-- Choose a vacant bed --</option>
                {vacantBeds.map(({ room: r, bed: b }) => (
                  <option key={b.id} value={`${r.id}::${b.id}`}>
                    Room {r.roomNumber} ({b.bedLabel}) - ₹{b.pricePerMonth || r.pricePerBed}/mo
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Pending tasks */}
          {openTickets.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-900 flex items-center space-x-1.5 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span>{openTickets.length} Pending Task{openTickets.length > 1 ? 's' : ''}</span>
              </p>
              <ul className="space-y-1">
                {openTickets.map((t) => (
                  <li key={t.id} className="text-[11px] text-amber-800">
                    {t.category}: {t.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Renting Summary */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Renting Summary</h4>
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500 flex items-center space-x-1.5"><Calendar className="w-3.5 h-3.5" /><span>Date of Joining</span></span>
                <span className="font-bold text-slate-900">{tenant.checkInDate}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500 flex items-center space-x-1.5"><Calendar className="w-3.5 h-3.5" /><span>Move Out Date</span></span>
                <span className="font-bold text-slate-900">{tenant.checkOutDate || '-'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500 flex items-center space-x-1.5"><Clock className="w-3.5 h-3.5" /><span>Staying Since</span></span>
                <span className="font-bold text-slate-900">{stayingSince(tenant.checkInDate)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500 flex items-center space-x-1.5"><IndianRupee className="w-3.5 h-3.5" /><span>Rent Amount</span></span>
                <span className="font-bold text-emerald-700">₹{tenant.monthlyRent.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500">Rent Due On</span>
                <span className="font-bold text-slate-900">{activeProperty?.rentDueDay || 5}{['th','st','nd','rd'][((activeProperty?.rentDueDay || 5) % 10 === 1 && activeProperty?.rentDueDay !== 11) ? 1 : ((activeProperty?.rentDueDay || 5) % 10 === 2 && activeProperty?.rentDueDay !== 12) ? 2 : ((activeProperty?.rentDueDay || 5) % 10 === 3 && activeProperty?.rentDueDay !== 13) ? 3 : 0]} of every month</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500">Current Due</span>
                <span className={`font-bold ${tenant.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {tenant.dueAmount > 0 ? `₹${tenant.dueAmount.toLocaleString('en-IN')}` : 'Paid in Full'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAgreement && <AgreementModal tenant={tenant} onClose={() => setShowAgreement(false)} />}
    </div>
  );
};
