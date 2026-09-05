import React, { useState, useEffect } from 'react';
import { PGProvider, usePG } from './context/PGContext';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/auth/LoginScreen';
import { ChangePasswordScreen } from './components/auth/ChangePasswordScreen';
import { TenantOnboardingForm } from './components/tenant/TenantOnboardingForm';
import { OwnerDashboard } from './components/owner/OwnerDashboard';
import { FloorBedMatrix } from './components/owner/FloorBedMatrix';
import { TenantDirectory } from './components/owner/TenantDirectory';
import { FinancialReports } from './components/owner/FinancialReports';
import { NoticesAndTickets } from './components/owner/NoticesAndTickets';
import { GoogleFormsIntegration } from './components/owner/GoogleFormsIntegration';
import { TenantPortal } from './components/tenant/TenantPortal';
import { RoommatesView } from './components/tenant/RoommatesView';
import { TenantKYC } from './components/tenant/TenantKYC';
import { TenantServices } from './components/tenant/TenantServices';
import { SettingsPage } from './components/owner/SettingsPage';
import { Sidebar, OwnerTab } from './components/layout/Sidebar';
import { Tenant } from './types';
import {
  Users,
  BedDouble,
  CreditCard,
  Utensils,
} from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    role,
    setRole,
    activeTenant,
    setCurrentTenantId,
    settings,
    getStats,
    isAuthenticated,
    authLoading,
    mustChangePassword,
    ownerProfile,
    logout,
    properties,
    activePropertyId,
  } = usePG();
  const stats = getStats();

  // Owner Active Tab
  const [ownerTab, setOwnerTab] = useState<OwnerTab>('dashboard');

  // Tenant Active Tab
  const [tenantTab, setTenantTab] = useState<'mystay' | 'roommates' | 'kyc' | 'services'>('mystay');

  // Direct Onboarding KYC view
  const [onboardingTenantId, setOnboardingTenantId] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Check URL query parameters for ?onboard=tenantId or ?kyc_invite=tenantId or ?register=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const onboardId = params.get('onboard') || params.get('kyc_invite');
      const isReg = params.get('register') || params.get('admission');
      if (onboardId) {
        setOnboardingTenantId(onboardId);
        setIsOnboardingOpen(true);
      } else if (isReg) {
        setIsOnboardingOpen(true);
      }
    }
  }, []);

  const handleOpenOnboarding = (tenantIdOrPhone?: string) => {
    setOnboardingTenantId(tenantIdOrPhone || null);
    setIsOnboardingOpen(true);
  };

  const handleOnboardingCompletedLogin = (tenant: Tenant) => {
    // Registration writes the tenant record, but a real Firebase session still
    // requires a phone-OTP login (see LoginScreen) - land them there next.
    setCurrentTenantId(tenant.id);
    setIsOnboardingOpen(false);
    // Clean URL
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // If user is accessing the Digital KYC Onboarding Form directly
  if (isOnboardingOpen) {
    return (
      <TenantOnboardingForm
        tenantId={onboardingTenantId || undefined}
        onCompletedLogin={handleOnboardingCompletedLogin}
        onBackToLogin={() => setIsOnboardingOpen(false)}
      />
    );
  }

  // Waiting on Firebase Auth to resolve the current session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Login Screen
  if (!isAuthenticated) {
    return <LoginScreen onOpenKYCOnboarding={(phone?: string) => handleOpenOnboarding(phone)} />;
  }

  // Invited admin/staff accounts must replace their shared temp password
  // before doing anything else - see ChangePasswordScreen.tsx.
  if (mustChangePassword) {
    return <ChangePasswordScreen />;
  }

  // Signed in with a valid Firebase account, but no users/{uid} Firestore
  // profile exists - profiles are only ever created server-side (see
  // firestore.rules), by either the bootstrap script (first owner) or
  // Settings > Team Access (everyone after). This is a setup problem, not
  // something to silently paper over with a fake owner profile.
  if (role === 'owner' && !ownerProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <p className="text-sm font-bold text-slate-900">No profile found for this account.</p>
        <p className="text-xs text-slate-500 max-w-sm">
          This login exists in Firebase Auth but has no matching profile in the database. If this is meant to be
          the first owner account, run <code className="font-mono">npm run bootstrap-owner</code>. Otherwise, ask
          an existing owner to add you under Settings &gt; Team Access.
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Signed in as owner but hasn't created a property yet - force Settings so
  // there's somewhere for rooms/tenants/etc. to be scoped to.
  if (role === 'owner' && properties.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white font-sans">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-lg font-black text-slate-900 mb-1">Welcome! Let's set up your first property.</h1>
          <p className="text-sm text-slate-600 mb-6">Create a property to start managing rooms, tenants, and rent.</p>
          <SettingsPage />
        </main>
      </div>
    );
  }

  if (role === 'owner' && !activePropertyId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex selection:bg-blue-600 selection:text-white font-sans">
      {/* Left icon sidebar (owner view only) */}
      {role === 'owner' && (
        <Sidebar
          activeTab={ownerTab}
          onChange={setOwnerTab}
          vacantBeds={stats.vacantBeds}
          pendingKYCCount={stats.pendingKYCCount}
          onLogout={logout}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Top Navbar - Royal Blue */}
        <Navbar />

        {/* Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* ======================= OWNER VIEW ======================= */}
          {role === 'owner' && (
            <div className="space-y-6">
              {/* Active Owner Tab Content */}
              {ownerTab === 'dashboard' && (
                <OwnerDashboard
                  onNavigateToMatrix={() => setOwnerTab('matrix')}
                  onNavigateToKYC={() => setOwnerTab('tenants')}
                  onNavigateToReports={() => setOwnerTab('finance')}
                />
            )}
            {ownerTab === 'matrix' && <FloorBedMatrix />}
            {ownerTab === 'tenants' && (
              <TenantDirectory onOpenKYCOnboarding={(id) => handleOpenOnboarding(id)} />
            )}
            {ownerTab === 'finance' && <FinancialReports />}
            {ownerTab === 'notices' && <NoticesAndTickets />}
            {ownerTab === 'googleforms' && <GoogleFormsIntegration />}
            {ownerTab === 'settings' && <SettingsPage />}
          </div>
        )}

        {/* ======================= TENANT VIEW ======================= */}
        {role === 'tenant' && (
          <div className="space-y-6">
            
            {/* Tenant Navigation Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
              <button
                id="tenant-tab-mystay"
                type="button"
                onClick={() => setTenantTab('mystay')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  tenantTab === 'mystay'
                    ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BedDouble className="w-4 h-4" />
                <span>My Stay & Rent</span>
              </button>

              <button
                id="tenant-tab-roommates"
                type="button"
                onClick={() => setTenantTab('roommates')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  tenantTab === 'roommates'
                    ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Roommate Contacts (Same Room)</span>
              </button>

              <button
                id="tenant-tab-kyc"
                type="button"
                onClick={() => setTenantTab('kyc')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  tenantTab === 'kyc'
                    ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Aadhaar Card & KYC</span>
                {activeTenant?.kyc?.status !== 'verified' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white ml-1 font-bold">
                    Action
                  </span>
                )}
              </button>

              <button
                id="tenant-tab-services"
                type="button"
                onClick={() => setTenantTab('services')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  tenantTab === 'services'
                    ? 'bg-blue-700 text-white shadow-md shadow-blue-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Food Menu & Maintenance</span>
              </button>
            </div>

            {/* Active Tenant Tab Content */}
            {tenantTab === 'mystay' && (
              <TenantPortal
                onNavigateToKYC={() => setTenantTab('kyc')}
                onNavigateToRoommates={() => setTenantTab('roommates')}
                onNavigateToServices={() => setTenantTab('services')}
              />
            )}
            {tenantTab === 'roommates' && <RoommatesView />}
            {tenantTab === 'kyc' && <TenantKYC />}
            {tenantTab === 'services' && <TenantServices />}
          </div>
        )}

      </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
          <p>
            {settings.pgName} Management System • {settings.totalFloors} Floors • {stats.totalRooms} Rooms
          </p>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <PGProvider>
      <AppContent />
    </PGProvider>
  );
}
