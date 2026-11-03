import React, { useState, useEffect } from 'react';
import { floorLabel } from '../../lib/floors';
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
import { todayIST } from '../../services/firestoreService';
import { getSharingLabel } from '../../lib/roomLabels';
import { compressImage } from '../../lib/imageCompress';
import { sendPasswordSetupEmail } from '../../services/authService';
import { appCheckHeaders } from '../../lib/firebase';

// Vacant-room option for the public form (from GET /api/onboard/property/:id -
// no resident names).
interface PublicRoomOption {
  id: string;
  roomNumber: string;
  floor: number;
  sharingLabel: string;
  pricePerBed: number;
  vacant: number;
}

// The server's view of an invited tenant (POST /api/onboard/lookup) - no
// full Aadhaar number, no dues - shaped as a Tenant for the form.
const tenantFromInviteView = (v: any): Tenant =>
  ({
    id: v.id,
    propertyId: v.propertyId,
    name: v.name || '',
    email: v.email || '',
    phone: '',
    photoUrl: '',
    roomId: v.roomId || undefined,
    roomNumber: v.roomNumber || undefined,
    bedLabel: v.bedLabel || undefined,
    floor: v.floor || 1,
    monthlyRent: v.monthlyRent || 0,
    securityDeposit: v.securityDeposit || 0,
    depositPaid: false,
    checkInDate: v.checkInDate || '',
    rentStatus: 'due',
    dueAmount: 0,
    hometown: '',
    kyc: { ...(v.kyc || {}), aadhaar: { ...(v.kyc?.aadhaar || {}), aadhaarNumber: '' } },
  }) as Tenant;

const readParams = () =>
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

