import React, { useState } from 'react';
import { Building2, Users, ArrowRight, ShieldCheck, Lock, Mail, MessageSquare } from 'lucide-react';
import { ownerSignIn, sendPasswordSetupEmail } from '../../services/authService';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
  onOpenKYCOnboarding?: (phone?: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenKYCOnboarding }) => {
  const [loginMode, setLoginMode] = useState<'tenant' | 'owner'>('tenant');

  // Owner state - sign-in only. There is no public sign-up: the first owner
  // account is created in the Firebase Console, and every account after that
  // is invited by an existing owner from Settings > Team Access (see
  // authService.createTeamMember / api/_lib/app.ts).
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  // Tenant state - email + password. The login is created when the tenant
  // submits their KYC form, and Firebase emails them a link to set their
  // password (api/_lib/app.ts POST /api/onboard/tenant-login). Phone OTP
  // needs Firebase's paid Blaze plan for SMS, so it isn't offered here.
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPassword, setTenantPassword] = useState('');

  const [resetSentTo, setResetSentTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (mode: 'tenant' | 'owner') => {
    setLoginMode(mode);
    setError('');
    setResetSentTo('');
  };

  const signIn = async (email: string, password: string) => {
    setError('');
    setResetSentTo('');
    setLoading(true);
    try {
      await ownerSignIn(email.trim(), password);
      // Firebase's onAuthStateChanged listener (in PGContext) picks up the
      // signed-in user and works out owner/staff vs tenant from the account.
    } catch (err: any) {
      const code = err?.code || '';
      setError(
        ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)
          ? 'Wrong email or password. Tap "Forgot password?" to set a new one.'
          : err?.message?.replace('Firebase: ', '') || 'Sign-in failed. Check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(ownerEmail, ownerPassword);
  };

  const handleTenantLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(tenantEmail, tenantPassword);
  };

  // Firebase's free "set your password" email - same for tenants and staff.
  const handleForgotPassword = async (email: string) => {
    setError('');
    setResetSentTo('');
    if (!email.trim()) {
      setError('Type your email above first, then tap "Forgot password?".');
      return;
    }
    try {
      await sendPasswordSetupEmail(email.trim());
      setResetSentTo(email.trim());
    } catch (err: any) {
      setError(err?.message?.replace('Firebase: ', '') || 'Could not send the email. Please try again.');
    }
  };

  const resetNotice = resetSentTo ? (
    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
      If {resetSentTo} has a login, a "set your password" email is on its way. Check Spam too.
    </div>
  ) : null;

  const errorBox = error ? (
    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">{error}</div>
  ) : null;

  const submitButton = (label: string) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-brand-700/20 flex items-center justify-center space-x-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );

  const emailField = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Mail className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="email"
          value={value}
          onChange={(e) => { onChange(e.target.value); setError(''); }}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
          required
        />
      </div>
    </div>
  );

  const passwordField = (value: string, onChange: (v: string) => void, email: string, placeholder: string) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
        <button type="button" onClick={() => handleForgotPassword(email)} className="text-[11px] text-brand-700 hover:text-brand-900 font-bold">
          Forgot password?
        </button>
      </div>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Lock className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={6}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
          required
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-brand-600 selection:text-white font-sans">
      <div className="mb-6 text-center animate-in slide-in-from-bottom-4 duration-500">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-brand-700 text-white flex items-center justify-center shadow-xl shadow-brand-700/20 mb-3 border-2 border-brand-600">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">PG Management</h1>
        <p className="text-slate-600 mt-1 text-xs sm:text-sm font-medium">Digital Hostel & Resident Management Portal</p>
      </div>

      <div className="w-full max-w-md bg-white border border-brand-100 rounded-3xl p-6 md:p-8 shadow-xl text-slate-900 space-y-6">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => switchMode('tenant')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              loginMode === 'tenant' ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tenant Portal</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('owner')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              loginMode === 'owner' ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Owner / Admin</span>
          </button>
        </div>

        {/* Tenant Login: email + password set from the emailed link */}
        {loginMode === 'tenant' && (
          <form onSubmit={handleTenantLogin} className="space-y-4 animate-in slide-in-from-right-4">
            {emailField(tenantEmail, setTenantEmail, 'The email you gave in your KYC form')}
            {passwordField(tenantPassword, setTenantPassword, tenantEmail, 'Password you set from the email')}
            <p className="text-[11px] text-slate-500 -mt-2">
              After you submit your KYC form, you get an email with a link to set this password.
            </p>
            {resetNotice}
            {errorBox}
            {submitButton('Log In to Tenant Portal')}

            {onOpenKYCOnboarding && (
              <div className="pt-3 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => onOpenKYCOnboarding()}
                  className="text-xs text-brand-700 hover:text-brand-900 font-bold flex items-center justify-center space-x-1 mx-auto"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>New here? Public Registration & KYC Form →</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Owner Login: real Firebase email + password */}
        {loginMode === 'owner' && (
          <form onSubmit={handleOwnerLogin} className="space-y-4 animate-in slide-in-from-left-4">
            {emailField(ownerEmail, setOwnerEmail, 'owner@yourpg.com')}
            {passwordField(ownerPassword, setOwnerPassword, ownerEmail, 'Enter your password')}
            {resetNotice}
            {errorBox}
            {submitButton('Sign In')}
            <p className="text-center text-[11px] text-slate-500 pt-1">
              Admin access is invite-only. Ask your PG owner to add you under Settings &gt; Team Access.
            </p>
          </form>
        )}
      </div>

      <div className="mt-8 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} PG Management System. All rights reserved.
      </div>
    </div>
  );
};
