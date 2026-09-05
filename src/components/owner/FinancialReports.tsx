import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { PaymentRecord, Tenant } from '../../types';
import {
  IndianRupee,
  TrendingUp,
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Printer,
  X,
  CreditCard,
  MessageSquare,
  FileSpreadsheet,
  ShieldCheck,
  AlertCircle,
  ReceiptText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ReceiptModal } from '../common/ReceiptModal';

export const FinancialReports: React.FC = () => {
  const { payments, tenants, settings, activeProperty, getStats, recordPayment, confirmPendingPayment, addDueCharge, charges } = usePG();
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const stats = getStats();
  const activeDuesCategories = (activeProperty?.duesCategories || []).filter((c) => c.active);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentRecord | null>(null);

  // Add Dues (charge) form state
  const [isAddDuesOpen, setIsAddDuesOpen] = useState(false);
  const [dueTenantId, setDueTenantId] = useState('');
  const [dueCategoryId, setDueCategoryId] = useState('');
  const [dueAmount, setDueAmount] = useState<number>(0);
  const [dueNotes, setDueNotes] = useState('');
  const [dueError, setDueError] = useState('');

  // New payment form state
  const [payTenantId, setPayTenantId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(8500);
  const [payMonth, setPayMonth] = useState('August 2026');
  const [payMode, setPayMode] = useState<'UPI' | 'Cash' | 'Bank Transfer' | 'Card'>('UPI');
  const [payTxnId, setPayTxnId] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // WhatsApp Reminder State
  const [sendingWa, setSendingWa] = useState<string | null>(null);
  const [waToast, setWaToast] = useState<string | null>(null);

  // Filtered payments ledger
  const filteredPayments = payments.filter((p) => {
    if (selectedMonth !== 'all' && p.month !== selectedMonth) return false;
    if (
      searchTerm &&
      !p.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !p.roomNumber.includes(searchTerm) &&
      !p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTenantId || payAmount <= 0) return;

    const newPayment = await recordPayment({
      tenantId: payTenantId,
      amount: Number(payAmount),
      month: payMonth,
      paymentMode: payMode,
      transactionId: payTxnId.trim() || undefined,
      notes: payNotes.trim() || undefined,
    });

    setIsRecordPaymentOpen(false);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
    setSelectedReceiptPayment(newPayment);
  };

  const handleSelectTenantForPayment = (tenantId: string) => {
    setPayTenantId(tenantId);
    const t = tenants.find((item) => item.id === tenantId);
    if (t) {
      setPayAmount(t.dueAmount > 0 ? t.dueAmount : t.monthlyRent);
    }
  };

  const handleSelectDuesCategory = (categoryId: string) => {
    setDueCategoryId(categoryId);
    const cat = activeDuesCategories.find((c) => c.id === categoryId);
    if (cat?.amountType === 'fixed') setDueAmount(cat.fixedAmount || 0);
  };

  const handleAddDues = async (e: React.FormEvent) => {
    e.preventDefault();
    setDueError('');
    if (!dueTenantId || !dueCategoryId || dueAmount <= 0) return;
    try {
      await addDueCharge(dueTenantId, dueCategoryId, dueAmount, dueNotes.trim() || undefined);
      setIsAddDuesOpen(false);
      setDueTenantId('');
      setDueCategoryId('');
      setDueAmount(0);
      setDueNotes('');
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
    } catch (err: any) {
      setDueError(err?.message || 'Failed to add due.');
    }
  };

  const handleSendWhatsAppReminder = async (tenant: Tenant) => {
    setSendingWa(tenant.id);
    try {
      const response = await fetch('/api/send-whatsapp-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: tenant.phone,
          tenantName: tenant.name,
          amountDue: tenant.dueAmount,
          dueDate: '5th of the month',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setWaToast(`WhatsApp reminder dispatched to ${tenant.name}!`);
        setTimeout(() => setWaToast(null), 3500);
      }
    } catch {
      setWaToast('Failed to dispatch reminder.');
    }
    setSendingWa(null);
  };

  return (
    <div id="financial-reports-view" className="space-y-6 animate-in fade-in text-slate-900">
      
      {/* Top Header & Actions - Royal Blue & White */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <IndianRupee className="w-5 h-5 text-blue-700" />
              <span>Rent Collection & Financial Reports</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track collected revenue, monitor outstanding rent dues, generate digital receipts, and send reminders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="add-dues-btn"
              type="button"
              onClick={() => setIsAddDuesOpen(true)}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 font-bold rounded-xl text-xs flex items-center space-x-2 shadow-sm transition"
            >
              <ReceiptText className="w-4 h-4" />
              <span>Add Dues</span>
            </button>
            <button
              id="record-manual-payment-btn"
              type="button"
              onClick={() => setIsRecordPaymentOpen(true)}
              className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-md shadow-blue-700/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Rent Payment</span>
            </button>
          </div>
        </div>

        {/* 4 Financial KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Monthly Potential</span>
            <div className="text-xl font-black text-slate-900 mt-1">
              ₹{stats.totalExpectedRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
              Across {stats.occupiedBeds} occupied beds
            </p>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Rent Collected</span>
            <div className="text-xl font-black text-emerald-700 mt-1">
              ₹{stats.totalReceivedRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              {payments.length} successful payments recorded
            </p>
          </div>

          <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Outstanding Dues</span>
            <div className="text-xl font-black text-rose-600 mt-1">
              ₹{stats.totalDueRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-rose-700 font-medium mt-0.5">
              {tenants.filter((t) => t.dueAmount > 0).length} tenants pending
            </p>
          </div>

          <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Security Deposits Held</span>
            <div className="text-xl font-black text-blue-900 mt-1">
              ₹
              {tenants
                .reduce((sum, t) => sum + (t.depositPaid ? t.securityDeposit : 0), 0)
                .toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-blue-700 font-medium mt-0.5">Refundable safety deposits</p>
          </div>
        </div>
      </div>

      {waToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{waToast}</span>
        </div>
      )}

      {/* Outstanding Rent Reminders Queue */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Unpaid Tenants & Automated WhatsApp Reminders</h3>
            <p className="text-xs text-slate-500">Dispatch instant payment notifications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tenants.filter((t) => t.dueAmount > 0).length === 0 ? (
            <div className="col-span-full p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
              <span>All tenants are fully paid!</span>
            </div>
          ) : (
            tenants
              .filter((t) => t.dueAmount > 0)
              .map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between text-xs"
                >
                  <div>
                    <h4 className="font-bold text-slate-900">{t.name}</h4>
                    <p className="text-rose-600 font-bold">₹{t.dueAmount.toLocaleString('en-IN')} Due</p>
                    <p className="text-[10px] text-slate-500">Room {t.roomNumber} ({t.bedLabel})</p>
                  </div>

                  <button
                    type="button"
                    disabled={sendingWa === t.id}
                    onClick={() => handleSendWhatsAppReminder(t)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1 disabled:opacity-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{sendingWa === t.id ? 'Sending...' : 'Remind'}</span>
                  </button>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Tenant-reported payments awaiting owner confirmation (manual reconciliation) */}
      {pendingPayments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Payments Awaiting Your Confirmation</h3>
              <p className="text-xs text-slate-600">Tenants reported these as paid via UPI - confirm once you see them credited in your bank/UPI statement.</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingPayments.map((p) => (
              <div key={p.id} className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{p.tenantName} - Room {p.roomNumber}</p>
                  <p className="text-slate-500">₹{p.amount.toLocaleString('en-IN')} • {p.month} • Ref: {p.transactionId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => confirmPendingPayment(p.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Received</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Dues Added (charges) */}
      {charges.length > 0 && (
        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <ReceiptText className="w-4 h-4 text-blue-700" />
            <span>Recent Dues Added</span>
          </h3>
          <div className="space-y-1.5">
            {charges
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .slice(0, 6)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-700">
                    <span className="font-bold text-slate-900">{c.tenantName}</span> - {c.categoryName}
                    {c.notes ? ` (${c.notes})` : ''}
                  </span>
                  <span className="font-bold text-rose-600">+₹{c.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Payments Ledger Table */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Payment Ledger & Receipts</h3>
              <p className="text-xs text-slate-500">Official digital receipts with GST & transaction IDs</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenant, room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Receipt No.</th>
                <th className="py-3 px-3">Tenant & Room</th>
                <th className="py-3 px-3">Month</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition">
                  <td className="py-3.5 px-3 font-mono font-bold text-blue-900">{p.receiptNumber}</td>
                  <td className="py-3.5 px-3">
                    <p className="font-bold text-slate-900">{p.tenantName}</p>
                    <p className="text-[10px] text-slate-500">Room {p.roomNumber}</p>
                  </td>
                  <td className="py-3.5 px-3 font-bold text-slate-700">{p.month}</td>
                  <td className="py-3.5 px-3 font-bold text-emerald-600">₹{p.amount.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold border border-blue-200">
                      {p.paymentMode}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    {p.status === 'pending' ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200">Pending</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">Paid</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-slate-500">{p.paymentDate}</td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedReceiptPayment(p)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition shadow-sm inline-flex items-center space-x-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-blue-100 text-slate-900 overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2">
                <IndianRupee className="w-4 h-4 text-white" />
                <h3 className="font-bold text-sm text-white">Record Manual Rent Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordPaymentOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Tenant *</label>
                <select
                  required
                  value={payTenantId}
                  onChange={(e) => handleSelectTenantForPayment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Room {t.roomNumber} - Due: ₹{t.dueAmount})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Ref / UTR</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-9843219082"
                  value={payTxnId}
                  onChange={(e) => setPayTxnId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-700/20 flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Payment & Issue Receipt</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Dues (Charge) Modal */}
      {isAddDuesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-blue-100 text-slate-900 overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2">
                <ReceiptText className="w-4 h-4 text-white" />
                <h3 className="font-bold text-sm text-white">Add Dues to Tenant Account</h3>
              </div>
              <button type="button" onClick={() => setIsAddDuesOpen(false)} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDues} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Tenant *</label>
                <select
                  required
                  value={dueTenantId}
                  onChange={(e) => setDueTenantId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (Room {t.roomNumber || 'Unassigned'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dues Category *</label>
                <select
                  required
                  value={dueCategoryId}
                  onChange={(e) => handleSelectDuesCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">-- Choose Category --</option>
                  {activeDuesCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.amountType === 'fixed' ? `(₹${c.fixedAmount})` : '(Variable)'}
                    </option>
                  ))}
                </select>
                {activeDuesCategories.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">No active dues categories yet - add one under Settings &gt; Dues Packages.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={dueAmount}
                  onChange={(e) => setDueAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={dueNotes}
                  onChange={(e) => setDueNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {dueError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">{dueError}</div>}

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-700/20 flex items-center justify-center space-x-2"
              >
                <ReceiptText className="w-4 h-4" />
                <span>Add to Tenant's Due</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {selectedReceiptPayment && (
        <ReceiptModal
          payment={selectedReceiptPayment}
          isOpen={!!selectedReceiptPayment}
          onClose={() => setSelectedReceiptPayment(null)}
        />
      )}

    </div>
  );
};
