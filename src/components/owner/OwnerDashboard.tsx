import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import {
  Building2,
  Users,
  IndianRupee,
  ShieldAlert,
  ShieldCheck,
  BedDouble,
  ArrowUpRight,
  TrendingUp,
  Layers,
  AlertCircle,
  FileCheck2,
  Phone,
  CheckCircle,
  Sparkles,
  MessageSquare,
  Clock,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface OwnerDashboardProps {
  onNavigateToMatrix: () => void;
  onNavigateToKYC: () => void;
  onNavigateToReports: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  onNavigateToMatrix,
  onNavigateToKYC,
  onNavigateToReports,
}) => {
  const { getStats, tenants, rooms, payments, approveKYC } = usePG();
  const stats = getStats();

  const pendingKYCTenants = tenants.filter((t) => t.kyc?.status === 'pending');
  const duePaymentTenants = tenants.filter((t) => t.dueAmount > 0);

  const [sendingWa, setSendingWa] = useState<string | null>(null);
  const [waToast, setWaToast] = useState<{ id: string; msg: string } | null>(null);

  const handleSendWhatsApp = async (tenantId: string, phone: string, name: string, dueAmount: number) => {
    setSendingWa(tenantId);
    try {
      const response = await fetch('/api/send-whatsapp-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          tenantName: name,
          amountDue: dueAmount,
          dueDate: '5th of the month',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setWaToast({ id: tenantId, msg: `WhatsApp rent reminder sent to ${name}!` });
        confetti({ particleCount: 25, spread: 50, origin: { y: 0.7 } });
        setTimeout(() => setWaToast(null), 3500);
      } else {
        setWaToast({ id: tenantId, msg: `Failed: ${data.error}` });
      }
    } catch {
      setWaToast({ id: tenantId, msg: 'Network error sending WhatsApp reminder.' });
    }
    setSendingWa(null);
  };

  const handleApproveKYC = (tenantId: string) => {
    approveKYC(tenantId);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
  };

  return (
    <div id="owner-dashboard-view" className="space-y-6 animate-in fade-in">
      
      {/* Top Welcome Banner - Royal Blue Gradient */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 sm:p-8 rounded-3xl text-white shadow-lg border border-blue-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-blue-100 text-xs font-bold">
              Owner Management Portal
            </span>
            <span className="text-xs text-blue-200">4-Floor Luxury Property Overview</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-2 tracking-tight">
            PNS Luxury PG Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl leading-relaxed">
            Real-time occupancy status, 4-floor bed matrix, Aadhaar KYC compliance records, and instant WhatsApp invitations.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToMatrix}
            className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs flex items-center space-x-2 shadow-md transition"
          >
            <Layers className="w-4 h-4 text-blue-700" />
            <span>Manage 4 Floors ({stats.vacantBeds} Vacant)</span>
          </button>
          
          <button
            type="button"
            onClick={onNavigateToReports}
            className="px-4 py-2.5 bg-blue-900/80 hover:bg-blue-900 text-white border border-blue-400/40 rounded-xl text-xs font-bold flex items-center space-x-2 transition"
          >
            <IndianRupee className="w-4 h-4 text-amber-300" />
            <span>Rent Reports</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid in Royal Blue & Crisp White Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Occupancy Card */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Occupancy</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <BedDouble className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-slate-900">{stats.occupancyRate}%</span>
              <span className="text-xs font-bold text-blue-700">
                ({stats.occupiedBeds}/{stats.totalBeds} Beds)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-bold">{stats.vacantBeds} Vacant Beds</span> across 4 floors
            </p>
          </div>
        </div>

        {/* Expected Monthly Revenue */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Rent</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-black text-slate-900">
                ₹{stats.totalExpectedRevenue.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Total revenue from occupied beds</p>
          </div>
        </div>

        {/* Rent Collected */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rent Collected</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-black text-blue-700">
                ₹{stats.totalReceivedRevenue.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-rose-600 font-semibold mt-1">
              ₹{stats.totalDueRevenue.toLocaleString('en-IN')} outstanding balance
            </p>
          </div>
        </div>

        {/* KYC Compliance Status */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aadhaar KYC</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-slate-900">{stats.verifiedKYCCount}</span>
              <span className="text-xs text-emerald-600 font-bold">Verified</span>
            </div>
            <p className="text-xs text-amber-600 font-semibold mt-1">
              {stats.pendingKYCCount} pending review • {stats.unsubmittedKYCCount} unsubmitted
            </p>
          </div>
        </div>

      </div>

      {/* 2-Column Section: Pending KYC Submissions & Rent Dues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pending Aadhaar KYC Reviews */}
        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Aadhaar KYC Verification Queue</h3>
                <p className="text-xs text-slate-500">Tenants waiting for owner verification</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToKYC}
              className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {pendingKYCTenants.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <span>All submitted KYC records are up to date!</span>
              </div>
            ) : (
              pendingKYCTenants.map((t) => (
                <div
                  key={t.id}
                  className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-slate-900"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={t.photoUrl}
                      alt={t.name}
                      className="w-10 h-10 rounded-xl object-cover border border-blue-600 shrink-0"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{t.name}</h4>
                      <p className="text-[11px] text-blue-800 font-semibold">
                        Aadhaar: {t.kyc?.aadhaar?.aadhaarNumber || 'Attached'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Room {t.roomNumber} ({t.bedLabel}) • +91 {t.phone.replace(/\D/g, '')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveKYC(t.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rent Dues & Automated WhatsApp Reminders */}
        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Outstanding Rent & WhatsApp Alerts</h3>
                <p className="text-xs text-slate-500">Dispatch instant payment reminders</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateToReports}
              className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1"
            >
              <span>Finance Reports</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {duePaymentTenants.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <span>Zero pending rent balances. All residents paid!</span>
              </div>
            ) : (
              duePaymentTenants.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-slate-900"
                >
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{t.name}</h4>
                    <p className="text-[11px] font-bold text-rose-600">
                      ₹{t.dueAmount.toLocaleString('en-IN')} Due
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Room {t.roomNumber} ({t.bedLabel}) • +91 {t.phone.replace(/\D/g, '')}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      disabled={sendingWa === t.id}
                      onClick={() => handleSendWhatsApp(t.id, t.phone, t.name, t.dueAmount)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1 disabled:opacity-50"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{sendingWa === t.id ? 'Sending...' : 'WhatsApp'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {waToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium animate-in fade-in flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{waToast.msg}</span>
            </div>
          )}
        </div>

      </div>

      {/* 4 Floors Summary Strip */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">4-Floor Capacity & Occupancy Matrix</h3>
              <p className="text-xs text-slate-500">Floor-by-floor breakdown of rooms and beds</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToMatrix}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
          >
            <span>Open Interactive Matrix</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.floorSummaries.map((f) => (
            <div
              key={f.floor}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-slate-900 hover:border-blue-300 transition"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-blue-900">Floor {f.floor}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {f.occupancyRate}% Occupied
                </span>
              </div>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Total Beds:</span>
                  <span className="font-bold text-slate-900">{f.totalBeds}</span>
                </div>
                <div className="flex justify-between">
                  <span>Occupied:</span>
                  <span className="font-bold text-blue-700">{f.occupiedBeds}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vacant:</span>
                  <span className="font-bold text-emerald-600">{f.vacantBeds}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span>Floor Rent:</span>
                  <span className="font-bold text-slate-900">₹{f.totalRent.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
