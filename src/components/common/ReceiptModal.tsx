import React from 'react';
import { PaymentRecord, PGSettings } from '../../types';
import {
  Building2,
  CheckCircle,
  Printer,
  X,
  QrCode,
  Download,
  Share2,
  ShieldCheck,
} from 'lucide-react';

interface ReceiptModalProps {
  payment: PaymentRecord | null;
  settings?: PGSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  settings = {
    pgName: 'PNS Luxury PG',
    ownerName: 'Admin / Property Warden',
    ownerPhone: '+91 98450 12345',
    ownerUpiId: 'pnspg@okaxis',
    address: '14th Cross, Near Metro Station, Indiranagar, Bengaluru - 560038',
  } as any,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-blue-100">
        
        {/* Actions bar at top - Royal Blue */}
        <div className="bg-blue-700 px-6 py-3.5 flex items-center justify-between text-white shadow-sm print:hidden">
          <span className="text-xs font-bold text-white flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-200" />
            <span>Official Rent Payment Receipt</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl transition flex items-center space-x-1 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div className="p-8 space-y-6">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center text-white font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <h1 className="text-lg font-black tracking-tight text-slate-900">{settings.pgName}</h1>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">{settings.address}</p>
              <p className="text-xs text-slate-500">Phone: {settings.ownerPhone} • UPI: {settings.ownerUpiId || settings.upiId}</p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                E-Receipt
              </span>
              <p className="text-xs font-mono font-bold text-blue-900 mt-1.5">{payment.receiptNumber}</p>
              <p className="text-xs text-slate-500">Date: {payment.paymentDate}</p>
            </div>
          </div>

          {/* Paid by Tenant details */}
          <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-2xl text-xs border border-blue-200">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold">Received From</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{payment.tenantName}</p>
              <p className="text-slate-700">Room {payment.roomNumber} ({payment.bedLabel})</p>
              <p className="text-slate-700">Floor {payment.floor}</p>
            </div>

            <div className="text-right">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Payment Details</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{payment.month}</p>
              <p className="text-blue-800 font-bold">Mode: {payment.paymentMode}</p>
              {payment.transactionId && (
                <p className="text-slate-500 font-mono text-[10px]">Ref: {payment.transactionId}</p>
              )}
            </div>
          </div>

          {/* Line Item Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 flex justify-between">
              <span>Description</span>
              <span>Amount (INR)</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-slate-800">
                <div>
                  <p className="font-bold">Monthly Accommodation & PG Rent</p>
                  <p className="text-[11px] text-slate-500">Includes Room Rent, Wi-Fi, Food & Electricity</p>
                </div>
                <span className="font-black text-sm text-slate-900">₹{payment.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="bg-blue-50 px-4 py-3 border-t border-blue-200 flex justify-between items-center">
              <span className="font-extrabold text-blue-950">Total Amount Paid</span>
              <span className="text-lg font-black text-emerald-600">
                ₹{payment.amount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Verification QR / Status & Stamp */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-blue-900" />
              </div>
              <div>
                <span className="inline-flex items-center text-emerald-600 font-bold text-xs space-x-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>PAYMENT RECONCILED</span>
                </span>
                <p className="text-[10px] text-slate-500">Instant digital verified receipt</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-slate-400 text-[10px]">Authorized Signature</p>
              <p className="font-bold text-slate-800 text-xs mt-3 border-t border-slate-400 pt-0.5">
                {settings.ownerName}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
