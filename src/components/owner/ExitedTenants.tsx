import React, { useState } from 'react';
import { Search, Trash2, UserMinus } from 'lucide-react';
import { usePG } from '../../context/PGContext';
import { Tenant } from '../../types';
import { TenantAvatar } from '../common/TenantAvatar';
import { TenantProfilePanel } from './TenantProfilePanel';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// Residents who completed exit formalities (checkOutDate set). They are kept
// here for records; an admin can permanently delete one (e.g. a test entry).
export const ExitedTenants: React.FC = () => {
  const { tenants, deleteTenant, ownerProfile } = usePG();
  const isAdmin = ownerProfile?.role === 'owner';
  const [search, setSearch] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const exited = tenants
    .filter((t) => !!t.checkOutDate)
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search))
    .sort((a, b) => (b.checkOutDate || '').localeCompare(a.checkOutDate || ''));
  const profileTenant = profileId ? tenants.find((t) => t.id === profileId) : undefined;

  const handleDelete = async (t: Tenant) => {
    const owed = t.dueAmount > 0 ? ` They still owe ${inr(t.dueAmount)}, which will be lost.` : '';
    if (!window.confirm(`Permanently delete ${t.name} from the database?${owed}\n\nThis cannot be undone. Past payment receipts are kept.`)) return;
    setError('');
    try {
      await deleteTenant(t.id);
    } catch (e: any) {
      setError(e?.message || 'Could not delete this tenant.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
            <UserMinus className="w-5 h-5 text-brand-700" />
            <span>Exited Tenants</span>
          </h2>
          <p className="text-xs text-slate-500">Residents who have moved out. Open one to see their exit settlement.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone"
            className="pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-brand-600"
          />
        </div>
      </div>

      {error && <p className="text-xs text-rose-700">{error}</p>}

      {exited.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">No exited tenants yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exited.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <button type="button" onClick={() => setProfileId(t.id)} className="flex items-center space-x-3 text-left w-full">
                <TenantAvatar name={t.name} photoUrl={t.photoUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">+91 {t.phone.replace(/\D/g, '').slice(-10)}</p>
                </div>
              </button>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <p>Joined {t.checkInDate} · Moved out {t.checkOutDate}</p>
                {t.exitSettlement && <p>Deposit refunded {inr(t.exitSettlement.refundAmount)}</p>}
                {t.dueAmount > 0 && <p className="font-bold text-rose-600">Unpaid dues {inr(t.dueAmount)}</p>}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center justify-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete permanently</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {profileTenant && <TenantProfilePanel tenant={profileTenant} onClose={() => setProfileId(null)} />}
    </div>
  );
};
