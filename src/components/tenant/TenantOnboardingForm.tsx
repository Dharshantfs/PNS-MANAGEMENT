import React, { useState, useEffect } from 'react';
import { usePG } from '../../context/PGContext';
import { Tenant, TenantKYC } from '../../types';
import {
  ShieldCheck,
  CreditCard,
  Phone,
  User,
  Building,
  BedDouble,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Calendar,
  Sparkles,
  Home,
  Briefcase,
  HeartPulse,
  Utensils,
  MapPin,
  Lock,
  FileCheck2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { findTenantByPhone, getFirstProperty } from '../../services/firestoreService';
import { getSharingLabel } from '../../lib/roomLabels';

interface TenantOnboardingFormProps {
  tenantId?: string;
  onCompletedLogin: (tenant: Tenant) => void;
  onBackToLogin: () => void;
}

export const TenantOnboardingForm: React.FC<TenantOnboardingFormProps> = ({
  tenantId,
  onCompletedLogin,
  onBackToLogin,
}) => {
  const { tenants, submitKYC, settings, rooms, addTenant, activePropertyId, activeProperty, switchProperty } = usePG();

  // Find targeted tenant if exists
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenantId || '');
  const [phoneLookup, setPhoneLookup] = useState('');
  const [isSelfRegisterMode, setIsSelfRegisterMode] = useState(false);

  // This form is reachable via a public link before anyone is signed in, so
  // there's no property scope from auth yet. Resolve one from a `?property=`
  // link param, falling back to whichever property was created first (fine
  // for an owner running a single property).
  useEffect(() => {
    if (activePropertyId) return;
    const params = new URLSearchParams(window.location.search);
    const urlPropertyId = params.get('property');
    if (urlPropertyId) {
      switchProperty(urlPropertyId);
    } else {
      getFirstProperty().then((p) => {
        if (p) switchProperty(p.id);
      });
    }
  }, [activePropertyId, switchProperty]);

  // Look in existing tenants list
  const existingTenant = tenants.find((t) => t.id === selectedTenantId);

  // Step 1: Basic & Aadhaar Identity, Step 2: Emergency & Occupation, Step 3: Success Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // General & Stay Details
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [preferredRoomId, setPreferredRoomId] = useState('');

  // Aadhaar Form State
  const [aadhaarNum, setAadhaarNum] = useState('');
  const [nameOnAadhaar, setNameOnAadhaar] = useState('');
  const [dob, setDob] = useState('2000-01-01');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [aadhaarAddress, setAadhaarAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [stateName, setStateName] = useState('Karnataka');
  const [pincode, setPincode] = useState('560103');

  // Emergency & Family State
  const [fatherName, setFatherName] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Father');

  // Occupation & Preferences
  const [occupation, setOccupation] = useState<TenantKYC['occupation']>('Working Professional');
  const [companyOrCollege, setCompanyOrCollege] = useState('');
  const [foodPref, setFoodPref] = useState<'Veg' | 'Non-Veg' | 'Eggetarian'>('Veg');
  const [bloodGroup, setBloodGroup] = useState('B+');

  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTenantData, setCreatedTenantData] = useState<Tenant | null>(null);

  // Check URL query parameters for ?phone=XXXX or ?onboard=XXXX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPhone = params.get('phone');
      if (urlPhone) {
        setPhoneLookup(urlPhone);
        setMobileNumber(urlPhone);
        const match = tenants.find((t) => t.phone.replace(/\D/g, '').includes(urlPhone.replace(/\D/g, '')));
        if (match) {
          setSelectedTenantId(match.id);
        } else {
          setIsSelfRegisterMode(true);
        }
      }
    }
  }, [tenants]);

  // Sync state when existing tenant is loaded
  useEffect(() => {
    if (existingTenant) {
      setFullName(existingTenant.name);
      setMobileNumber(existingTenant.phone.replace(/\D/g, ''));
      setEmail(existingTenant.email || '');
      setNameOnAadhaar(existingTenant.kyc?.aadhaar?.nameOnAadhaar || existingTenant.name.toUpperCase());
      setAadhaarNum(existingTenant.kyc?.aadhaar?.aadhaarNumber || '');
      setDob(existingTenant.kyc?.aadhaar?.dob || '2000-05-15');
      setGender(existingTenant.kyc?.aadhaar?.gender || 'Male');
      setAadhaarAddress(
        existingTenant.kyc?.aadhaar?.address ||
        existingTenant.kyc?.permanentAddress ||
        '104, Green Park Residency, Outer Ring Road, Bengaluru'
      );
      setCity(existingTenant.kyc?.city || 'Bengaluru');
      setStateName(existingTenant.kyc?.state || 'Karnataka');
      setPincode(existingTenant.kyc?.pincode || '560103');
      setFatherName(existingTenant.kyc?.fatherName || '');
      setEmergencyName(existingTenant.kyc?.emergencyContactName || '');
      setEmergencyPhone(existingTenant.kyc?.emergencyContactPhone || '');
      setEmergencyRelation(existingTenant.kyc?.emergencyContactRelation || 'Father');
      setOccupation(existingTenant.kyc?.occupation || 'Working Professional');
      setCompanyOrCollege(existingTenant.kyc?.companyOrCollege || '');
      setFoodPref(existingTenant.kyc?.foodPreference || 'Veg');
      setBloodGroup(existingTenant.kyc?.bloodGroup || 'B+');
    }
  }, [existingTenant]);

  // Format Aadhaar with 4-digit spacing: XXXX XXXX XXXX
  const handleAadhaarChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    setAadhaarNum(parts.join(' '));
    setValidationError('');
  };

  const handleLookupPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneLookup.replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      setValidationError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setValidationError('');

    // Check context tenants
    const found = tenants.find((t) => t.phone.replace(/\D/g, '').includes(clean));
    if (found) {
      setSelectedTenantId(found.id);
      setIsSelfRegisterMode(false);
      return;
    }

    // Check Firestore directly (tenant may belong to this property but not yet
    // be loaded into local context, e.g. right after being invited)
    const serverMatch = await findTenantByPhone(clean);
    if (serverMatch) {
      setSelectedTenantId(serverMatch.id);
      setIsSelfRegisterMode(false);
      return;
    }

    // If not found, seamlessly enable self-registration
    setMobileNumber(clean);
    setIsSelfRegisterMode(true);
  };

  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAadhaar = aadhaarNum.replace(/\D/g, '');
    if (rawAadhaar.length !== 12) {
      setValidationError('Please enter a valid 12-digit Aadhaar Card number.');
      return;
    }
    if (!nameOnAadhaar.trim()) {
      setValidationError('Please enter your full name as printed on Aadhaar.');
      return;
    }
    if (isSelfRegisterMode && !fullName.trim()) {
      setValidationError('Please enter your full name.');
      return;
    }

    setValidationError('');
    setStep(2);
  };

  const handleSubmitFinalKYC = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emergencyName.trim() || !emergencyPhone.trim()) {
      setValidationError('Emergency contact name and phone number are required.');
      return;
    }

    setIsSubmitting(true);
    setValidationError('');

    const targetPhone = mobileNumber || phoneLookup || (existingTenant ? existingTenant.phone : '');
    const targetName = fullName || nameOnAadhaar || (existingTenant ? existingTenant.name : 'Resident');

    const kycPayload = {
      tenantId: existingTenant?.id,
      name: targetName,
      phone: targetPhone,
      email,
      roomId: preferredRoomId || existingTenant?.roomId,
      fatherName,
      emergencyContactName: emergencyName,
      emergencyContactPhone: emergencyPhone,
      emergencyContactRelation: emergencyRelation,
      permanentAddress: aadhaarAddress,
      city,
      state: stateName,
      pincode,
      occupation,
      companyOrCollege,
      foodPreference: foodPref,
      bloodGroup,
      aadhaar: {
        aadhaarNumber: aadhaarNum,
        nameOnAadhaar: nameOnAadhaar || targetName.toUpperCase(),
        dob,
        gender,
        address: aadhaarAddress,
      },
    };

    try {
      let targetId = existingTenant?.id;
      let allocatedRoom = existingTenant ? rooms.find((r) => r.id === existingTenant.roomId) : undefined;
      let allocatedBed = allocatedRoom?.beds.find((b) => b.id === existingTenant?.bedId);

      if (!targetId) {
        // Auto-allocate a vacant bed: preferred room first, then any vacant bed
        const preferredRoom = preferredRoomId ? rooms.find((r) => r.id === preferredRoomId) : undefined;
        const scanOrder = preferredRoom ? [preferredRoom, ...rooms.filter((r) => r.id !== preferredRoom.id)] : rooms;
        for (const r of scanOrder) {
          const vacant = r.beds.find((b) => b.status === 'vacant');
          if (vacant) {
            allocatedRoom = r;
            allocatedBed = vacant;
            break;
          }
        }
        targetId = addTenant({
          name: targetName,
          email,
          phone: targetPhone,
          hometown: `${city}, ${stateName}`,
          roomId: allocatedRoom?.id,
          bedId: allocatedBed?.id,
        });
      }

      // KYC always lands as 'pending' - even a fully self-reported submission
      // needs an owner glance before it's treated as verified.
      submitKYC(targetId, kycPayload as any);

      setCreatedTenantData({
        id: targetId,
        propertyId: activePropertyId || '',
        name: targetName,
        email,
        phone: targetPhone,
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        roomId: allocatedRoom?.id,
        roomNumber: allocatedRoom?.roomNumber,
        bedId: allocatedBed?.id,
        bedLabel: allocatedBed?.bedLabel,
        floor: allocatedRoom?.floor || 1,
        monthlyRent: allocatedBed?.pricePerMonth || allocatedRoom?.pricePerBed || existingTenant?.monthlyRent || 8000,
        securityDeposit: allocatedRoom?.securityDeposit || existingTenant?.securityDeposit || 15000,
        depositPaid: existingTenant?.depositPaid || false,
        checkInDate: existingTenant?.checkInDate || new Date().toISOString().split('T')[0],
        rentStatus: existingTenant?.rentStatus || 'due',
        dueAmount: existingTenant?.dueAmount ?? (allocatedBed?.pricePerMonth || allocatedRoom?.pricePerBed || 8000),
        hometown: `${city}, ${stateName}`,
        kyc: { ...(existingTenant?.kyc as TenantKYC), ...(kycPayload as any), status: 'pending' },
      });

      setStep(3);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch (err) {
      setValidationError('Something went wrong submitting your registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Screen 0: Initial Mobile Number Verification & Lookup Screen
  if (!existingTenant && !isSelfRegisterMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-brand-100 shadow-xl w-full max-w-md p-8 text-slate-900 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-brand-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-700/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Tenant Digital KYC & Admission</h1>
            <p className="text-xs text-slate-600">
              Enter your mobile number to complete your PNS PG registration, Aadhaar KYC, and emergency contact details.
            </p>
          </div>

          <form onSubmit={handleLookupPhone} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Your 10-Digit Mobile Number *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">+91</span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={phoneLookup}
                  onChange={(e) => {
                    setPhoneLookup(e.target.value);
                    setValidationError('');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                />
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20 flex items-center justify-center space-x-2"
            >
              <span>Continue to Digital KYC Form</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Direct Self-Registration Button */}
          <div className="pt-2 text-center border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={() => {
                setMobileNumber(phoneLookup || '9876543210');
                setIsSelfRegisterMode(true);
              }}
              className="text-xs text-brand-700 hover:text-brand-900 font-bold"
            >
              New Resident? Click here for Direct Public Admission Form →
            </button>

            <div>
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                ← Back to Login Screen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeTenantObj = createdTenantData || existingTenant;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex items-center justify-center">
      <div className="bg-white border border-brand-100 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-900">
        
        {/* Top Header - Royal Blue */}
        <div className="bg-brand-700 text-white px-8 py-6 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-200">
                PNS Luxury PG • Resident Onboarding
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-white">
                Digital KYC & Aadhaar Verification
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToLogin}
            className="text-xs text-brand-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
          >
            Exit to Login
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-brand-50/80 px-8 py-3.5 border-b border-brand-100 flex items-center justify-between text-xs font-bold">
          <div className={`flex items-center space-x-1.5 ${step >= 1 ? 'text-brand-800' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-brand-700 text-white flex items-center justify-center text-[10px]">1</span>
            <span>Aadhaar & Resident Profile</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-1.5 ${step >= 2 ? 'text-brand-800' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-brand-700 text-white' : 'bg-slate-300 text-slate-700'}`}>2</span>
            <span>Emergency & Occupation</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className={`flex items-center space-x-1.5 ${step === 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>3</span>
            <span>Admission Activated</span>
          </div>
        </div>

        {/* Status / Stay Banner */}
        <div className="px-8 pt-6">
          <div className="bg-gradient-to-r from-brand-50 via-white to-brand-50 border border-brand-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <BedDouble className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Hostel Accommodation Status:</p>
                <h3 className="text-sm font-bold text-slate-900">
                  {existingTenant?.roomNumber ? `Room ${existingTenant.roomNumber} (${existingTenant.bedLabel}) • Floor ${existingTenant.floor}` : 'Automated Room Allocation on Submit'}
                </h3>
                <p className="text-xs text-brand-800 font-semibold">
                  Phone: +91 {(mobileNumber || phoneLookup || existingTenant?.phone || '').replace(/\D/g, '')}
                </p>
              </div>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <span className="text-xs font-bold text-brand-900 bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200 inline-block">
                {existingTenant ? `₹${existingTenant.monthlyRent.toLocaleString('en-IN')} / month` : 'Standard PG Rent Plan'}
              </span>
            </div>
          </div>
        </div>

        {/* STEP 1: AADHAAR & BASIC PROFILE */}
        {step === 1 && (
          <form onSubmit={handleProceedToStep2} className="p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-brand-700" />
                <span>1. Personal Information & Government Aadhaar</span>
              </h2>
              <p className="text-xs text-slate-500">
                Government Aadhaar card details are required for local police verification and tenant safety compliance.
              </p>
            </div>

            {/* If Self-Registration, fill Name & Room Preference */}
            {(!existingTenant || isSelfRegisterMode) && (
              <div className="bg-brand-50/60 border border-brand-200 p-4 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Number (Used for Tenant Login) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-xs font-bold text-slate-500">+91</span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-12 pr-4 py-2 text-xs font-mono font-bold text-brand-900 focus:outline-none focus:border-brand-600 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. rahul@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Preferred Room / Bed Selection
                    </label>
                    <select
                      value={preferredRoomId}
                      onChange={(e) => setPreferredRoomId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                    >
                      <option value="">-- Auto Assign First Available Room --</option>
                      {rooms.map((r) => {
                        const vacantCount = r.beds.filter((b) => b.status === 'vacant').length;
                        return (
                          <option key={r.id} value={r.id}>
                            Room {r.roomNumber} ({getSharingLabel(activeProperty, r.sharingId)} • Floor {r.floor}) - {vacantCount} Vacant - ₹{r.pricePerBed}/mo
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Aadhaar Details Box */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    12-Digit Aadhaar Card Number *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="XXXX XXXX XXXX"
                    value={aadhaarNum}
                    onChange={(e) => handleAadhaarChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-brand-900 tracking-wider focus:outline-none focus:border-brand-600 shadow-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Example: 5412 8903 2198</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name as per Aadhaar *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RAHUL SHARMA"
                    value={nameOnAadhaar}
                    onChange={(e) => setNameOnAadhaar(e.target.value.toUpperCase())}
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
                    required
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
                  Permanent Address as per Aadhaar *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="House/Flat No, Street, Landmark, Area"
                  value={aadhaarAddress}
                  onChange={(e) => setAadhaarAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand-600 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Document upload simulation */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Scanned Aadhaar Card (Front & Back)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-brand-50/60 border border-brand-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Aadhaar Front Copy</p>
                      <p className="text-[10px] text-emerald-700 font-medium">aadhaar_front.jpg ready</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded font-bold">Attached</span>
                </div>

                <div className="p-3.5 bg-brand-50/60 border border-brand-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Aadhaar Back Copy</p>
                      <p className="text-[10px] text-emerald-700 font-medium">aadhaar_back.jpg ready</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded font-bold">Attached</span>
                </div>
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-brand-700/20 flex items-center justify-center space-x-2"
            >
              <span>Save Profile & Proceed to Emergency Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: EMERGENCY CONTACT & OCCUPATION */}
        {step === 2 && (
          <form onSubmit={handleSubmitFinalKYC} className="p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Phone className="w-5 h-5 text-brand-700" />
                <span>2. Emergency Contact & Employment Information</span>
              </h2>
              <p className="text-xs text-slate-500">
                Please provide your family contact and workplace or institution details.
              </p>
            </div>

            {/* Emergency Contact Block */}
            <div className="bg-rose-50/50 border border-rose-200 p-5 rounded-2xl space-y-3">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Phone className="w-4 h-4 text-rose-600" />
                <span>Primary Emergency / Parent Contact *</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
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
                    <option value="Sibling">Sibling / Brother / Sister</option>
                    <option value="Friend">Friend / Colleague</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9845099881"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-rose-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Father's / Guardian's Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Sharma"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                  />
                </div>
              </div>
            </div>

            {/* Occupation & Food Preferences */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Briefcase className="w-4 h-4 text-brand-700" />
                <span>Occupation & Resident Preferences</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Occupation Type *</label>
                  <select
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    <option value="Working Professional">Working Professional</option>
                    <option value="Student">College / University Student</option>
                    <option value="Self-Employed">Self-Employed / Business</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Company Name or College Institution *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Infosys, Tech Mahindra, RV College"
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
                    value={foodPref}
                    onChange={(e) => setFoodPref(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    <option value="Veg">Pure Vegetarian</option>
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
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-300 flex items-center justify-center space-x-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting KYC & Activating Stay...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit Digital KYC & Activate Account</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 3 && activeTenantObj && (
          <div className="p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-200 shadow-lg animate-in zoom-in">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                KYC Registration Successful
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                Welcome to PNS Luxury PG, {activeTenantObj.name}!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your Aadhaar card details ({aadhaarNum}), DOB ({dob}), emergency contact ({emergencyName} - {emergencyPhone}), and occupation records have been securely registered to your mobile number (+91 {activeTenantObj.phone.replace(/\D/g, '')}).
              </p>
            </div>

            {/* Account Information Card */}
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Allocated Stay:</span>
                <span className="font-bold text-slate-900">Room {activeTenantObj.roomNumber || 'Assigned'} ({activeTenantObj.bedLabel || 'Bed Assigned'}) • Floor {activeTenantObj.floor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Registered Phone:</span>
                <span className="font-mono font-bold text-brand-900">+91 {activeTenantObj.phone.replace(/\D/g, '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Monthly Rent:</span>
                <span className="font-bold text-emerald-700">₹{activeTenantObj.monthlyRent.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onCompletedLogin(activeTenantObj)}
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-brand-700/25 flex items-center justify-center space-x-2"
              >
                <span>Login to Tenant Portal Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-300"
              >
                Back to Login Screen
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
