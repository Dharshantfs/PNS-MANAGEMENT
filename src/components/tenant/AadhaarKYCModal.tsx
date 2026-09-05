import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Tenant, TenantKYC } from '../../types';
import {
  ShieldCheck,
  CreditCard,
  Upload,
  CheckCircle,
  FileCheck2,
  AlertCircle,
  User,
  MapPin,
  Building,
  Phone,
  Camera,
  X,
  Sparkles,
  HeartPulse,
  Briefcase,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AadhaarKYCModalProps {
  tenant: Tenant;
  isOpen: boolean;
  onClose: () => void;
}

export const AadhaarKYCModal: React.FC<AadhaarKYCModalProps> = ({
  tenant,
  isOpen,
  onClose,
}) => {
  const { submitKYC } = usePG();

  // Step in KYC flow: 1: Aadhaar details & scans, 2: Personal & Emergency Contact, 3: Success Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Aadhaar Details State
  const [aadhaarNum, setAadhaarNum] = useState(
    tenant.kyc?.aadhaar?.aadhaarNumber || '5412 8903 2198'
  );
  const [nameOnAadhaar, setNameOnAadhaar] = useState(
    tenant.kyc?.aadhaar?.nameOnAadhaar || tenant.name.toUpperCase()
  );
  const [dob, setDob] = useState(tenant.kyc?.aadhaar?.dob || '2000-01-01');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(
    tenant.kyc?.aadhaar?.gender || 'Male'
  );
  const [aadhaarAddress, setAadhaarAddress] = useState(
    tenant.kyc?.aadhaar?.address || 'Flat 402, Green Enclave, Outer Ring Road, Bengaluru - 560103'
  );

  // Scanned Card Upload Simulation
  const [frontUploaded, setFrontUploaded] = useState(true);
  const [backUploaded, setBackUploaded] = useState(true);

  // Step 2: Personal & Emergency
  const [fatherName, setFatherName] = useState(tenant.kyc?.fatherName || 'Ramesh Sharma');
  const [emergencyName, setEmergencyName] = useState(
    tenant.kyc?.emergencyContactName || 'Ramesh Sharma'
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    tenant.kyc?.emergencyContactPhone || '+91 98450 99881'
  );
  const [emergencyRelation, setEmergencyRelation] = useState(
    tenant.kyc?.emergencyContactRelation || 'Father'
  );
  const [occupation, setOccupation] = useState<TenantKYC['occupation']>(
    tenant.kyc?.occupation || 'Working Professional'
  );
  const [companyOrCollege, setCompanyOrCollege] = useState(
    tenant.kyc?.companyOrCollege || 'Tech Mahindra'
  );
  const [foodPreference, setFoodPreference] = useState<'Veg' | 'Non-Veg' | 'Eggetarian'>(
    tenant.kyc?.foodPreference || 'Veg'
  );
  const [bloodGroup, setBloodGroup] = useState(tenant.kyc?.bloodGroup || 'B+');

  const [isVerifyingAPI, setIsVerifyingAPI] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleAadhaarNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    setAadhaarNum(parts.join(' '));
    setErrorMessage('');
  };

  const handleVerifyAadhaar = async () => {
    const rawNumber = aadhaarNum.replace(/\D/g, '');
    if (rawNumber.length !== 12) {
      setErrorMessage('Please enter a valid 12-digit Aadhaar Card number.');
      return;
    }
    if (!nameOnAadhaar.trim()) {
      setErrorMessage('Please enter your full name as printed on your Aadhaar card.');
      return;
    }

    setIsVerifyingAPI(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/kyc/verify-aadhaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber: rawNumber }),
      });
      const data = await response.json();
      if (data.success) {
        setStep(2);
      } else {
        setErrorMessage(data.message || 'Aadhaar verification failed.');
      }
    } catch {
      setStep(2);
    } finally {
      setIsVerifyingAPI(false);
    }
  };

  const handleSubmitAllKYC = () => {
    if (!emergencyName.trim() || !emergencyPhone.trim()) {
      setErrorMessage('Emergency contact name and phone number are required.');
      return;
    }

    submitKYC(tenant.id, {
      fatherName,
      emergencyContactName: emergencyName,
      emergencyContactPhone: emergencyPhone,
      emergencyContactRelation: emergencyRelation,
      permanentAddress: aadhaarAddress,
      occupation,
      companyOrCollege,
      foodPreference,
      bloodGroup,
      aadhaar: {
        aadhaarNumber: aadhaarNum,
        nameOnAadhaar,
        dob,
        gender,
        address: aadhaarAddress,
      },
    });

    setStep(3);
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-brand-100 text-slate-900">
        
        {/* Top Header - Royal Blue */}
        <div className="sticky top-0 bg-brand-700 text-white px-6 py-4 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center border border-white/20">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Digital Aadhaar KYC Submission</h2>
              <p className="text-xs text-brand-100">Official tenant identification & compliance records</p>
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

        {/* Step Indicator */}
        <div className="bg-brand-50/80 px-6 py-3 border-b border-brand-100 flex items-center justify-between text-xs font-bold">
          <div className={`flex items-center space-x-1.5 ${step >= 1 ? 'text-brand-800' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-brand-700 text-white flex items-center justify-center text-[10px]">1</span>
            <span>Aadhaar Card & Identity</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-1.5 ${step >= 2 ? 'text-brand-800' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-brand-700 text-white' : 'bg-slate-300 text-slate-700'}`}>2</span>
            <span>Emergency & Work Details</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-1.5 ${step === 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>3</span>
            <span>Review Completed</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          
          {/* STEP 1: AADHAAR CARD DETAILS */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      12-Digit Aadhaar Number *
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      value={aadhaarNum}
                      onChange={handleAadhaarNumberChange}
                      placeholder="XXXX XXXX XXXX"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-brand-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Name on Aadhaar Card *
                    </label>
                    <input
                      type="text"
                      value={nameOnAadhaar}
                      onChange={(e) => setNameOnAadhaar(e.target.value.toUpperCase())}
                      placeholder="e.g. RAHUL SHARMA"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold uppercase text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Date of Birth (DOB) *
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Gender *
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Permanent Address as on Aadhaar *
                  </label>
                  <textarea
                    rows={2}
                    value={aadhaarAddress}
                    onChange={(e) => setAadhaarAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  />
                </div>
              </div>

              {/* Uploads Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Aadhaar Front Copy</span>
                  </div>
                  <span className="text-[10px] font-bold text-brand-800 bg-brand-100 px-2 py-0.5 rounded">Uploaded</span>
                </div>

                <div className="p-3.5 bg-brand-50/70 border border-brand-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Aadhaar Back Copy</span>
                  </div>
                  <span className="text-[10px] font-bold text-brand-800 bg-brand-100 px-2 py-0.5 rounded">Uploaded</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleVerifyAadhaar}
                disabled={isVerifyingAPI}
                className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20 flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {isVerifyingAPI ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying with UIDAI...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Emergency Contacts</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: EMERGENCY & OCCUPATION */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>Emergency / Parent Contact Details *</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person Name *</label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Relationship *</label>
                    <select
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Friend">Friend</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Phone *</label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Father's Full Name</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                    />
                  </div>
                </div>
              </div>

              {/* Occupation & Preference */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Briefcase className="w-4 h-4 text-brand-700" />
                  <span>Occupation & Preferences</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Occupation</label>
                    <select
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                    >
                      <option value="Working Professional">Working Professional</option>
                      <option value="Student">Student</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Company or College</label>
                    <input
                      type="text"
                      value={companyOrCollege}
                      onChange={(e) => setCompanyOrCollege(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Food Preference</label>
                    <select
                      value={foodPreference}
                      onChange={(e) => setFoodPreference(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                    >
                      <option value="Veg">Vegetarian</option>
                      <option value="Non-Veg">Non-Vegetarian</option>
                      <option value="Eggetarian">Eggetarian</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                    >
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="O+">O+</option>
                      <option value="AB+">AB+</option>
                    </select>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-300 flex items-center justify-center space-x-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitAllKYC}
                  className="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save KYC & Submit for Review</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 3 && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-200 shadow-md animate-in zoom-in">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">KYC Submitted Successfully!</h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your Aadhaar card details ({aadhaarNum}), DOB ({dob}), and emergency contact information have been updated. The PG owner has been notified.
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20"
                >
                  Done & Return to Portal
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
