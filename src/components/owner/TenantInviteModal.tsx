import React, { useState } from 'react';
import { Tenant } from '../../types';
import {
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Send,
  X,
  Sparkles,
  Phone,
  ShieldCheck,
  Building,
  BedDouble,
  UserCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TenantInviteModalProps {
  tenant: Tenant;
  isOpen: boolean;
  onClose: () => void;
  onOpenFormDirectly?: (tenantId: string) => void;
}

export const TenantInviteModal: React.FC<TenantInviteModalProps> = ({
  tenant,
  isOpen,
  onClose,
  onOpenFormDirectly,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isSendingTwilio, setIsSendingTwilio] = useState(false);
  const [twilioStatus, setTwilioStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    msg: string;
  }>({ type: 'idle', msg: '' });

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${origin}/?onboard=${tenant.id}`;
  const cleanPhone = tenant.phone.replace(/\D/g, '');

  const whatsappMessage = `Hello ${tenant.name}! 👋\n\nWelcome to PNS Luxury PG.\nYou have been allocated Room ${tenant.roomNumber || 'Assigned'} (${tenant.bedLabel || 'Bed Assigned'}).\n\nPlease fill out your mandatory Digital KYC (Aadhaar Card, Date of Birth, Emergency Contact, and Occupation) by opening this secure link:\n\n${inviteUrl}\n\nAfter submitting, you can immediately log in to the PNS PG Tenant Portal using your mobile number (+91 ${cleanPhone}) to pay rent via UPI and access PG amenities.`;

  const waMeUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleSendTwilioWhatsApp = async () => {
    setIsSendingTwilio(true);
    setTwilioStatus({ type: 'idle', msg: '' });

    try {
      const response = await fetch('/api/send-whatsapp-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          tenantName: tenant.name,
          roomNumber: tenant.roomNumber || 'Assigned',
          inviteUrl,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTwilioStatus({
          type: 'success',
          msg: data.message || 'WhatsApp invitation dispatched successfully!',
        });
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      } else {
        setTwilioStatus({
          type: 'error',
          msg: data.error || 'Failed to send WhatsApp message.',
        });
      }
    } catch (err) {
      setTwilioStatus({
        type: 'error',
        msg: 'Network error communicating with WhatsApp service.',
      });
    } finally {
      setIsSendingTwilio(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border border-brand-100 text-slate-900">
        
        {/* Top Header - Royal Blue */}
        <div className="sticky top-0 bg-brand-700 text-white px-6 py-4 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center border border-white/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Send WhatsApp KYC Invitation</h2>
              <p className="text-xs text-brand-100">Send direct registration link to tenant's mobile</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          
          {/* Tenant Summary Banner */}
          <div className="bg-brand-50/80 border border-brand-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <img
                src={tenant.photoUrl}
                alt={tenant.name}
                className="w-12 h-12 rounded-xl object-cover border-2 border-brand-600 shadow-sm shrink-0"
              />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{tenant.name}</h3>
                <p className="text-xs text-brand-800 font-semibold flex items-center space-x-1">
                  <Phone className="w-3 h-3 mr-0.5 text-brand-600" />
                  <span>+91 {cleanPhone}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  {tenant.roomNumber ? `Room ${tenant.roomNumber} (${tenant.bedLabel}) • Floor ${tenant.floor}` : 'Bed Unassigned'}
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <span className="text-[11px] font-semibold text-brand-900 bg-brand-100 px-2.5 py-1 rounded-lg border border-brand-200 inline-block">
                Monthly Rent: ₹{tenant.monthlyRent.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Invitation Link Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tenant KYC Registration Link:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-brand-900 font-medium select-all focus:outline-none focus:border-brand-600"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300 transition flex items-center space-x-1 shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Formatted Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                WhatsApp Invitation Message Preview:
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-xs text-brand-700 hover:text-brand-800 font-semibold flex items-center space-x-1"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMessage ? 'Message Copied!' : 'Copy Text'}</span>
              </button>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
              {whatsappMessage}
            </div>
          </div>

          {/* Twilio Status Feedback */}
          {twilioStatus.msg && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border flex items-center space-x-2 ${
                twilioStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{twilioStatus.msg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Direct WhatsApp WA.ME Button */}
            <a
              href={waMeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Open in WhatsApp (wa.me)</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            {/* Twilio WhatsApp Automated Dispatch */}
            <button
              type="button"
              onClick={handleSendTwilioWhatsApp}
              disabled={isSendingTwilio}
              className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20 flex items-center justify-center space-x-2 disabled:opacity-70"
            >
              {isSendingTwilio ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Dispatching WhatsApp...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send via Twilio Gateway</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Option to Preview/Fill Form Right Away */}
          {onOpenFormDirectly && (
            <div className="pt-2 text-center border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFormDirectly(tenant.id);
                }}
                className="text-xs text-brand-700 hover:text-brand-900 font-bold underline"
              >
                Or Open and Fill KYC Onboarding Form Right Now →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
