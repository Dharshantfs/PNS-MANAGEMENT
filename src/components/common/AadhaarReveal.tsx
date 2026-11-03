import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usePG } from '../../context/PGContext';
import { auth } from '../../lib/firebase';
import { formatAadhaar, maskAadhaar } from '../../lib/aadhaar';
import { Tenant } from '../../types';

// Masked Aadhaar number (XXXX XXXX 1234). An owner-role account can reveal
// the full number for this tenant - the server records who looked in the
// activity log (api/_lib/app.ts POST /api/kyc/reveal-aadhaar). It is held
// only in this component's memory and hidden again on close.
export const AadhaarReveal: React.FC<{ tenant: Tenant; emptyText?: string; className?: string }> = ({
  tenant,
  emptyText = 'Not submitted',
  className = '',
}) => {
  const { ownerProfile } = usePG();
  const [full, setFull] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const masked = maskAadhaar(tenant.kyc?.aadhaar);
  const canReveal = ownerProfile?.role === 'owner' && !!masked;

  const reveal = async () => {
    setBusy(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/kyc/reveal-aadhaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load the number.');
      if (!data.aadhaarNumber) throw new Error('No full number on record.');
      setFull(formatAadhaar(data.aadhaarNumber));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!masked) return <p className={className}>{emptyText}</p>;

  return (
    <div>
      <p className={`${className} flex items-center gap-2`}>
        <span>{full || masked}</span>
        {canReveal && (
          <button
            type="button"
            onClick={full ? () => setFull('') : reveal}
            disabled={busy}
            className="text-brand-700 hover:text-brand-900"
            title={full ? 'Hide' : 'Show full number (recorded in the activity log)'}
          >
            {full ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </p>
      {error && <p className="text-[10px] text-rose-700">{error}</p>}
    </div>
  );
};
