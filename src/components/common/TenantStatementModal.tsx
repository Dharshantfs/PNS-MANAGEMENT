import React, { useMemo } from 'react';
import { DueCharge, PaymentRecord, PGSettings, Tenant } from '../../types';
import { Building2, Printer, X, ShieldCheck } from 'lucide-react';

interface TenantStatementModalProps {
  tenant: Tenant | null;
  payments: PaymentRecord[];
  charges: DueCharge[];
  settings: PGSettings;
  isOpen: boolean;
  onClose: () => void;
}

type StatementRow = {
  date: string;
  description: string;
  debit: number; // charge added to what the tenant owes
  credit: number; // payment received from the tenant
};

export const TenantStatementModal: React.FC<TenantStatementModalProps> = ({
  tenant,
  payments,
  charges,
  settings,
  isOpen,
  onClose,
}) => {
  const rows = useMemo<StatementRow[]>(() => {
    if (!tenant) return [];
    const paymentRows: StatementRow[] = payments
      .filter((p) => p.tenantId === tenant.id)
      .map((p) => ({
        date: p.paymentDate,
        description: `Rent payment - ${p.month} (${p.paymentMode}${p.status === 'pending' ? ', awaiting confirmation' : ''})`,
        debit: 0,
        credit: p.amount,
      }));
    const chargeRows: StatementRow[] = charges
      .filter((c) => c.tenantId === tenant.id)
      .map((c) => ({
        date: c.date,
        description: `${c.categoryName}${c.notes ? ` - ${c.notes}` : ''}`,
        debit: c.amount,
        credit: 0,
      }));
    return [...paymentRows, ...chargeRows].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [tenant, payments, charges]);

  if (!isOpen || !tenant) return null;

  const totalCharged = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.credit, 0);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in print-area">
      <div className="bg-white text-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-brand-100 max-h-[90vh] flex flex-col">
        <div className="bg-brand-700 px-6 py-3.5 flex items-center justify-between text-white shadow-sm print:hidden shrink-0">
          <span className="text-xs font-bold text-white flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-200" />
            <span>Tenant Ledger Statement</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-brand-700 hover:bg-brand-50 text-xs font-bold rounded-xl transition flex items-center space-x-1 shadow-sm"
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

        <div className="p-8 space-y-6 overflow-y-auto">
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-brand-700 flex items-center justify-center text-white font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <h1 className="text-lg font-black tracking-tight text-slate-900">{settings.pgName}</h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">{settings.address}</p>
            </div>
            <div className="text-right text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-800 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                Statement
              </span>
              <p className="text-slate-500 mt-1.5">Generated: {new Date().toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-brand-50/50 p-4 rounded-2xl text-xs border border-brand-200">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold">Tenant</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{tenant.name}</p>
              <p className="text-slate-700">{tenant.phone}</p>
              <p className="text-slate-700">Room {tenant.roomNumber || 'Unassigned'} ({tenant.bedLabel || '-'})</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Account Status</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">Monthly Rent: ₹{tenant.monthlyRent.toLocaleString('en-IN')}</p>
              <p className={`font-bold ${tenant.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                Current Due: ₹{tenant.dueAmount.toLocaleString('en-IN')}
              </p>
              <p className="text-slate-500">Since: {tenant.checkInDate}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Charged (₹)</th>
                  <th className="px-4 py-2 text-right">Paid (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No payments or dues recorded yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-500">{r.date}</td>
                      <td className="px-4 py-2 text-slate-800">{r.description}</td>
                      <td className="px-4 py-2 text-right font-bold text-rose-600">{r.debit ? r.debit.toLocaleString('en-IN') : ''}</td>
                      <td className="px-4 py-2 text-right font-bold text-emerald-600">{r.credit ? r.credit.toLocaleString('en-IN') : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-brand-50 border-t border-brand-200 font-extrabold text-brand-950">
                  <td className="px-4 py-3" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right text-rose-700">₹{totalCharged.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">₹{totalPaid.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