// The invite token is taken out of the address bar as soon as the page
// opens, so it doesn't stay in the browser history or get shared with a
// screenshot. It is kept for this tab only (a refresh still works).
const takeInviteToken = (tenantId?: string): string => {
  if (typeof window === 'undefined') return '';
  const key = `pg-invite:${tenantId || ''}`;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('t') || '';
  try {
    if (fromUrl) sessionStorage.setItem(key, fromUrl);
  } catch {
    /* storage blocked - the token still works for this page view */
  }
  if (fromUrl && window.history.replaceState) {
    params.delete('t');
    const qs = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

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
  const { tenants, submitKYC, settings, rooms, activePropertyId, activeProperty, authUser } = usePG();

  // Find targeted tenant if exists
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenantId || '');
  const [phoneLookup, setPhoneLookup] = useState('');
  const [isSelfRegisterMode, setIsSelfRegisterMode] = useState(false);
  // A visitor opening the invite link isn't signed in, so the property's
  // tenant list (`tenants` from context) can't load for them - firestore.rules
  // only allow reading one tenant doc at a time. The tenant found by the
  // link's id or by phone lookup is kept here instead.
  const [fetchedTenant, setFetchedTenant] = useState<Tenant | null>(null);

  // Secret part of the invite link (?onboard=<id>&t=<token>). A visitor who
  // self-registers gets one back from the server for their new record.
  const [inviteToken, setInviteToken] = useState(() => takeInviteToken(tenantId));
  const [linkError, setLinkError] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [publicProperty, setPublicProperty] = useState<{ id: string; name: string } | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomOption[]>([]);

  // Invite link: the server checks the token and returns only what the form
  // needs. Owner/staff opening the form for a tenant use their own data.
  useEffect(() => {
    if (!tenantId) return;
    if (authUser && tenants.some((t) => t.id === tenantId)) return;
    if (authUser && !inviteToken) return; // owner view - tenants are still loading
    appCheckHeaders()
      .then((check) =>
        fetch('/api/onboard/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...check },
          body: JSON.stringify({ tenantId, token: inviteToken }),
        })
      )
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setLinkError(data.error || 'This link is not valid any more - ask the PG office for a new one.');
          return;
        }
        setFetchedTenant(tenantFromInviteView(data.tenant));
        setPhoneLast4(data.tenant.phoneLast4 || '');
        setPublicProperty(data.property);
      })
      .catch(() => setLinkError('Could not open this link - check your internet connection and try again.'));
  }, [tenantId, authUser, tenants.length]);

  // Self-registration: the PG (from ?property=<id>, the signed-in owner's
  // property, or the default PG) and its vacant rooms - from the server.
  useEffect(() => {
    if (tenantId) return;
    const pid = readParams().get('property') || activePropertyId || 'default';
    appCheckHeaders()
      .then((check) => fetch(`/api/onboard/property/${encodeURIComponent(pid)}`, { headers: check }))
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;
        setPublicProperty(data.property);
        setPublicRooms(data.rooms || []);
      })
      .catch((e) => console.warn('PG details could not be loaded', e));
  }, [tenantId, activePropertyId]);

  const propertyName = publicProperty?.name || activeProperty?.name || settings.pgName;

  // Look in existing tenants list
  const existingTenant =
    tenants.find((t) => t.id === selectedTenantId) ||
    (fetchedTenant && fetchedTenant.id === selectedTenantId ? fetchedTenant : undefined);
  // Last 4 digits of the Aadhaar number already on file (blank field = keep it).
  const onFileLast4 = existingTenant?.kyc?.aadhaar?.aadhaarLast4 || '';

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
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [aadhaarAddress, setAadhaarAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

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

  // Aadhaar copies as compressed JPEG data URLs (see lib/imageCompress.ts),
  // uploaded after the KYC details are saved.
  const [frontDoc, setFrontDoc] = useState('');
  const [backDoc, setBackDoc] = useState('');
  const [docBusy, setDocBusy] = useState<'' | 'front' | 'back'>('');

  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTenantData, setCreatedTenantData] = useState<Tenant | null>(null);
  // Tenant portal login outcome, shown on the success screen.
  const [loginNote, setLoginNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Check URL query parameters for ?phone=XXXX or ?onboard=XXXX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPhone = params.get('phone');
      if (urlPhone) {
        setPhoneLookup(urlPhone);
        setMobileNumber(urlPhone);
        const want = urlPhone.replace(/\D/g, '').slice(-10);
        const match = tenants.find((t) => t.phone.replace(/\D/g, '').slice(-10) === want);
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
      const generated = `${existingTenant.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
      setEmail(existingTenant.email && existingTenant.email !== generated ? existingTenant.email : '');
      setNameOnAadhaar(existingTenant.kyc?.aadhaar?.nameOnAadhaar || '');
      // The full number is never sent back to the browser - it is typed again.
      setAadhaarNum('');
      setDob(existingTenant.kyc?.aadhaar?.dob || '');
      setGender(existingTenant.kyc?.aadhaar?.gender || '');
      setAadhaarAddress(existingTenant.kyc?.aadhaar?.address || existingTenant.kyc?.permanentAddress || '');
      setCity(existingTenant.kyc?.city || '');
      setStateName(existingTenant.kyc?.state || '');
      setPincode(existingTenant.kyc?.pincode || '');
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

    // Owner/staff filling the form: find the resident in their own list.
    const found = authUser ? tenants.find((t) => t.phone.replace(/\D/g, '').slice(-10) === clean.slice(-10)) : undefined;
    if (found) {
      setSelectedTenantId(found.id);
      setIsSelfRegisterMode(false);
      return;
    }

    // Anyone else registers as a new resident. A number that is already
    // registered is refused by the server - existing residents must use the
    // private KYC link the PG office sent them (a phone number alone is not
    // proof of identity).
    setMobileNumber(clean);
    setIsSelfRegisterMode(true);
  };

  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAadhaar = aadhaarNum.replace(/\D/g, '');
    // Blank = keep the number already on file (it is never sent back to the browser).
    if (!(rawAadhaar.length === 0 && onFileLast4) && rawAadhaar.length !== 12) {
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setValidationError('Please enter a valid email - your Tenant Portal login is sent there.');
      return;
    }
    if (!dob) {
      setValidationError('Please enter your date of birth.');
      return;
    }
    if (!gender) {
      setValidationError('Please select your gender.');
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setValidationError('Please enter a valid 6-digit pincode.');
      return;
    }
    const alreadyUploaded = !!existingTenant?.kyc?.aadhaar?.frontImageUrl && !!existingTenant?.kyc?.aadhaar?.backImageUrl;
    if (!alreadyUploaded && (!frontDoc || !backDoc)) {
      setValidationError('Please attach photos of both the front and back of your Aadhaar card.');
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
      let token = inviteToken;
      let stay = {
        roomId: existingTenant?.roomId,
        roomNumber: existingTenant?.roomNumber,
        bedLabel: existingTenant?.bedLabel,
        floor: existingTenant?.floor || 1,
        monthlyRent: existingTenant?.monthlyRent || 0,
      };

      const postJson = async (url: string, body: any) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await appCheckHeaders()) };
        if (authUser) headers.Authorization = `Bearer ${await authUser.getIdToken()}`;
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed - please try again.');
        return data;
      };

      // KYC always lands as 'pending' - even a fully self-reported submission
      // needs an owner glance before it's treated as verified.
      if (!targetId) {
        // New resident: the server creates the record with the KYC (api/_lib/
        // app.ts POST /api/onboard/submit). A signed-out visitor gets no bed
        // yet - the PG office assigns one - and receives the new record's
        // invite token for the photo upload and login below.
        const data = await postJson('/api/onboard/submit', {
          ...kycPayload,
          propertyId: publicProperty?.id || activePropertyId,
          roomId: preferredRoomId || undefined,
          permanentAddress: aadhaarAddress,
        });
        targetId = data.tenant.id as string;
        token = data.inviteToken || '';
        setInviteToken(token);
        // If the photo upload below fails, a retry must update this tenant,
        // not create a second one.
        setFetchedTenant(tenantFromInviteView(data.tenant));
        setSelectedTenantId(data.tenant.id);
        stay = {
          roomId: data.tenant.roomId || undefined,
          roomNumber: data.tenant.roomNumber || undefined,
          bedLabel: data.tenant.bedLabel || undefined,
          floor: data.tenant.floor || 1,
          monthlyRent: data.tenant.monthlyRent || 0,
        };
      } else if (!authUser) {
        // Invited tenant on their own phone: the server checks the link's
        // token and saves the KYC (POST /api/onboard/kyc).
        await postJson('/api/onboard/kyc', { tenantId: targetId, token, kyc: kycPayload });
      } else {
        // Only the KYC fields - not the form's name/phone/room helpers.
        const { tenantId: _id, name: _n, phone: _p, email: _e, roomId: _r, ...kycOnly } = kycPayload;
        await submitKYC(targetId, kycOnly as any);
      }

      if (frontDoc || backDoc) {
        try {
          await postJson('/api/onboard/kyc-docs', {
            tenantId: targetId,
            token,
            front: frontDoc || undefined,
            back: backDoc || undefined,
          });
        } catch (docErr: any) {
          throw new Error(`Your details were saved, but the Aadhaar photos did not upload (${docErr.message}). Please submit again.`);
        }
      }

      // Tenant portal login (free - no SMS): the server creates it, then
      // Firebase emails a "set your password" link. A failure here must not
      // undo the saved KYC, so it's reported on the success screen instead.
      try {
        const login = await postJson('/api/onboard/tenant-login', {
          tenantId: targetId,
          token,
          email: email.trim(),
        });
        if (login.existing) {
          setLoginNote({ ok: true, text: `You already have a Tenant Portal login (${login.email}). Use "Forgot password?" on the login screen if you need a new password.` });
        } else {
          await sendPasswordSetupEmail(login.email);
          setLoginNote({ ok: true, text: `We've emailed ${login.email} a link to set your password (check Spam too). Then log in on the Tenant Portal with this email.` });
        }
      } catch (loginErr: any) {
        setLoginNote({ ok: false, text: `Your KYC is saved, but your login could not be set up: ${loginErr.message} Please contact the PG office.` });
      }

      setCreatedTenantData({
        id: targetId,
        propertyId: publicProperty?.id || activePropertyId || '',
        name: targetName,
        email,
        phone: targetPhone,
        photoUrl: '', // no photo yet - TenantAvatar shows initials
        roomId: stay.roomId,
        roomNumber: stay.roomNumber,
        bedLabel: stay.bedLabel,
        floor: stay.floor,
        monthlyRent: stay.monthlyRent,
        securityDeposit: existingTenant?.securityDeposit || 0,
        depositPaid: existingTenant?.depositPaid || false,
        checkInDate: existingTenant?.checkInDate || todayIST(),
        rentStatus: existingTenant?.rentStatus || 'due',
        dueAmount: existingTenant?.dueAmount ?? 0,
        hometown: `${city}, ${stateName}`,
        kyc: { ...(existingTenant?.kyc as TenantKYC), ...(kycPayload as any), status: 'pending' },
      });

      setStep(3);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch (err: any) {
      setValidationError(err?.message || 'Something went wrong submitting your registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const maskedPhone = phoneLast4 ? `XXXXXX${phoneLast4}` : '';
  const displayPhone = (mobileNumber || phoneLookup || existingTenant?.phone || '').replace(/\D/g, '').slice(-10) || maskedPhone;

  // Invite link that the server refused (expired / old link without token).
  if (tenantId && linkError && !existingTenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-brand-100 shadow-xl w-full max-w-md p-8 text-slate-900 space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-bold">This KYC link can't be opened</h1>
          <p className="text-xs text-slate-600">{linkError}</p>
          <button
            type="button"
            onClick={onBackToLogin}
            className="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Invite link still loading.
  if (tenantId && !existingTenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

        {/* Admin/staff session in this browser: the success buttons below lead
            back to the admin dashboard, not the tenant portal - say so up front. */}
        {authUser?.email && (
          <div className="px-8 pt-6">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
              You're signed in as admin ({authUser.email}) in this browser, so after submitting you'll return to the
              admin dashboard. Tenants should open this link on their own phone. To test it as a tenant, use an
              incognito/private window.
            </div>
          </div>
        )}

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
                  {existingTenant?.roomNumber
                    ? `Room ${existingTenant.roomNumber} (${existingTenant.bedLabel}) • ${floorLabel(existingTenant.floor)}`
                    : authUser
                      ? 'Bed assigned from the Bed Matrix'
                      : 'The PG office will assign your bed after you register'}
                </h3>
                <p className="text-xs text-brand-800 font-semibold">
                  Phone: +91 {displayPhone}
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
                      Email (login details are sent here) *
                    </label>
                    <input
                      type="email"
                      required
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
                      <option value="">{authUser ? '-- Auto-assign first vacant bed --' : '-- No preference --'}</option>
                      {authUser && rooms.length > 0
                        ? rooms.map((r) => {
                            const vacantCount = r.beds.filter((b) => b.status === 'vacant').length;
                            return (
                              <option key={r.id} value={r.id}>
                                Room {r.roomNumber} ({getSharingLabel(activeProperty, r.sharingId)} • {floorLabel(r.floor)}) - {vacantCount} Vacant - ₹{r.pricePerBed}/mo
                              </option>
                            );
                          })
                        : publicRooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              Room {r.roomNumber} ({r.sharingLabel || 'Room'} • {floorLabel(r.floor)}) - {r.vacant} Vacant - ₹{r.pricePerBed}/mo
                            </option>
                          ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {existingTenant && !isSelfRegisterMode && (
              <div className="bg-brand-50/60 border border-brand-200 p-4 rounded-2xl">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Your Email (login details are sent here) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  After you submit, we email you a link to set your Tenant Portal password.
                </p>
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
                    placeholder={onFileLast4 ? `Leave blank to keep XXXX XXXX ${onFileLast4}` : 'XXXX XXXX XXXX'}
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
                    <option value="" disabled>Select</option>
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

            {/* Aadhaar photos - compressed in the browser, uploaded on submit */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Aadhaar Card Photos (Front & Back) *
              </label>
              {existingTenant?.kyc?.aadhaar?.frontImageUrl && existingTenant?.kyc?.aadhaar?.backImageUrl && (
                <p className="text-[11px] text-emerald-700">Already uploaded earlier - attach new photos only to replace them.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['front', 'back'] as const).map((side) => {
                  const value = side === 'front' ? frontDoc : backDoc;
                  const setValue = side === 'front' ? setFrontDoc : setBackDoc;
                  return (
                    <label
                      key={side}
                      className={`p-3.5 border rounded-xl flex items-center justify-between cursor-pointer transition ${
                        value ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-dashed border-slate-300 hover:border-brand-500'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {value ? (
                          <img src={value} alt={`Aadhaar ${side}`} className="w-12 h-8 object-cover rounded border border-emerald-200 shrink-0" />
                        ) : (
                          <Upload className="w-4 h-4 text-brand-700 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">Aadhaar {side === 'front' ? 'Front' : 'Back'}</p>
                          <p className="text-[10px] text-slate-500">
                            {docBusy === side ? 'Processing...' : value ? 'Attached - tap to change' : 'Tap to take or choose a photo'}
                          </p>
                        </div>
                      </div>
                      {value && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          setDocBusy(side);
                          setValidationError('');
                          try {
                            setValue(await compressImage(file));
                          } catch (err: any) {
                            setValidationError(err?.message || 'Could not use that photo.');
                          } finally {
                            setDocBusy('');
                          }
                        }}
                      />
                    </label>
                  );
                })}
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
                Welcome to {propertyName || 'the PG'}, {activeTenantObj.name}!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your Aadhaar details (ending {aadhaarNum.replace(/\D/g, '').slice(-4) || onFileLast4}), date of birth, emergency contact ({emergencyName}) and occupation have been submitted for the PG office to review.
              </p>
            </div>

            {loginNote && (
              <div
                className={`max-w-md mx-auto p-3 rounded-xl border text-xs text-left ${
                  loginNote.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {loginNote.text}
              </div>
            )}

            {/* Account Information Card */}
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Allocated Stay:</span>
                <span className="font-bold text-slate-900">
                  {activeTenantObj.roomNumber
                    ? `Room ${activeTenantObj.roomNumber} (${activeTenantObj.bedLabel || 'Bed'}) • ${floorLabel(activeTenantObj.floor)}`
                    : 'To be assigned by the PG office'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Registered Phone:</span>
                <span className="font-mono font-bold text-brand-900">+91 {displayPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Monthly Rent:</span>
                <span className="font-bold text-emerald-700">
                  {activeTenantObj.monthlyRent > 0 ? `₹${activeTenantObj.monthlyRent.toLocaleString('en-IN')}` : 'Set by the PG office'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onCompletedLogin(activeTenantObj)}
                className="w-full sm:w-auto px-8 py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-brand-700/25 flex items-center justify-center space-x-2"
              >
                <span>{authUser?.email ? 'Back to Admin Dashboard' : 'Login to Tenant Portal Now'}</span>
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
