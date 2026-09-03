import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import {
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  CheckCircle,
  FileCheck2,
  Phone,
  Building,
  MapPin,
  Camera,
  Printer,
  Sparkles,
  HeartPulse,
  Briefcase,
  Utensils,
} from 'lucide-react';
import { AadhaarKYCModal } from './AadhaarKYCModal';

export const TenantKYC: React.FC = () => {
  const { activeTenant, settings } = usePG();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!activeTenant) return null;

  const kyc = activeTenant.kyc;

  return (
    <div id="tenant-kyc-verification-view" className="space-y-6 animate-in fade-in">
      
      {/* Header - Royal Blue & White */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
              Government Identity Verification
            </span>
            <span className="text-xs text-slate-500">UIDAI / Aadhaar Compliant</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1.5 flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-blue-700" />
            <span>My Aadhaar Card KYC & Verification Status</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Mandatory police verification records and registered personal identity details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-blue-700/20 transition"
        >
          <CreditCard className="w-4 h-4" />
          <span>{kyc?.status === 'verified' ? 'Update KYC Info' : 'Submit Aadhaar KYC'}</span>
        </button>
      </div>

      {/* Verification Status Banner */}
      <div
        className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          kyc?.status === 'verified'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : kyc?.status === 'pending'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}
      >
        <div className="flex items-start space-x-3">
          {kyc?.status === 'verified' ? (
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="font-bold text-sm">
              Status:{' '}
              {kyc?.status === 'verified'
                ? 'Aadhaar Verification Completed & Approved'
                : kyc?.status === 'pending'
                ? 'Documents Submitted • Pending Owner Review'
                : 'Aadhaar KYC Not Yet Submitted'}
            </h3>
            <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
              {kyc?.status === 'verified'
                ? `Verified on ${kyc?.aadhaar?.verifiedAt || 'Active'}. Your PG tenancy compliance is up to date.`
                : kyc?.status === 'pending'
                ? 'Our PG owner will verify your Aadhaar details shortly.'
                : 'Please complete your Aadhaar upload to avoid accommodation disruptions.'}
            </p>
          </div>
        </div>
      </div>

      {/* Aadhaar Card Digital Preview & Details */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <CreditCard className="w-4 h-4 text-blue-700" />
          <span>Aadhaar Identity Details on Record</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-blue-50/60 p-5 rounded-2xl border border-blue-200 space-y-2">
            <span className="text-blue-900 uppercase text-[10px] font-bold">Aadhaar 12-Digit Number</span>
            <p className="text-lg font-mono font-black text-blue-950">
              {kyc?.aadhaar?.aadhaarNumber || 'Not provided'}
            </p>
            <span className="text-slate-500 uppercase text-[10px] font-bold block pt-2">Full Name on Aadhaar</span>
            <p className="text-sm font-bold text-slate-900 uppercase">
              {kyc?.aadhaar?.nameOnAadhaar || activeTenant.name}
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-slate-500 uppercase text-[10px] font-bold">Date of Birth (DOB) & Gender</span>
            <p className="text-sm font-bold text-slate-900">
              {kyc?.aadhaar?.dob || '2000-01-01'} • {kyc?.aadhaar?.gender || 'Male'}
            </p>
            <span className="text-slate-500 uppercase text-[10px] font-bold block pt-2">Permanent Address</span>
            <p className="text-xs text-slate-700 font-medium">
              {kyc?.aadhaar?.address || kyc?.permanentAddress || 'Bengaluru, Karnataka'}
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Contact & Employment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Emergency Contact */}
        <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 flex items-center space-x-2">
            <HeartPulse className="w-4 h-4 text-rose-600" />
            <span>Emergency Contacts</span>
          </h3>
          <div className="bg-rose-50/50 p-4 rounded-2xl space-y-2 border border-rose-200">
            <p><span className="text-slate-500 font-medium">Primary Contact:</span> <span className="font-bold text-slate-900">{kyc?.emergencyContactName || 'Ramesh Sharma'}</span></p>
            <p><span className="text-slate-500 font-medium">Relationship:</span> <span className="font-semibold text-slate-800">{kyc?.emergencyContactRelation || 'Father'}</span></p>
            <p><span className="text-slate-500 font-medium">Emergency Phone:</span> <span className="font-mono text-rose-700 font-bold">{kyc?.emergencyContactPhone || '+91 98450 99881'}</span></p>
            <p><span className="text-slate-500 font-medium">Father's Name:</span> <span className="font-semibold text-slate-800">{kyc?.fatherName || 'Ramesh Sharma'}</span></p>
          </div>
        </div>

        {/* Occupation & College */}
        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-3 text-xs">
          <h3 className="font-bold text-slate-900 flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-blue-700" />
            <span>Occupation & Preferences</span>
          </h3>
          <div className="bg-blue-50/50 p-4 rounded-2xl space-y-2 border border-blue-200">
            <p><span className="text-slate-500 font-medium">Occupation:</span> <span className="font-bold text-slate-900">{kyc?.occupation || 'Working Professional'}</span></p>
            <p><span className="text-slate-500 font-medium">Company / College:</span> <span className="font-semibold text-slate-800">{kyc?.companyOrCollege || 'Tech Mahindra'}</span></p>
            <p><span className="text-slate-500 font-medium">Food Preference:</span> <span className="text-blue-900 font-bold">{kyc?.foodPreference || 'Veg'}</span></p>
            <p><span className="text-slate-500 font-medium">Blood Group:</span> <span className="font-semibold text-slate-800">{kyc?.bloodGroup || 'B+'}</span></p>
          </div>
        </div>
      </div>

      {/* Aadhaar KYC Modal */}
      <AadhaarKYCModal
        tenant={activeTenant}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  );
};
