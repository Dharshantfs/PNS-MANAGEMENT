import React, { useState, useEffect } from 'react';
import { usePG } from '../../context/PGContext';
import {
  FileText,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Send,
  Code2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Users,
  ShieldCheck,
  Download,
  UploadCloud,
  Layers,
  Phone,
  RefreshCw,
  PlusCircle,
  Globe,
  QrCode,
  FolderOpen,
  UserCheck,
  CheckCircle2,
  Trash2,
  LogIn,
  LogOut,
  Sliders,
  BedDouble,
  FileCheck2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import {
  googleSignIn,
  googleLogout,
  getCurrentGoogleUser,
  getAccessToken,
  initAuth,
} from '../../services/googleAuthService';
import { getSharingLabel } from '../../lib/roomLabels';
import {
  listGoogleForms,
  getGoogleForm,
  createPNSAdmissionForm,
  getGoogleFormResponses,
  GoogleFormInfo,
  GoogleFormResponseItem,
} from '../../services/googleFormsService';

export const GoogleFormsIntegration: React.FC = () => {
  const { rooms, tenants, addTenant, settings, activePropertyId, activeProperty, refreshStateFromServer } = usePG();

  // Google OAuth State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Tab inside Google Forms Hub
  const [activeSubTab, setActiveSubTab] = useState<'api_sync' | 'create_form' | 'drive_forms' | 'webhook_script' | 'simulator'>('api_sync');

  // Drive Forms & Active Form
  const [driveForms, setDriveForms] = useState<Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>>([]);
  const [isLoadingDriveForms, setIsLoadingDriveForms] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [activeFormDetails, setActiveFormDetails] = useState<GoogleFormInfo | null>(null);
  const [customFormInput, setCustomFormInput] = useState<string>('');

  // Responses
  const [formResponses, setFormResponses] = useState<GoogleFormResponseItem[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Admission Modal State
  const [admittingResponse, setAdmittingResponse] = useState<GoogleFormResponseItem | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [isSubmittingAdmission, setIsSubmittingAdmission] = useState(false);

  // Creation Modal Confirmation
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [createFormConfirmOpen, setCreateFormConfirmOpen] = useState(false);
  const [createdFormResult, setCreatedFormResult] = useState<{ formId: string; responderUri: string; editUrl: string } | null>(null);

  // Copy states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Simulator State
  const [simName, setSimName] = useState('Ankit Verma');
  const [simPhone, setSimPhone] = useState('9126596803');
  const [simAadhaar, setSimAadhaar] = useState('6543 2109 8765');
  const [simDob, setSimDob] = useState('1998-08-20');
  const [simGender, setSimGender] = useState('Male');
  const [simEmergencyName, setSimEmergencyName] = useState('Suresh Verma (Father)');
  const [simEmergencyPhone, setSimEmergencyPhone] = useState('9876501234');
  const [simOccupation, setSimOccupation] = useState('Software Engineer');
  const [simCompany, setSimCompany] = useState('Flipkart');
  const [simFoodPref, setSimFoodPref] = useState('Veg');
  const [simRoomType, setSimRoomType] = useState('2-Sharing');
  const [isSubmittingSim, setIsSubmittingSim] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; message: string; tenant?: any } | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookEndpoint = `${origin}/api/webhook/google-form`;

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // When token is available, automatically load forms from Drive
  useEffect(() => {
    if (accessToken) {
      handleLoadDriveForms();
    }
  }, [accessToken]);

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      console.warn('Google Sign-in notice:', err);
      setAuthError(err.message || 'Google Sign-In could not be completed. You can use the Webhook or Simulator instead.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    setAccessToken(null);
    setDriveForms([]);
    setActiveFormDetails(null);
    setFormResponses([]);
  };

  // Load Google Forms from user's Drive
  const handleLoadDriveForms = async () => {
    if (!accessToken) return;
    setIsLoadingDriveForms(true);
    try {
      const forms = await listGoogleForms(accessToken);
      setDriveForms(forms);
      if (forms.length > 0 && !selectedFormId) {
        setSelectedFormId(forms[0].id);
        handleSelectForm(forms[0].id);
      }
    } catch (err: any) {
      console.error('Failed to list Google Forms:', err);
    } finally {
      setIsLoadingDriveForms(false);
    }
  };

  // Select a form and load structure + responses
  const handleSelectForm = async (formId: string) => {
    if (!accessToken || !formId) return;
    setSelectedFormId(formId);
    setIsLoadingResponses(true);
    setResponseError(null);
    try {
      const formInfo = await getGoogleForm(formId, accessToken);
      setActiveFormDetails(formInfo);

      const responses = await getGoogleFormResponses(formId, accessToken);
      setFormResponses(responses);
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Failed to fetch form responses:', err);
      setResponseError(err.message || 'Failed to load Google Form. Please check permissions.');
    } finally {
      setIsLoadingResponses(false);
    }
  };

  // Create new official Admission Form
  const handleCreateOfficialForm = async () => {
    if (!accessToken) return;
    setIsCreatingForm(true);
    setCreateFormConfirmOpen(false);
    try {
      const result = await createPNSAdmissionForm(accessToken, settings.pgName || 'PNS Luxury PG');
      setCreatedFormResult(result);
      setSelectedFormId(result.formId);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      // Refresh drive forms list
      await handleLoadDriveForms();
      // Load the newly created form
      await handleSelectForm(result.formId);
      setActiveSubTab('api_sync');
    } catch (err: any) {
      alert(`Error creating Google Form: ${err.message}`);
    } finally {
      setIsCreatingForm(false);
    }
  };

  // Execute Tenant Admission from Google Form Response
  const handleAdmitTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admittingResponse) return;
    setIsSubmittingAdmission(true);

    const ext = admittingResponse.extracted;
    let targetRoom = null;
    let targetBed = null;

    if (selectedBedId) {
      for (const room of rooms) {
        const bed = room.beds.find((b) => b.id === selectedBedId);
        if (bed) {
          targetRoom = room;
          targetBed = bed;
          break;
        }
      }
    }

    try {
      const res = await fetch('/api/onboard/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: activePropertyId,
          name: ext.fullName,
          phone: ext.phone,
          nameOnAadhaar: ext.fullName.toUpperCase(),
          aadhaarNumber: ext.aadhaarNumber,
          dob: ext.dob,
          gender: ext.gender,
          roomId: targetRoom?.id,
          roomNumber: targetRoom?.roomNumber,
          bedId: targetBed?.id,
          bedLabel: targetBed?.bedLabel,
          floor: targetRoom?.floor,
          monthlyRent: targetBed?.pricePerMonth || targetRoom?.pricePerBed || 8500,
          securityDeposit: targetRoom?.securityDeposit || 15000,
          emergencyName: ext.emergencyContactName,
          emergencyPhone: ext.emergencyContactPhone,
          occupation: ext.occupation,
          foodPref: ext.foodPreference,
          permanentAddress: ext.permanentAddress,
          city: ext.city,
        }),
      });

      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        setAdmittingResponse(null);
        setSelectedBedId('');
        await refreshStateFromServer();
      } else {
        alert(data.message || 'Failed to admit tenant.');
      }
    } catch (err: any) {
      alert(`Error admitting tenant: ${err.message}`);
    } finally {
      setIsSubmittingAdmission(false);
    }
  };

  // Auto-Sync all responses into PG
  const handleBatchSyncAll = async () => {
    if (!formResponses.length) return;
    const confirmSync = window.confirm(
      `Synchronize all ${formResponses.length} Google Form responses into PNS PG Bed Matrix? This will automatically admit applicants into available vacant beds.`
    );
    if (!confirmSync) return;

    setIsLoadingResponses(true);
    try {
      const rows = formResponses.map((r) => ({
        name: r.extracted.fullName,
        phone: r.extracted.phone,
        aadhaar: r.extracted.aadhaarNumber,
        dob: r.extracted.dob,
        gender: r.extracted.gender,
        emergencyContactName: r.extracted.emergencyContactName,
        emergencyContactPhone: r.extracted.emergencyContactPhone,
        occupation: r.extracted.occupation,
        food: r.extracted.foodPreference,
        address: r.extracted.permanentAddress,
        city: r.extracted.city,
      }));

      const res = await fetch('/api/import/google-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, propertyId: activePropertyId }),
      });

      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
        await refreshStateFromServer();
        alert(data.message || 'Google Form responses synchronized successfully!');
      } else {
        alert(data.message || 'Failed to sync responses.');
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsLoadingResponses(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2500);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const appsScriptCode = `// --- GOOGLE APPS SCRIPT FOR AUTOMATIC GOOGLE FORMS INTEGRATION ---
// 1. In your Google Form, click the 3 dots (top right) -> 'Script editor'
// 2. Paste this code into Code.gs
// 3. Click 'Triggers' (clock icon on left) -> 'Add Trigger'
//    - Choose which function to run: onFormSubmit
//    - Select event source: From form
//    - Select event type: On form submit
// 4. Save and authorize!

function onFormSubmit(e) {
  var WEBHOOK_URL = "${webhookEndpoint}";
  
  var formResponse = e.response;
  var itemResponses = formResponse.getItemResponses();
  
  var payload = {
    formTimestamp: new Date().toISOString()
  };
  
  for (var i = 0; i < itemResponses.length; i++) {
    var title = itemResponses[i].getItem().getTitle();
    var response = itemResponses[i].getResponse();
    payload[title] = response;
  }
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var res = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("PNS PG sync response: " + res.getContentText());
  } catch (err) {
    Logger.log("Error sending to PNS PG: " + err);
  }
}`;

  const handleSimulateGoogleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSim(true);
    setSimResult(null);

    const payload = {
      propertyId: activePropertyId,
      'Full Name': simName,
      'Mobile Number': simPhone,
      'Aadhaar Number': simAadhaar,
      'Date of Birth': simDob,
      'Gender': simGender,
      'Emergency Contact Name': simEmergencyName,
      'Emergency Contact Phone': simEmergencyPhone,
      'Occupation': simOccupation,
      'Company or College': simCompany,
      'Food Preference': simFoodPref,
      'Room Type Preference': simRoomType,
      'Permanent Address': '104, Green Park Avenue, Bengaluru',
      'City': 'Bengaluru',
      'State': 'Karnataka',
      'Pincode': '560103',
    };

    try {
      const res = await fetch('/api/webhook/google-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSimResult({
          success: true,
          message: data.message || `Successfully registered ${simName} into PG Bed Matrix!`,
          tenant: data.tenant,
        });
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        await refreshStateFromServer();
      } else {
        setSimResult({
          success: false,
          message: data.error || 'Failed to process Google Form submission.',
        });
      }
    } catch {
      setSimResult({
        success: false,
        message: 'Network error communicating with Google Form webhook API.',
      });
    } finally {
      setIsSubmittingSim(false);
    }
  };

  // Find vacant beds for assignment
  const vacantBeds: Array<{ id: string; label: string; roomNumber: string; price: number; type: string }> = [];
  rooms.forEach((room) => {
    room.beds.forEach((bed) => {
      if (bed.status === 'vacant') {
        vacantBeds.push({
          id: bed.id,
          label: `${bed.roomNumber} - ${bed.bedLabel} (₹${bed.pricePerMonth || room.pricePerBed}/mo, ${getSharingLabel(activeProperty, room.sharingId)})`,
          roomNumber: room.roomNumber,
          price: bed.pricePerMonth || room.pricePerBed,
          type: getSharingLabel(activeProperty, room.sharingId),
        });
      }
    });
  });

  const publicResponderUrl =
    activeFormDetails?.responderUri ||
    (selectedFormId ? `https://docs.google.com/forms/d/e/${selectedFormId}/viewform` : '');

  return (
    <div className="space-y-6 animate-in fade-in text-slate-900 font-sans">
      
      {/* Top Banner / Integration Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-blue-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/25 text-blue-100 text-xs font-bold flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Google Forms API & Workspace Integration</span>
            </span>
            <span className="text-xs text-blue-200">Official PG Admission Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-2 tracking-tight">
            Google Forms Management Hub
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl leading-relaxed">
            Create official admission forms directly in your Google Drive, pull live KYC submissions via the Google Forms API, and allocate vacant PG beds with 1 click!
          </p>
        </div>

        {/* Google OAuth Connection Status Card */}
        <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center shrink-0 w-full sm:w-auto min-w-[240px]">
          {accessToken && googleUser ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <img
                  src={googleUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={googleUser.displayName || 'Google User'}
                  className="w-8 h-8 rounded-full border border-white/40 object-cover"
                />
                <div className="text-left">
                  <p className="text-xs font-bold text-white leading-tight">{googleUser.displayName || 'Connected Account'}</p>
                  <p className="text-[10px] text-blue-200 truncate max-w-[140px]">{googleUser.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2 pt-1 border-t border-white/15">
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Google Forms Connected</span>
                </span>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="text-[10px] text-blue-200 hover:text-white underline font-semibold"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-blue-100 font-medium">Connect Google Account</p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="w-full py-2 px-3.5 bg-white hover:bg-slate-50 text-blue-900 font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center space-x-2"
              >
                {isAuthenticating ? (
                  <div className="w-3.5 h-3.5 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-blue-700" />
                    <span>Sign In with Google</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-blue-200">Grants Forms & Drive API permissions</p>
            </div>
          )}
        </div>
      </div>

      {authError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{authError}</span>
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
          >
            Retry Login
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('api_sync')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'api_sync'
              ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Live Form Responses & Bed Allocator</span>
          {formResponses.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-400 text-blue-950 ml-1">
              {formResponses.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('create_form')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'create_form'
              ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>1-Click Create Official PG Form</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('drive_forms')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'drive_forms'
              ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Pick Google Forms from Drive</span>
          {driveForms.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 ml-1">
              {driveForms.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('webhook_script')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'webhook_script'
              ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Google Apps Script & Webhook</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('simulator')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'simulator'
              ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Form Submission Simulator</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: Live API Responses & Bed Allocator */}
      {/* ========================================================================= */}
      {activeSubTab === 'api_sync' && (
        <div className="space-y-6">
          
          {/* Active Form Selector Header */}
          <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  {activeFormDetails?.title || (selectedFormId ? `Google Form (${selectedFormId.slice(0, 10)}...)` : 'No Google Form Selected')}
                </h2>
                {activeFormDetails && (
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    {activeFormDetails.questions.length} KYC Fields Loaded
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {lastSyncedAt ? `Last synchronized via Google Forms API at ${lastSyncedAt}` : 'Synchronize live applicants who filled your admission form'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {publicResponderUrl && (
                <a
                  href={publicResponderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span>Open Public Form</span>
                </a>
              )}

              {accessToken ? (
                <button
                  type="button"
                  onClick={() => selectedFormId && handleSelectForm(selectedFormId)}
                  disabled={isLoadingResponses || !selectedFormId}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-md shadow-blue-700/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingResponses ? 'animate-spin' : ''}`} />
                  <span>{isLoadingResponses ? 'Syncing Responses...' : 'Sync Live Responses'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign in to Fetch Responses</span>
                </button>
              )}

              {formResponses.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchSyncAll}
                  disabled={isLoadingResponses}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Auto-Admit All ({formResponses.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Link & QR Code Quick Share Drawer */}
          {publicResponderUrl && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-white rounded-2xl border border-blue-200 shadow-sm shrink-0">
                  <QRCodeSVG value={publicResponderUrl} size={64} level="M" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Public Google Form Admission Link
                  </p>
                  <p className="text-xs text-slate-600 font-mono break-all max-w-xl">
                    {publicResponderUrl}
                  </p>
                  <p className="text-[11px] text-blue-700 font-medium">
                    Share this link with prospective tenants to collect Aadhaar, phone, and KYC details.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyLink(publicResponderUrl)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Form Link'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {responseError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Google Forms API Notice</p>
                <p className="mt-0.5">{responseError}</p>
                <p className="mt-1 text-[11px] text-amber-800">
                  Ensure the form is owned by your Google account, or create a fresh official PG admission form with 1 click using the "Create Form" tab.
                </p>
              </div>
            </div>
          )}

          {/* Responses Table / List */}
          <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  Live Form Submissions & Applicants ({formResponses.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {vacantBeds.length} Vacant Beds Available in Matrix
              </span>
            </div>

            {formResponses.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 mx-auto flex items-center justify-center border border-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-900">No Responses Found Yet</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Either no one has filled this form yet, or you need to select a form from Drive or create a new official form. You can also simulate a submission using the Simulator tab!
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('create_form')}
                    className="px-4 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-700/20"
                  >
                    Create Official Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('simulator')}
                    className="px-4 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Try Live Simulator
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="py-3 px-3 font-bold">Applicant Name</th>
                      <th className="py-3 px-3 font-bold">Mobile / WhatsApp</th>
                      <th className="py-3 px-3 font-bold">Aadhaar Card</th>
                      <th className="py-3 px-3 font-bold">Preference</th>
                      <th className="py-3 px-3 font-bold">Emergency Contact</th>
                      <th className="py-3 px-3 font-bold">Submitted At</th>
                      <th className="py-3 px-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formResponses.map((res) => {
                      const isAlreadyAdmitted = tenants.some(
                        (t) =>
                          t.phone.replace(/\D/g, '').endsWith(res.extracted.phone.replace(/\D/g, '').slice(-10)) ||
                          t.kyc?.aadhaar?.aadhaarNumber?.replace(/\s/g, '') === res.extracted.aadhaarNumber?.replace(/\s/g, '')
                      );

                      return (
                        <tr key={res.responseId} className="hover:bg-blue-50/40 transition">
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{res.extracted.fullName}</p>
                            <p className="text-[10px] text-slate-500">{res.extracted.occupation}</p>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-blue-900">
                            +91 {res.extracted.phone.replace(/\D/g, '').slice(-10)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {res.extracted.aadhaarNumber || 'Verified in Form'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {res.extracted.sharingPreference}
                            </span>
                            <p className="text-[10px] text-slate-500 mt-0.5">{res.extracted.foodPreference}</p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-medium text-slate-800">{res.extracted.emergencyContactName}</p>
                            <p className="text-[10px] font-mono text-slate-500">{res.extracted.emergencyContactPhone}</p>
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {new Date(res.lastSubmittedTime).toLocaleDateString()}{' '}
                            {new Date(res.lastSubmittedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isAlreadyAdmitted ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Admitted in PG</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAdmittingResponse(res);
                                  setSelectedBedId(vacantBeds[0]?.id || '');
                                }}
                                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center space-x-1 ml-auto"
                              >
                                <BedDouble className="w-3 h-3" />
                                <span>Admit to Bed</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 1-Click Create Official PG Admission Form in Google Drive */}
      {/* ========================================================================= */}
      {activeSubTab === 'create_form' && (
        <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="max-w-2xl">
            <div className="flex items-center space-x-2 text-blue-700">
              <PlusCircle className="w-5 h-5" />
              <h2 className="text-lg font-bold text-slate-900">Create Official PG Admission Google Form</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              This will create a new, beautifully formatted Google Form directly inside your Google Drive using the Google Forms API. It is pre-configured with all mandatory fields required for Karnataka police verification and PG bed admission.
            </p>
          </div>

          {/* Question List Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Standard Fields Auto-Configured in the Form:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Full Name', type: 'Short Text (Aadhaar match)' },
                { label: '10-Digit Mobile Number', type: 'Phone (Login credential)' },
                { label: '12-Digit Aadhaar Number', type: 'Govt Photo ID' },
                { label: 'Date of Birth (DOB)', type: 'Date' },
                { label: 'Gender', type: 'Radio: Male / Female / Other' },
                { label: 'Room Sharing Preference', type: 'Radio: 2 / 3 / Single / 4' },
                { label: 'Emergency Contact Name', type: 'Parent / Guardian' },
                { label: 'Emergency Contact Mobile', type: 'Phone' },
                { label: 'Occupation & Workplace', type: 'Company / College' },
                { label: 'Food Preference', type: 'Radio: Veg / Non-Veg' },
                { label: 'Permanent Address & City', type: 'Paragraph' },
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-2xs">
                  <p className="font-bold text-slate-900">{item.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{item.type}</p>
                </div>
              ))}
            </div>
          </div>

          {createdFormResult ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Official Google Form Created Successfully!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Form ID: <span className="font-mono font-bold">{createdFormResult.formId}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={createdFormResult.responderUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Public Form to Fill</span>
                </a>
                <a
                  href={createdFormResult.editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-700" />
                  <span>Edit in Google Forms</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('api_sync')}
                  className="px-4 py-2 bg-blue-700 text-white font-bold rounded-xl text-xs"
                >
                  Go to Live Responses Tab →
                </button>
              </div>
            </div>
          ) : (
            <div>
              {accessToken ? (
                <button
                  type="button"
                  onClick={() => setCreateFormConfirmOpen(true)}
                  disabled={isCreatingForm}
                  className="py-3 px-6 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-blue-700/20 flex items-center space-x-2"
                >
                  {isCreatingForm ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Form in your Google Drive...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Create Official Google Form in My Drive</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs flex items-center justify-between">
                  <p className="text-blue-900 font-medium">
                    Please sign in with your Google account to create forms in your Google Drive.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="px-4 py-2 bg-blue-700 text-white font-bold rounded-xl text-xs shadow"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Browse / Pick Forms from Drive */}
      {/* ========================================================================= */}
      {activeSubTab === 'drive_forms' && (
        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-blue-700" />
                <span>Your Google Drive Forms</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select any form in your Google Drive to sync its live responses into PNS PG.
              </p>
            </div>

            {accessToken && (
              <button
                type="button"
                onClick={handleLoadDriveForms}
                disabled={isLoadingDriveForms}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDriveForms ? 'animate-spin' : ''}`} />
                <span>Refresh Drive List</span>
              </button>
            )}
          </div>

          {!accessToken ? (
            <div className="text-center py-10 space-y-3">
              <Globe className="w-8 h-8 text-blue-700 mx-auto" />
              <p className="text-xs text-slate-600">Connect your Google account to list forms from Drive</p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-4 py-2 bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-700/20"
              >
                Sign In with Google
              </button>
            </div>
          ) : isLoadingDriveForms ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 mt-2">Loading Google Forms from your Drive...</p>
            </div>
          ) : driveForms.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No Google Forms found in Drive</p>
              <p className="text-[11px] text-slate-500">Create one easily with our 1-click generator!</p>
              <button
                type="button"
                onClick={() => setActiveSubTab('create_form')}
                className="px-4 py-2 bg-blue-700 text-white font-bold rounded-xl text-xs mt-2"
              >
                Create Official Form →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {driveForms.map((form) => {
                const isSelected = selectedFormId === form.id;
                return (
                  <div
                    key={form.id}
                    className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-900">{form.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {form.id}</p>
                        {form.modifiedTime && (
                          <p className="text-[10px] text-slate-400">
                            Modified: {new Date(form.modifiedTime).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <span className="px-2 py-0.5 bg-blue-700 text-white rounded-full text-[10px] font-bold">
                          Active Form
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectForm(form.id);
                          setActiveSubTab('api_sync');
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 ${
                          isSelected
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Syncing Responses' : 'Select & Sync'}</span>
                      </button>

                      {form.webViewLink && (
                        <a
                          href={form.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual Form ID Entry */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Or Enter Custom Google Form ID / URL
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={customFormInput}
                onChange={(e) => setCustomFormInput(e.target.value)}
                placeholder="e.g. 1FAIpQLSc... or https://docs.google.com/forms/d/1abc.../edit"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (customFormInput.trim()) {
                    handleSelectForm(customFormInput.trim());
                    setActiveSubTab('api_sync');
                  }
                }}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition shrink-0"
              >
                Load Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Google Apps Script & Webhook */}
      {/* ========================================================================= */}
      {activeSubTab === 'webhook_script' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-3">
              <div className="flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-sm text-slate-900">Your Live Webhook URL</h3>
              </div>
              <p className="text-xs text-slate-500">
                Send HTTP POST JSON requests to this endpoint from Google Apps Script, Zapier, or any custom form.
              </p>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={webhookEndpoint}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-blue-900 select-all font-semibold"
                />
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1 shrink-0"
                >
                  {copiedWebhookUrl ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Setup Instructions (3 Steps)</h3>
              <ol className="list-decimal list-inside text-xs text-slate-600 space-y-2 leading-relaxed">
                <li>Open your Google Form in Google Drive.</li>
                <li>Click the 3 vertical dots (top-right menu) &rarr; select <b>Script editor</b>.</li>
                <li>Paste the script code from the right panel, then click <b>Triggers</b> (alarm clock icon on left sidebar) &rarr; <b>Add Trigger</b> &rarr; choose event type: <b>On form submit</b>.</li>
              </ol>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-sm text-slate-900">Google Apps Script (Copy & Paste)</h3>
              </div>
              <button
                type="button"
                onClick={handleCopyScript}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1"
              >
                {copiedScript ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedScript ? 'Script Copied!' : 'Copy Full Script'}</span>
              </button>
            </div>

            <pre className="bg-slate-950 text-blue-300 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-96 border border-slate-800 leading-relaxed select-all">
              {appsScriptCode}
            </pre>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: Form Submission Simulator */}
      {/* ========================================================================= */}
      {activeSubTab === 'simulator' && (
        <div className="max-w-2xl mx-auto bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900">Live Google Form Simulator</h2>
                <p className="text-xs text-slate-500">Test incoming form submissions with 1 click</p>
              </div>
            </div>

            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1" />
              <span>Live Engine Ready</span>
            </span>
          </div>

          <form onSubmit={handleSimulateGoogleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-blue-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  12-Digit Aadhaar Card *
                </label>
                <input
                  type="text"
                  required
                  value={simAadhaar}
                  onChange={(e) => setSimAadhaar(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date of Birth (DOB) *
                </label>
                <input
                  type="date"
                  required
                  value={simDob}
                  onChange={(e) => setSimDob(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Emergency Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={simEmergencyName}
                  onChange={(e) => setSimEmergencyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Emergency Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={simEmergencyPhone}
                  onChange={(e) => setSimEmergencyPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Occupation
                </label>
                <input
                  type="text"
                  value={simOccupation}
                  onChange={(e) => setSimOccupation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company / College
                </label>
                <input
                  type="text"
                  value={simCompany}
                  onChange={(e) => setSimCompany(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Room Sharing
                </label>
                <select
                  value={simRoomType}
                  onChange={(e) => setSimRoomType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                >
                  <option value="2-Sharing">2-Sharing</option>
                  <option value="3-Sharing">3-Sharing</option>
                  <option value="1-Sharing (Single)">1-Sharing (Single)</option>
                  <option value="4-Sharing">4-Sharing</option>
                </select>
              </div>
            </div>

            {simResult && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start space-x-2.5 ${
                  simResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {simResult.success ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{simResult.message}</p>
                  {simResult.tenant && (
                    <p className="mt-1 text-[11px] text-emerald-800">
                      Allocated Room {simResult.tenant.roomNumber} ({simResult.tenant.bedLabel}) • Monthly Rent: ₹{simResult.tenant.monthlyRent} • Resident can immediately log in with mobile (+91 {simResult.tenant.phone.replace(/\D/g, '')})!
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingSim}
              className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-blue-700/20 flex items-center justify-center space-x-2 disabled:opacity-70"
            >
              {isSubmittingSim ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting to /api/webhook/google-form...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Simulate Google Form Submit → Auto-Admit Tenant</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Explicit Confirmation to Create Official Google Form */}
      {/* ========================================================================= */}
      {createFormConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-blue-100 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Create Official PG Admission Form?</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This will create a new Google Form in your Google Drive under your connected Google account (<b>{googleUser?.email}</b>) with 11 pre-formatted questions including Aadhaar KYC, phone, DOB, emergency contact, and room preferences.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateFormConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOfficialForm}
                className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-700/20"
              >
                Confirm & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Bed Allocation & Admission Dialog for Selected Response */}
      {/* ========================================================================= */}
      {admittingResponse && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-blue-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BedDouble className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">Admit Google Form Applicant</h3>
              </div>
              <button
                type="button"
                onClick={() => setAdmittingResponse(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Applicant Summary */}
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-bold text-slate-900">{admittingResponse.extracted.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mobile Phone:</span>
                <span className="font-mono font-bold text-blue-900">+91 {admittingResponse.extracted.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Aadhaar Card:</span>
                <span className="font-mono text-slate-800">{admittingResponse.extracted.aadhaarNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sharing Preference:</span>
                <span className="font-bold text-indigo-700">{admittingResponse.extracted.sharingPreference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Emergency Contact:</span>
                <span className="text-slate-800">
                  {admittingResponse.extracted.emergencyContactName} ({admittingResponse.extracted.emergencyContactPhone})
                </span>
              </div>
            </div>

            <form onSubmit={handleAdmitTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Room & Bed to Allocate *
                </label>
                {vacantBeds.length === 0 ? (
                  <p className="text-xs text-rose-600 font-bold p-3 bg-rose-50 rounded-xl border border-rose-200">
                    No vacant beds available in the PG! Please free up a bed in the Bed Matrix first.
                  </p>
                ) : (
                  <select
                    required
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  >
                    {vacantBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Admitting will automatically verify their digital Aadhaar KYC, register them into the database, and allow them to log in via their phone number (+91 {admittingResponse.extracted.phone.replace(/\D/g, '')})!
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdmittingResponse(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdmission || vacantBeds.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-700/20 disabled:opacity-50"
                >
                  {isSubmittingAdmission ? 'Admitting Resident...' : 'Confirm Admission & Allocate Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
