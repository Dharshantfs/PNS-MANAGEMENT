import React, { useState } from 'react';
import { QrCode, CheckCircle2, ArrowLeft, ArrowUpRight, X, ShieldCheck, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentModalProps {
  amount: number;
  tenantName: string;
  pgName: string;
  ownerUpiId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ amount, tenantName, pgName, ownerUpiId, onSuccess, onClose }) => {
  const [showUtrInput, setShowUtrInput] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [reporting, setReporting] = useState(false);

  // Dynamic UPI URL for Indian UPI Apps (GPay, PhonePe, Paytm)
  const upiString = `upi://pay?pa=${ownerUpiId}&pn=${encodeURIComponent(pgName)}&am=${amount}&cu=INR&tn=Rent_from_${encodeURIComponent(tenantName)}`;

  const handleReportPayment = () => {
    setReporting(true);
    // No payment gateway keys configured yet, so this is a self-report that
    // the owner reconciles by hand against their bank/UPI statement - see
    // PGContext.payRentAsTenant / confirmPendingPayment.
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-blue-100 text-slate-900">
        <div className="flex items-center justify-between px-6 py-4 bg-blue-700 text-white shadow-sm">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-200" />
            <h2 className="font-bold text-sm text-white">Pay via UPI</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-200 text-center space-y-1">
            <p className="text-blue-800 text-[11px] uppercase tracking-wider font-extrabold">Total Rent Due</p>
            <p className="font-black text-blue-950 text-3xl">₹{amount.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-blue-700 font-semibold flex items-center justify-center pt-1">
              <span>Pay to: {ownerUpiId}</span>
            </p>
          </div>

          <div className="text-center space-y-5 animate-in slide-in-from-right-4">
            {!showUtrInput ? (
              <>
                <div className="bg-white p-4 rounded-2xl inline-block mx-auto border-2 border-blue-200 shadow-md">
                  <QRCodeSVG value={upiString} size={190} level="H" />
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900">Scan via any UPI App or Click Below</p>
                  <p>UPI ID: <span className="text-blue-700 font-black">{ownerUpiId}</span></p>
                </div>

                <a
                  href={upiString}
                  className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-700/20"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Open in GPay / PhonePe / Paytm</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowUtrInput(true)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I have paid - Report Payment</span>
                </button>
              </>
            ) : (
              <div className="space-y-4 text-left">
                <div className="flex items-center space-x-2">
                  <button type="button" onClick={() => setShowUtrInput(false)} className="text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="font-bold text-sm text-slate-900">Report Your Payment</h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter the UTR / Reference ID from your UPI app so the owner can match it against their bank statement.
                  This won't clear your due automatically - the owner confirms it once they see it credited.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UPI Reference / UTR Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 423987110943"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleReportPayment}
                  disabled={reporting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center space-x-2"
                >
                  {reporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Report...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Report Payment - Awaiting Owner Confirmation</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
