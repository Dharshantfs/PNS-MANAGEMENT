import React, { useMemo, useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Tenant } from '../../types';
import { downloadCsv } from '../../lib/exportCsv';
import { TenantStatementModal } from '../common/TenantStatementModal';
import {
  IndianRupee,
  Layers,
  Users,
  Download,
  Printer,
  FileBarChart,
} from 'lucide-react';

type ReportTab = 'financial' | 'occupancy' | 'ledger';

const TABS: Array<{ key: ReportTab; label: string; icon: React.ElementType }> = [
  { key: 'financial', label: 'Financial', icon: IndianRupee },
  { key: 'occupancy', label: 'Occupancy', icon: Layers },
  { key: 'ledger', label: 'Tenant Ledger', icon: Users },
];

export const ReportsPage: React.FC = () => {
  const { rooms, tenants, payments, charges, settings, activeProperty, getStats } = usePG();
  const stats = getStats();
  const [tab, setTab] = useState<ReportTab>('financial');
  const [statementTenant, setStatementTenant] = useState<Tenant | null>(null);

  const generatedOn = new Date().toLocaleString('en-IN');

  // --- Financial: monthly collection summary ---------------------------------
  const monthlySummary = useMemo(() => {
    const byMonth = new Map<string, { collected: number; count: number }>();
    payments
      .filter((p) => p.status === 'paid')
      .forEach((p) => {
        const entry = byMonth.get(p.month) || { collected: 0, count: 0 };
        entry.collected += p.amount;
        entry.count += 1;
        byMonth.set(p.month, entry);
      });
    return Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [payments]);

  const roomTypeName = (id: string) => activeProperty?.roomTypes.find((rt) => rt.id === id)?.name || '-';
  const sharingLabel = (id: string) => activeProperty?.sharingOptions.find((s) => s.id === id)?.label || '-';

  const handlePrint = () => window.print();

  const exportFinancialCsv = () => {
    downloadCsv(
      `financial-report-${activeProperty?.name || 'property'}`,
      ['Receipt No', 'Tenant', 'Room', 'Month', 'Amount', 'Mode', 'Status', 'Date'],
      payments.map((p) => [p.receiptNumber, p.tenantName, p.roomNumber, p.month, p.amount, p.paymentMode, p.status, p.paymentDate])
    );
  };

  const exportOccupancyCsv = () => {
    downloadCsv(
      `occupancy-report-${activeProperty?.name || 'property'}`,
      ['Room No', 'Floor', 'Room Type', 'Sharing', 'Total Beds', 'Occupied Beds', 'Vacant Beds', 'Price/Bed (₹)'],
      rooms.map((r) => {
        const occupied = r.beds.filter((b) => b.status === 'occupied').length;
        return [r.roomNumber, r.floor, roomTypeName(r.roomTypeId), sharingLabel(r.sharingId), r.beds.length, occupied, r.beds.length - occupied, r.pricePerBed];
      })
    );
  };

  const exportLedgerCsv = () => {
    downloadCsv(
      `tenant-ledger-${activeProperty?.name || 'property'}`,
      ['Name', 'Phone', 'Room', 'Floor', 'Check-in', 'Monthly Rent', 'Deposit Paid', 'Due Amount', 'Rent Status', 'KYC Status'],
      tenants.map((t) => [
        t.name,
        t.phone,
        t.roomNumber || 'Unassigned',
        t.floor,
        t.checkInDate,
        t.monthlyRent,
        t.depositPaid ? 'Yes' : 'No',
        t.dueAmount,
        t.rentStatus,
        t.kyc?.status || 'unsubmitted',
      ])
    );
  };

  return (
    <div id="reports-view" className="space-y-6 animate-in fade-in text-slate-900 print-area">
      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-5 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <FileBarChart className="w-5 h-5 text-brand-700" />
              <span>Reports</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial, occupancy, and tenant ledger reports - export as CSV or print/save as PDF.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
                tab === key
                  ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Print-only header (hidden on screen, shown on the printed page) */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-black">{settings.pgName}</h1>
        <p className="text-xs text-slate-500">
          {TABS.find((t) => t.key === tab)?.label} Report - Generated {generatedOn}
        </p>
      </div>

      {tab === 'financial' && (
        <div className="space-y-6">
          <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between print:hidden">
              <h3 className="font-bold text-sm text-slate-900">Financial Summary</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={exportFinancialCsv} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button type="button" onClick={handlePrint} className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Expected Revenue</span>
                <div className="text-lg font-black text-slate-900 mt-1">₹{stats.totalExpectedRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                <span className="font-bold text-emerald-800 uppercase tracking-wider">Collected</span>
                <div className="text-lg font-black text-emerald-700 mt-1">₹{stats.totalReceivedRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
                <span className="font-bold text-rose-800 uppercase tracking-wider">Outstanding</span>
                <div className="text-lg font-black text-rose-600 mt-1">₹{stats.totalDueRevenue.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-brand-50/70 p-4 rounded-2xl border border-brand-200">
                <span className="font-bold text-brand-800 uppercase tracking-wider">Deposits Held</span>
                <div className="text-lg font-black text-brand-900 mt-1">
                  ₹{tenants.reduce((sum, t) => sum + (t.depositPaid ? t.securityDeposit : 0), 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-right">Payments</th>
                    <th className="py-2 px-3 text-right">Collected (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {monthlySummary.length === 0 ? (
                    <tr><td colSpan={3} className="py-4 px-3 text-center text-slate-500">No confirmed payments yet.</td></tr>
                  ) : (
                    monthlySummary.map((m) => (
                      <tr key={m.month}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{m.month}</td>
                        <td className="py-2.5 px-3 text-right">{m.count}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{m.collected.toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Full Payment Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2 px-3">Receipt No.</th>
                    <th className="py-2 px-3">Tenant & Room</th>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Mode</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-900">{p.receiptNumber}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{p.tenantName}</p>
                        <p className="text-[10px] text-slate-500">Room {p.roomNumber}</p>
                      </td>
                      <td className="py-2.5 px-3">{p.month}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">₹{p.amount.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-3">{p.paymentMode}</td>
                      <td className="py-2.5 px-3 capitalize">{p.status}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.paymentDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'occupancy' && (
        <div className="space-y-6">
          <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between print:hidden">
              <h3 className="font-bold text-sm text-slate-900">Occupancy Summary</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={exportOccupancyCsv} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button type="button" onClick={handlePrint} className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Total Rooms</span>
                <div className="text-lg font-black text-slate-900 mt-1">{stats.totalRooms}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Total Beds</span>
                <div className="text-lg font-black text-slate-900 mt-1">{stats.totalBeds}</div>
              </div>
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                <span className="font-bold text-emerald-800 uppercase tracking-wider">Occupied</span>
                <div className="text-lg font-black text-emerald-700 mt-1">{stats.occupiedBeds}</div>
              </div>
              <div className="bg-brand-50/70 p-4 rounded-2xl border border-brand-200">
                <span className="font-bold text-brand-800 uppercase tracking-wider">Occupancy Rate</span>
                <div className="text-lg font-black text-brand-900 mt-1">{stats.occupancyRate}%</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2 px-3">Floor</th>
                    <th className="py-2 px-3 text-right">Rooms</th>
                    <th className="py-2 px-3 text-right">Beds</th>
                    <th className="py-2 px-3 text-right">Occupied</th>
                    <th className="py-2 px-3 text-right">Vacant</th>
                    <th className="py-2 px-3 text-right">Occupancy</th>
                    <th className="py-2 px-3 text-right">Rent Collected (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {stats.floorSummaries.map((f) => (
                    <tr key={f.floor}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">Floor {f.floor}</td>
                      <td className="py-2.5 px-3 text-right">{f.totalRooms}</td>
                      <td className="py-2.5 px-3 text-right">{f.totalBeds}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">{f.occupiedBeds}</td>
                      <td className="py-2.5 px-3 text-right text-rose-600 font-bold">{f.vacantBeds}</td>
                      <td className="py-2.5 px-3 text-right">{f.occupancyRate}%</td>
                      <td className="py-2.5 px-3 text-right font-bold text-brand-900">{f.totalRent.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Room-wise Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2 px-3">Room</th>
                    <th className="py-2 px-3">Floor</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Sharing</th>
                    <th className="py-2 px-3 text-right">Beds</th>
                    <th className="py-2 px-3 text-right">Occupied</th>
                    <th className="py-2 px-3 text-right">Vacant</th>
                    <th className="py-2 px-3 text-right">Price/Bed (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {rooms.map((r) => {
                    const occupied = r.beds.filter((b) => b.status === 'occupied').length;
                    return (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.roomNumber}</td>
                        <td className="py-2.5 px-3">{r.floor}</td>
                        <td className="py-2.5 px-3">{roomTypeName(r.roomTypeId)}</td>
                        <td className="py-2.5 px-3">{sharingLabel(r.sharingId)}</td>
                        <td className="py-2.5 px-3 text-right">{r.beds.length}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">{occupied}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600 font-bold">{r.beds.length - occupied}</td>
                        <td className="py-2.5 px-3 text-right">{r.pricePerBed.toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="font-bold text-sm text-slate-900">Tenant Ledger</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportLedgerCsv} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button type="button" onClick={handlePrint} className="px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm">
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-2 px-3">Tenant</th>
                  <th className="py-2 px-3">Room</th>
                  <th className="py-2 px-3">Check-in</th>
                  <th className="py-2 px-3 text-right">Monthly Rent</th>
                  <th className="py-2 px-3">Deposit</th>
                  <th className="py-2 px-3 text-right">Due</th>
                  <th className="py-2 px-3">KYC</th>
                  <th className="py-2 px-3 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{t.name}</td>
                    <td className="py-2.5 px-3">{t.roomNumber || 'Unassigned'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{t.checkInDate}</td>
                    <td className="py-2.5 px-3 text-right">₹{t.monthlyRent.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3">{t.depositPaid ? 'Paid' : 'Pending'}</td>
                    <td className={`py-2.5 px-3 text-right font-bold ${t.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      ₹{t.dueAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 capitalize">{t.kyc?.status || 'unsubmitted'}</td>
                    <td className="py-2.5 px-3 text-right print:hidden">
                      <button
                        type="button"
                        onClick={() => setStatementTenant(t)}
                        className="px-2.5 py-1 bg-white hover:bg-brand-50 text-brand-700 border border-brand-200 rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TenantStatementModal
        tenant={statementTenant}
        payments={payments}
        charges={charges}
        settings={settings}
        isOpen={!!statementTenant}
        onClose={() => setStatementTenant(null)}
      />
    </div>
  );
};
