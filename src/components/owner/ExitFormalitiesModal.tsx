import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, IndianRupee, LogOut } from 'lucide-react';
import { usePG } from '../../context/PGContext';
import { NumberField } from '../common/NumberField';
import { ExitSettlement } from '../../types';

interface ExitFormalitiesModalProps {
  tenantId: string;
  onClose: () => void;
}

type PayMode = 'UPI' | 'Cash' | 'Bank Transfer' | 'Card';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const Check: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
    <span>{label}</span>
  </label>
);

// Move-out checklist: the resident cannot be checked out while any rent/charges
// are still due - the owner records the final payment here first, then settles
// the security deposit and completes the exit (which frees the bed).
export const ExitFormalitiesModal: React.FC<ExitFormalitiesModalProps> = ({ tenantId, onClose }) => {
  const { tenants, recordPayment, vacateBed, updateTenant, ownerProfile } = usePG();
  // Only an admin (owner) may let a resident leave with dues pending; staff cannot.
  const isAdmin = ownerProfile?.role === 'owner';
  // Read the live tenant so the due amount refreshes right after a payment.
  const tenant = tenants.find((t) => t.id === tenantId);

  const today = new Date().toISOString().split('T')[0];
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [payMode, setPayMode] = useState<PayMode>('Cash');
  const [payBusy, setPayBusy] = useState(false);
  const [exitDate, setExitDate] = useState(today);
  const [keyReturned, setKeyReturned] = useState(false);
  const [roomInspected, setRoomInspected] = useState(false);
  const [noticeGiven, setNoticeGiven] = useState(false);
  const [deductions, setDeductions] = useState(0);
  const [deductionNotes, setDeductionNotes] = useState('');
  const [refundMode, setRefundMode] = useState<'UPI' | 'Cash' | 'Bank Transfer'>('Cash');
  const [error, setError] = useState('');
  const [overrideDues, setOverrideDues] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [done, setDone] = useState(false);
  // Frozen at completion: after vacating, the live tenant's data changes.
  const [doneRefund, setDoneRefund] = useState(0);

  if (!tenant) return null;

  const due = tenant.dueAmount || 0;
  const duesCleared = due <= 0;
  const depositHeld = tenant.depositPaid ? tenant.securityDeposit || 0 : 0;
  const safeDeductions = Math.min(Math.max(0, deductions), depositHeld);
  const refund = depositHeld - safeDeductions;
  const checklistDone = keyReturned && roomInspected && noticeGiven;
  const duesOverridden = !duesCleared && isAdmin && overrideDues && !!overrideReason.trim();
  const canComplete = (duesCleared || duesOverridden) && checklistDone && !!exitDate;

  const handlePay = async () => {
    const amount = payAmount ?? due;
    if (amount <= 0) return;
    setPayBusy(true);
    setError('');
    try {
      const month = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
      await recordPayment({ tenantId: tenant.id, amount, month, paymentMode: payMode, notes: 'Final dues - exit formalities' });
      setPayAmount(null);
    } catch (e: any) {
      setError(e?.message || 'Could not record the payment.');
    } finally {
      setPayBusy(false);
    }
  };

  const handleComplete = () => {
    if (!canComplete) return;
    const settlement: ExitSettlement = {
      completedAt: new Date().toISOString(),
      depositHeld,
      deductions: safeDeductions,
      refundAmount: refund,
      ...(duesOverridden ? { duesOutstanding: due, duesOverrideReason: overrideReason.trim() } : {}),
      checklist: { keyReturned, roomInspected, noticeGiven },
      ...(safeDeductions > 0 && deductionNotes.trim() ? { deductionNotes: deductionNotes.trim() } : {}),
      ...(refund > 0 ? { refundMode } : {}),
    };
    // vacateBed frees the bed and stamps today's date; the exit date and
    // settlement are written right after so a back-dated exit date wins.
    if (tenant.roomId && tenant.bedId) vacateBed(tenant.roomId, tenant.bedId);
    updateTenant(tenant.id, { checkOutDate: exitDate, exitSettlement: settlement });
    setDoneRefund(refund);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl text-slate-900">
        <div className="sticky top-0 bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-sm flex items-center space-x-2">
            <LogOut className="w-4 h-4" />
            <span>Exit Formalities - {tenant.name}</span>
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="text-sm font-bold">{tenant.name} has moved out.</p>
            <p className="text-xs text-slate-600">
              {doneRefund > 0 ? `Hand back the deposit refund of ${inr(doneRefund)} (${refundMode}). ` : 'No deposit refund is due. '}
              The bed is now vacant.
            </p>
            <button type="button" onClick={onClose} className="px-5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold">
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Step 1: dues */}
            <div className={`rounded-2xl border p-4 space-y-2 ${duesCleared ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center space-x-1.5">
                  {duesCleared ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                  <span>1. Clear remaining dues</span>
                </span>
                <span className={`text-xs font-black ${duesCleared ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {duesCleared ? 'Paid in full' : `${inr(due)} pending`}
                </span>
              </div>
              {!duesCleared && (
                <>
                  <p className="text-[11px] text-rose-800">The resident must pay this before moving out. Record the payment received:</p>
                  <div className="flex items-center gap-2">
                    <NumberField
                      value={payAmount ?? due}
                      onChange={setPayAmount}
                      className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-rose-300 focus:outline-none focus:border-rose-600"
                    />
                    <select
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value as PayMode)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-rose-300 focus:outline-none"
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
                    onClick={handlePay}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1"
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>{payBusy ? 'Saving...' : 'Save & Issue Receipt'}</span>
                  </button>
                </>
              )}
              {!duesCleared && isAdmin && (
                <div className="border-t border-rose-200 pt-2 space-y-1.5">
                  <Check checked={overrideDues} onChange={setOverrideDues} label="Admin override: allow exit with dues pending" />
                  {overrideDues && (
                    <input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Reason (required) - e.g. waived, to be collected later"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-rose-300 focus:outline-none focus:border-rose-600"
                    />
                  )}
                  {overrideDues && <p className="text-[11px] text-rose-800">The {inr(due)} stays on the resident's record as unpaid.</p>}
                </div>
              )}
              {!duesCleared && !isAdmin && <p className="text-[11px] text-rose-800">Only an admin can approve an exit with dues pending.</p>}
              {error && <p className="text-[11px] text-rose-700">{error}</p>}
            </div>

            {/* Step 2: checklist */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <p className="text-xs font-bold">2. Move-out checklist</p>
              <Check checked={noticeGiven} onChange={setNoticeGiven} label="Vacating notice received / period served" />
              <Check checked={roomInspected} onChange={setRoomInspected} label="Room inspected - no damage, belongings removed" />
              <Check checked={keyReturned} onChange={setKeyReturned} label="Room key / access card returned" />
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Move-out date</label>
                <input
                  type="date"
                  value={exitDate}
                  onChange={(e) => setExitDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-brand-600"
                />
              </div>
            </div>

            {/* Step 3: deposit */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <p className="text-xs font-bold">3. Security deposit</p>
              {depositHeld > 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Deposit held</span>
                    <span className="font-bold">{inr(depositHeld)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 shrink-0">Deduct (damages etc.)</span>
                    <NumberField
                      value={deductions}
                      onChange={setDeductions}
                      className="w-28 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                  {safeDeductions > 0 && (
                    <input
                      value={deductionNotes}
                      onChange={(e) => setDeductionNotes(e.target.value)}
                      placeholder="Reason for deduction"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-brand-600"
                    />
                  )}
                  <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                    <span className="font-bold">Refund to resident</span>
                    <span className="font-black text-emerald-700">{inr(refund)}</span>
                  </div>
                  {refund > 0 && (
                    <select
                      value={refundMode}
                      onChange={(e) => setRefundMode(e.target.value as 'UPI' | 'Cash' | 'Bank Transfer')}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none"
                    >
                      <option value="Cash">Refund by Cash</option>
                      <option value="UPI">Refund by UPI</option>
                      <option value="Bank Transfer">Refund by Bank Transfer</option>
                    </select>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-slate-500">No security deposit was collected from this resident, so there is nothing to refund.</p>
              )}
            </div>

            <button
              type="button"
              disabled={!canComplete}
              onClick={handleComplete}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Complete Exit &amp; Vacate Bed</span>
            </button>
            {!canComplete && (
              <p className="text-[11px] text-slate-500 text-center">
                {!duesCleared && !duesOverridden ? (isAdmin ? 'Clear the pending dues, or use the admin override with a reason.' : 'Clear the pending dues to continue.') : 'Tick every item in the checklist to continue.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
