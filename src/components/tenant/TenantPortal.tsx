import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { PaymentModal } from './PaymentModal';
import { getSharingLabel } from '../../lib/roomLabels';
import { facilityLabel } from '../../lib/facilities';
import {
  Building2,
  BedDouble,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  IndianRupee,
  Calendar,
  Users,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Printer,
  QrCode,
  Lock,
  Phone,
  AlertCircle,
  Wind,
  Bath,
  Sun,
  Wifi,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AadhaarKYCModal } from './AadhaarKYCModal';
import { ReceiptModal } from '../common/ReceiptModal';
import { PaymentRecord } from '../../types';

interface TenantPortalProps {
  onNavigateToKYC: () => void;
  onNavigateToRoommates: () => void;
  onNavigateToServices: () => void;
}

export const TenantPortal: React.FC<TenantPortalProps> = ({
  onNavigateToKYC,
  onNavigateToRoommates,
  onNavigateToServices,
}) => {
  const { activeTenant, rooms, getRoommates, settings, payRentAsTenant, payments, notices, activeProperty } = usePG();

  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  if (!activeTenant) {
    return (
      <div className="p-8 text-center bg-white border border-brand-100 rounded-3xl text-slate-900">
        <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold">No active tenant found.</p>
      </div>
    );
  }

  const currentRoom = rooms.find((r) => r.id === activeTenant.roomId);
  const roommates = getRoommates(activeTenant.id);
  const tenantPayments = payments.filter((p) => p.tenantId === activeTenant.id);

  const handlePaymentSuccess = async () => {
    const txnId = `UPI-${Date.now().toString().slice(-8)}`;
    const newRec = await payRentAsTenant(activeTenant.id, activeTenant.dueAmount || activeTenant.monthlyRent, 'UPI', txnId);
    setIsPayModalOpen(false);
    confetti({ particleCount: 50, spread: 80, origin: { y: 0.6 } });
    if (newRec) setSelectedReceipt(newRec);
  };

  return (
    <div id="tenant-portal-view" className="space-y-6 animate-in fade-in">
      
      {/* Top Welcome & KYC Status Banner - Royal Blue Gradient */}
      <div className="bg-gradient-to-r from-brand-700 via-brand-800 to-indigo-900 p-6 sm:p-8 rounded-3xl text-white shadow-lg border border-brand-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <img
            src={activeTenant.photoUrl}
            alt={activeTenant.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-white/60 shadow-md shrink-0"
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 font-bold text-brand-100">
                Resident Portal
              </span>
              <span className="text-xs text-brand-200">
                Floor {activeTenant.floor} • Room {activeTenant.roomNumber || 'Unassigned'} ({activeTenant.bedLabel || 'Bed'})
              </span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">
              Welcome back, {activeTenant.name}
            </h1>
            <p className="text-xs text-brand-100 mt-0.5">
              {settings.pgName} • {activeTenant.kyc?.companyOrCollege || activeTenant.kyc?.occupation || 'Resident'}
            </p>
          </div>
        </div>

        {/* KYC Verification Badge / Trigger */}
        <div className="flex items-center space-x-2">
          {activeTenant.kyc?.status === 'verified' ? (
            <div className="bg-emerald-600/90 border border-emerald-400/60 px-4 py-2.5 rounded-2xl flex items-center space-x-2 text-white text-xs font-bold shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-200" />
              <span>Aadhaar KYC Verified</span>
            </div>
          ) : activeTenant.kyc?.status === 'pending' ? (
            <div className="bg-amber-600/90 border border-amber-400/60 px-4 py-2.5 rounded-2xl flex items-center space-x-2 text-white text-xs font-bold shadow-sm animate-pulse">
              <ShieldAlert className="w-4 h-4 text-amber-200" />
              <span>Aadhaar Under Review</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsKYCModalOpen(true)}
              className="bg-white hover:bg-brand-50 text-brand-700 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center space-x-2 shadow-md transition"
            >
              <CreditCard className="w-4 h-4 text-brand-700" />
              <span>Complete Aadhaar KYC</span>
            </button>
          )}
        </div>
      </div>

      {/* KYC Alert if not verified */}
      {activeTenant.kyc?.status !== 'verified' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-900">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-900">
                Aadhaar Verification Pending
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Submit your 12-digit Aadhaar Card number and emergency contact details to complete police verification compliance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsKYCModalOpen(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition shrink-0 shadow-sm"
          >
            Submit KYC Form
          </button>
        </div>
      )}

      {/* 2-Column Main Section: My Stay Details & Rent Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CARD 1: MY ROOM & STAY DETAILS */}
        <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4 text-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BedDouble className="w-5 h-5 text-brand-700" />
              <span>My Room & Bed Details</span>
            </h2>
            <span className="text-xs px-3 py-1 rounded-full bg-brand-50 text-brand-800 font-bold border border-brand-200">
              Floor {activeTenant.floor}
            </span>
          </div>

          <div className="bg-brand-50/60 p-5 rounded-2xl border border-brand-200 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Room Allocation</span>
                <p className="text-2xl font-black text-slate-900">Room {activeTenant.roomNumber || 'N/A'}</p>
                <p className="text-xs text-brand-700 font-bold mt-0.5">
                  {activeTenant.bedLabel || 'Bed Assigned'} • {getSharingLabel(activeProperty, currentRoom?.sharingId)}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Rent</span>
                <p className="text-2xl font-black text-brand-700">₹{activeTenant.monthlyRent.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-slate-500 font-medium">Due on 5th of each month</p>
              </div>
            </div>

            {/* Room Features */}
            {currentRoom && currentRoom.facilities.length > 0 && (
              <div className="pt-3 border-t border-brand-200 flex flex-wrap gap-2 text-xs">
                {currentRoom.facilities.map((key) => (
                  <span key={key} className="px-2.5 py-1 rounded-lg bg-white border border-brand-200 text-brand-900 font-medium">
                    {facilityLabel(key)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Roommates Widget (Same room only for privacy) */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Roommates in Room {activeTenant.roomNumber}:</span>
              <button
                type="button"
                onClick={onNavigateToRoommates}
                className="text-brand-700 hover:text-brand-900 font-bold flex items-center space-x-1"
              >
                <span>View Full Contacts</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {roommates.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                No other roommates currently assigned to this room.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roommates.map((rm) => (
                  <div
                    key={rm.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2.5 text-xs text-slate-900"
                  >
                    <img
                      src={rm.photoUrl}
                      alt={rm.name}
                      className="w-8 h-8 rounded-lg object-cover border border-brand-400"
                    />
                    <div className="truncate">
                      <p className="font-bold truncate">{rm.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">+91 {rm.phone.replace(/\D/g, '')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: RENT PAYMENT & UPI DIRECT APP CHECKOUT */}
        <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4 text-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <IndianRupee className="w-5 h-5 text-emerald-600" />
              <span>Rent Payment & UPI Transfer</span>
            </h2>
            <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
              activeTenant.dueAmount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {activeTenant.dueAmount > 0 ? 'Rent Payment Pending' : 'Paid in Full'}
            </span>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Balance Due</span>
                <p className={`text-3xl font-black ${activeTenant.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ₹{activeTenant.dueAmount.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Includes monthly rent, Wi-Fi, and utilities</p>
              </div>

              {activeTenant.dueAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(true)}
                  className="px-5 py-3 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-2xl text-xs transition shadow-lg shadow-brand-700/20 flex items-center space-x-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Pay Now via UPI</span>
                </button>
              )}
            </div>

            {/* UPI Deep Link direct hint */}
            <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-xl text-xs text-brand-950 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-brand-700 shrink-0" />
                <span>Verified Owner UPI: <b>{settings.ownerUpiId}</b></span>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(true)}
                className="text-brand-700 font-bold hover:underline shrink-0 text-xs"
              >
                Open UPI App →
              </button>
            </div>
          </div>

          {/* Payment History & Invoices */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-bold text-slate-700 block">Recent Payment Receipts:</span>
            
            {tenantPayments.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                No payment receipts on record yet.
              </p>
            ) : (
              <div className="space-y-2">
                {tenantPayments.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-900"
                  >
                    <div>
                      <p className="font-bold">{p.month} Rent</p>
                      <p className="text-[10px] text-slate-500 font-mono">{p.receiptNumber} • {p.paymentDate}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-emerald-600">₹{p.amount.toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(p)}
                        className="px-2.5 py-1 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Aadhaar KYC Modal */}
      <AadhaarKYCModal
        tenant={activeTenant}
        isOpen={isKYCModalOpen}
        onClose={() => setIsKYCModalOpen(false)}
      />

      {/* Instant Checkout / UPI Modal */}
      {isPayModalOpen && (
        <PaymentModal
          amount={activeTenant.dueAmount || activeTenant.monthlyRent}
          tenantName={activeTenant.name}
          pgName={settings.pgName}
          ownerUpiId={settings.ownerUpiId}
          onSuccess={handlePaymentSuccess}
          onClose={() => setIsPayModalOpen(false)}
        />
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          payment={selectedReceipt}
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

    </div>
  );
};
