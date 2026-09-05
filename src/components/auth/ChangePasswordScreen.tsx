import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { changeOwnPassword } from '../../services/authService';
import { usePG } from '../../context/PGContext';

// Shown once, immediately after an invited admin/staff account's first
// login with the temporary password an owner shared with them (see
// SettingsPage.tsx Team Access / server/app.ts create-team-member).
export const ChangePasswordScreen: React.FC = () => {
  const { clearMustChangePassword, logout } = usePG();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await changeOwnPassword(password);
      clearMustChangePassword();
    } catch (err: any) {
      setError(err?.message?.replace('Firebase: ', '') || 'Could not change password. Please try logging in again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-brand-100 rounded-3xl p-8 shadow-xl text-slate-900 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-700 text-white flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-slate-900">Set Your Own Password</h1>
          <p className="text-xs text-slate-500">
            You signed in with a temporary password. Choose a new one you'll actually remember before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">New Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-brand-700/20 flex items-center justify-center space-x-2 text-xs disabled:opacity-70"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Set Password & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button type="button" onClick={() => logout()} className="w-full text-center text-xs text-slate-500 hover:text-slate-700">
            Cancel and sign out
          </button>
        </form>
      </div>
    </div>
  );
};
