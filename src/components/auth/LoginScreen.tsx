import React, { useState } from 'react';
import { ConfirmationResult } from 'firebase/auth';
import { Building2, Users, ArrowRight, ShieldCheck, Lock, Mail, MessageSquare, FileCheck2 } from 'lucide-react';
import { ownerSignIn, sendTenantOtp, confirmTenantOtp } from '../../services/authService';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
  onOpenKYCOnboarding?: (phone?: string) => void;
}

const RECAPTCHA_CONTAINER_ID = 'tenant-otp-recaptcha';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenKYCOnboarding }) => {
  const [loginMode, setLoginMode] = useState<'tenant' | 'owner'>('tenant');

  // Owner state - sign-in only. There is no public sign-up: the first owner
  // account is created in the Firebase Console, and every account after that
  // is invited by an existing owner from Settings > Team Access (see
  // authService.createTeamMember / api/_lib/app.ts).
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  // Tenant state
  const [tenantPhone, setTenantPhone] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await ownerSignIn(ownerEmail.trim(), ownerPassword);
      // Firebase's onAuthStateChanged listener (in PGContext) picks up the
      // signed-in user automatically - no manual "success" callback needed.
    } catch (err: any) {
      setError(err?.message?.replace('Firebase: ', '') || 'Sign-in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = tenantPhone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const result = await sendTenantOtp(`+91${cleanPhone}`, RECAPTCHA_CONTAINER_ID);
      setConfirmation(result);
      setOtpStep(true);
    } catch (err: any) {
      setError(err?.message?.replace('Firebase: ', '') || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!confirmation) return;
    setLoading(true);
    try {
      await confirmTenantOtp(confirmation, otp.trim());
      // onAuthStateChanged in PGContext then looks up this phone number's
      // tenant record and property automatically.
    } catch (err: any) {
      setError(err?.message?.replace('Firebase: ', '') || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-brand-600 selection:text-white font-sans">
      {/* Invisible reCAPTCHA anchor required by Firebase phone auth */}
      <div id={RECAPTCHA_CONTAINER_ID} />

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
            onClick={() => { setLoginMode('tenant'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              loginMode === 'tenant' ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tenant Portal</span>
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('owner'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
              loginMode === 'owner' ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Owner / Admin</span>
          </button>
        </div>

        {/* Tenant Login: real Firebase phone OTP */}
        {loginMode === 'tenant' && (
          <form onSubmit={otpStep ? handleVerifyOtp : handleSendOtp} className="space-y-4 animate-in slide-in-from-right-4">
            {!otpStep ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tenant Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs font-bold text-slate-500">+91</span>
                  <input
                    type="tel"
                    value={tenantPhone}
                    onChange={(e) => { setTenantPhone(e.target.value); setError(''); }}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Enter your 10-digit mobile number to log in via OTP.</p>
              </div>
            ) : (
              <div className="animate-in slide-in-from-right-4 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-700">Enter OTP sent to +91 {tenantPhone}</label>
                  <button type="button" onClick={() => setOtpStep(false)} className="text-xs text-brand-700 hover:text-brand-900 font-bold">
                    Change number
                  </button>
                </div>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-center tracking-widest font-black text-lg focus:outline-none focus:border-brand-600 shadow-sm"
                  required
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-2">
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-brand-700/20 flex items-center justify-center space-x-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{otpStep ? 'Verify & Access Portal' : 'Send OTP to Mobile'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {onOpenKYCOnboarding && (
              <div className="pt-3 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => onOpenKYCOnboarding(tenantPhone || undefined)}
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
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@yourpg.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Enter your password"
                  minLength={6}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  required
                />
              </div>
            </div>

            {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-brand-700/20 flex items-center justify-center space-x-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

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
