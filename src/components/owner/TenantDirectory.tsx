import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Tenant } from '../../types';
import { TenantInviteModal } from './TenantInviteModal';
import { TenantProfilePanel } from './TenantProfilePanel';
import { getSharingLabel } from '../../lib/roomLabels';
import { NumberField } from '../common/NumberField';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  CreditCard,
  UserCheck,
  Printer,
  X,
  AlertTriangle,
  MessageSquare,
  BedDouble,
  Briefcase,
  HeartPulse,
  Send,
  Plus,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TenantDirectoryProps {
  onOpenKYCOnboarding?: (tenantId: string) => void;
}

export const TenantDirectory: React.FC<TenantDirectoryProps> = ({ onOpenKYCOnboarding }) => {
  const { tenants, rooms, approveKYC, rejectKYC, addTenant, activeProperty } = usePG();
  const [searchTerm, setSearchTerm] = useState('');
  const [kycFilter, setKycFilter] = useState<'all' | 'verified' | 'pending' | 'unsubmitted'>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  
  // Selected Tenant Dossier Modal
  const [selectedTenantDossier, setSelectedTenantDossier] = useState<Tenant | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Add Tenant Modal State
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPhone, setNewTenantPhone] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [customRent, setCustomRent] = useState<number>(8000);
  const [customDeposit, setCustomDeposit] = useState<number>(15000);

  // Invite Modal State
  const [inviteModalTenant, setInviteModalTenant] = useState<Tenant | null>(null);

  // Profile slide-over (opened by clicking a tenant card)
  const [profileTenant, setProfileTenant] = useState<Tenant | null>(null);

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    if (floorFilter !== 'all' && t.floor !== floorFilter) return false;
    if (kycFilter !== 'all' && t.kyc?.status !== kycFilter) return false;
    if (
      searchTerm &&
      !t.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !t.phone.includes(searchTerm) &&
      !(t.roomNumber && t.roomNumber.includes(searchTerm)) &&
      !(t.kyc?.aadhaar?.aadhaarNumber && t.kyc.aadhaar.aadhaarNumber.includes(searchTerm))
    ) {
      return false;
    }
    return true;
  });

  const handleApprove = (tenantId: string) => {
    approveKYC(tenantId);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    if (selectedTenantDossier && selectedTenantDossier.id === tenantId) {
      setSelectedTenantDossier({
        ...selectedTenantDossier,
        kyc: {
          ...selectedTenantDossier.kyc,
          status: 'verified',
          verifiedByOwner: true,
        },
      });
    }
  };

  const handleReject = (tenantId: string) => {
    if (!rejectionReason.trim()) return;
    rejectKYC(tenantId, rejectionReason.trim());
    setShowRejectInput(false);
    setRejectionReason('');
    if (selectedTenantDossier && selectedTenantDossier.id === tenantId) {
      setSelectedTenantDossier({
        ...selectedTenantDossier,
        kyc: {
          ...selectedTenantDossier.kyc,
          status: 'rejected',
          verifiedByOwner: false,
        },
      });
    }
  };

  const handlePrintDossier = () => {
    window.print();
  };

  // When room is selected in Add Tenant modal, auto-update beds and rent
  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      const vacantBed = room.beds.find((b) => b.status === 'vacant');
      setSelectedBedId(vacantBed ? vacantBed.id : (room.beds[0]?.id || ''));
      setCustomRent(room.pricePerBed);
      setCustomDeposit(room.securityDeposit);
    }
  };

  const handleAddTenantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim() || !newTenantPhone.trim()) return;

    const newId = addTenant({
      name: newTenantName.trim(),
      phone: newTenantPhone.trim(),
      roomId: selectedRoomId || undefined,
      bedId: selectedBedId || undefined,
      monthlyRent: customRent,
      securityDeposit: customDeposit,
    });

    setIsAddTenantOpen(false);
    setNewTenantName('');
    setNewTenantPhone('');
    setSelectedRoomId('');
    setSelectedBedId('');

    // Automatically find newly created tenant and open the WhatsApp invitation modal!
    setTimeout(() => {
      // Find created tenant
      const created = tenants.find((t) => t.id === newId) || {
        id: newId,
        name: newTenantName.trim(),
        phone: newTenantPhone.trim(),
        roomNumber: rooms.find((r) => r.id === selectedRoomId)?.roomNumber,
        bedLabel: rooms.find((r) => r.id === selectedRoomId)?.beds.find((b) => b.id === selectedBedId)?.bedLabel,
        floor: rooms.find((r) => r.id === selectedRoomId)?.floor || 1,
        monthlyRent: customRent,
        securityDeposit: customDeposit,
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
        email: '',
        depositPaid: false,
        checkInDate: new Date().toISOString().split('T')[0],
        rentStatus: 'due',
        dueAmount: customRent,
        hometown: 'Bengaluru, Karnataka',
        kyc: {
          status: 'unsubmitted',
          aadhaar: { aadhaarNumber: '', nameOnAadhaar: '', dob: '', gender: 'Male', address: '' },
          fatherName: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          emergencyContactRelation: '',
          permanentAddress: '',
          city: '',
          state: '',
          pincode: '',
          occupation: 'Working Professional',
          companyOrCollege: '',
          foodPreference: 'Veg',
        },
      } as Tenant;

      setInviteModalTenant(created);
    }, 100);

    confetti({ particleCount: 35, spread: 70, origin: { y: 0.6 } });
  };

  return (
    <div id="tenant-directory-view" className="space-y-6 animate-in fade-in">
      
      {/* Directory Header & Filters in Royal Blue / White Theme */}
      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-100 shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">
                  Tenant Directory & Aadhaar KYC Records
                </h1>
                <p className="text-xs text-slate-500">
                  Register new tenants, dispatch WhatsApp KYC invites, and review verified Aadhaar documents.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-xs px-3.5 py-2 rounded-xl bg-brand-50 border border-brand-200 text-brand-900 font-semibold shadow-sm">
              Total Residents: <span className="font-bold text-brand-950">{tenants.length}</span> (
              <span className="text-emerald-700 font-bold">
                {tenants.filter((t) => t.kyc?.status === 'verified').length} KYC Verified
              </span>
              )
            </div>
            
            <button
              type="button"
              onClick={() => setIsAddTenantOpen(true)}
              className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-700/20 flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Tenant & Invite</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Name, Phone, Room Number, or Aadhaar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-slate-500 font-semibold flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>KYC:</span>
            </span>
            {(['all', 'verified', 'pending', 'unsubmitted'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setKycFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                  kycFilter === filter
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter === 'all' ? 'All' : filter}
              </button>
            ))}

            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-600"
            >
              <option value="all">All Floors</option>
              <option value={1}>Floor 1</option>
              <option value={2}>Floor 2</option>
              <option value={3}>Floor 3</option>
              <option value={4}>Floor 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTenants.map((t) => {
          const kycStatus = t.kyc?.status || 'unsubmitted';

          return (
            <div
              key={t.id}
              onClick={() => setProfileTenant(t)}
              role="button"
              tabIndex={0}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition space-y-4 text-slate-900 relative flex flex-col justify-between cursor-pointer"
            >
              {/* Tenant Profile Top */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={t.photoUrl}
                      alt={t.name}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-brand-600 shadow-sm shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                      <p className="text-xs text-brand-700 font-semibold flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-brand-600" />
                        <span>+91 {t.phone.replace(/\D/g, '')}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {t.roomNumber ? `Room ${t.roomNumber} (${t.bedLabel}) • Floor ${t.floor}` : 'Bed Unassigned'}
                      </p>
                    </div>
                  </div>

                  {/* KYC Status Badge */}
                  <div>
                    {kycStatus === 'verified' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified</span>
                      </span>
                    )}
                    {kycStatus === 'pending' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold animate-pulse">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        <span>Under Review</span>
                      </span>
                    )}
                    {(kycStatus === 'unsubmitted' || kycStatus === 'rejected') && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[11px] font-bold">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{kycStatus === 'rejected' ? 'KYC Rejected' : 'KYC Pending'}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Aadhaar and Emergency Summary Snippet */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Aadhaar Card:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {t.kyc?.aadhaar?.aadhaarNumber || 'Not submitted yet'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Emergency Contact:</span>
                    <span className="font-semibold text-slate-800">
                      {t.kyc?.emergencyContactName ? `${t.kyc.emergencyContactName} (${t.kyc.emergencyContactRelation})` : 'Not provided'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Occupation:</span>
                    <span className="font-semibold text-slate-800">
                      {t.kyc?.occupation || 'Working Professional'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Rent Status:</span>
                    <span className={`font-bold ${t.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {t.dueAmount > 0 ? `₹${t.dueAmount} Due` : 'Paid in Full'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setInviteModalTenant(t); }}
                  className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs border border-emerald-200 transition flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Invite</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedTenantDossier(t); }}
                  className="py-2 px-3 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Review Dossier</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTenants.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No tenants matched your search criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search keywords, KYC status filters, or floor selectors.
          </p>
        </div>
      )}

      {/* CREATE NEW TENANT MODAL */}
      {isAddTenantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-brand-100 text-slate-900">
            
            {/* Modal Header */}
            <div className="bg-brand-700 text-white px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center border border-white/20">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Create Tenant & Assign Room</h2>
                  <p className="text-xs text-brand-100">Step 1: Admin allocates room • Step 2: Auto WhatsApp Invite</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTenantOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTenantSubmit} className="p-6 space-y-4">
              
              {/* Tenant Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tenant Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                />
              </div>

              {/* WhatsApp Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Mobile Number *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 text-xs font-bold text-slate-500">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newTenantPhone}
                    onChange={(e) => setNewTenantPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  The invitation link and KYC onboarding form will be dispatched to this number.
                </p>
              </div>

              {/* Room & Bed Allocation Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select PG Room *
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => handleRoomSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  >
                    <option value="">-- Choose Room --</option>
                    {rooms.map((r) => {
                      const vacantCount = r.beds.filter((b) => b.status === 'vacant').length;
                      return (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} ({getSharingLabel(activeProperty, r.sharingId)} • Flr {r.floor}) - {vacantCount} Vacant
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Bed *
                  </label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    disabled={!selectedRoomId}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm disabled:opacity-50"
                  >
                    <option value="">-- Choose Bed --</option>
                    {selectedRoomId &&
                      rooms
                        .find((r) => r.id === selectedRoomId)
                        ?.beds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bedLabel} ({b.status === 'vacant' ? '🟢 Vacant' : '🔴 Occupied'}) - ₹{b.pricePerMonth}/mo
                          </option>
                        ))}
                  </select>
                </div>
              </div>

              {/* Monthly Rent & Deposit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Monthly Rent (₹)
                  </label>
                  <NumberField
                    value={customRent}
                    onChange={setCustomRent}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Security Deposit (₹)
                  </label>
                  <NumberField
                    value={customDeposit}
                    onChange={setCustomDeposit}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-600 shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddTenantOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-brand-700/20 flex items-center space-x-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Create & Generate WhatsApp Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TENANT PROFILE SLIDE-OVER (opened by clicking a tenant card) */}
      {profileTenant && (
        <TenantProfilePanel
          tenant={tenants.find((t) => t.id === profileTenant.id) || profileTenant}
          onClose={() => setProfileTenant(null)}
          onViewDossier={() => {
            setSelectedTenantDossier(profileTenant);
            setProfileTenant(null);
          }}
        />
      )}

      {/* WHATSAPP INVITATION MODAL */}
      {inviteModalTenant && (
        <TenantInviteModal
          tenant={inviteModalTenant}
          isOpen={!!inviteModalTenant}
          onClose={() => setInviteModalTenant(null)}
          onOpenFormDirectly={(id) => {
            setInviteModalTenant(null);
            if (onOpenKYCOnboarding) {
              onOpenKYCOnboarding(id);
            }
          }}
        />
      )}

      {/* TENANT DOSSIER & POLICE VERIFICATION MODAL */}
      {selectedTenantDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-brand-100 text-slate-900">
            
            {/* Dossier Header */}
            <div className="sticky top-0 bg-brand-700 text-white px-6 py-4 flex items-center justify-between z-10 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center border border-white/20">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">Digital KYC & Verification Record</h2>
                  <p className="text-xs text-brand-100">Official tenant identification & Aadhaar compliance dossier</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrintDossier}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Record</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTenantDossier(null)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Tenant Hero Box */}
              <div className="bg-brand-50/80 border border-brand-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <img
                    src={selectedTenantDossier.photoUrl}
                    alt={selectedTenantDossier.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-600 shadow-md shrink-0"
                  />
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{selectedTenantDossier.name}</h3>
                    <p className="text-xs text-brand-800 font-bold flex items-center space-x-1">
                      <Phone className="w-3 h-3 text-brand-600" />
                      <span>+91 {selectedTenantDossier.phone.replace(/\D/g, '')}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Stay: Room {selectedTenantDossier.roomNumber || 'Assigned'} ({selectedTenantDossier.bedLabel}) • Floor {selectedTenantDossier.floor}
                    </p>
                  </div>
                </div>

                {/* Status Indicator & Action */}
                <div className="flex flex-col items-end space-y-2 w-full sm:w-auto">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 font-medium">KYC Status:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        selectedTenantDossier.kyc?.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : selectedTenantDossier.kyc?.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {selectedTenantDossier.kyc?.status || 'Unsubmitted'}
                    </span>
                  </div>

                  {selectedTenantDossier.kyc?.status !== 'verified' && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedTenantDossier.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow flex items-center space-x-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve KYC</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowRejectInput(!showRejectInput)}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection input box */}
              {showRejectInput && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-800">
                    Reason for Rejecting KYC (Aadhaar mismatch, blurred photo, etc.):
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="e.g. Aadhaar number blurred or DOB mismatch"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleReject(selectedTenantDossier.id)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shrink-0"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}

              {/* Aadhaar Details Block */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-brand-700" />
                  <span>Aadhaar Identity Details</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Aadhaar Card No.</span>
                    <p className="font-mono font-bold text-brand-950 text-sm">
                      {selectedTenantDossier.kyc?.aadhaar?.aadhaarNumber || 'Not submitted'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Name on Aadhaar</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.aadhaar?.nameOnAadhaar || selectedTenantDossier.name}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Date of Birth (DOB)</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.aadhaar?.dob || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Gender</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.aadhaar?.gender || 'Male'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Blood Group</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.bloodGroup || 'B+'}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-500">Food Preference</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.foodPreference || 'Veg'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-xs">
                  <span className="text-slate-500">Permanent Aadhaar Address:</span>
                  <p className="font-medium text-slate-900 mt-0.5">
                    {selectedTenantDossier.kyc?.aadhaar?.address || selectedTenantDossier.kyc?.permanentAddress || 'Bengaluru, Karnataka'}
                  </p>
                </div>
              </div>

              {/* Emergency Contact & Occupation Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Emergency Contact */}
                <div className="border border-rose-200 bg-rose-50/40 rounded-2xl p-5 space-y-3 text-xs">
                  <h4 className="font-bold text-rose-900 uppercase tracking-wider flex items-center space-x-2">
                    <HeartPulse className="w-4 h-4 text-rose-600" />
                    <span>Emergency / Parent Contact</span>
                  </h4>
                  <div>
                    <span className="text-slate-500">Contact Person Name:</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.emergencyContactName || 'Not submitted'} ({selectedTenantDossier.kyc?.emergencyContactRelation || 'Parent'})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Emergency Phone:</span>
                    <p className="font-mono font-bold text-rose-800">
                      {selectedTenantDossier.kyc?.emergencyContactPhone || 'Not submitted'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Father's Name:</span>
                    <p className="font-medium text-slate-900">
                      {selectedTenantDossier.kyc?.fatherName || 'Not recorded'}
                    </p>
                  </div>
                </div>

                {/* Occupation */}
                <div className="border border-brand-200 bg-brand-50/40 rounded-2xl p-5 space-y-3 text-xs">
                  <h4 className="font-bold text-brand-900 uppercase tracking-wider flex items-center space-x-2">
                    <Briefcase className="w-4 h-4 text-brand-700" />
                    <span>Occupation & Workplace</span>
                  </h4>
                  <div>
                    <span className="text-slate-500">Occupation Type:</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.occupation || 'Working Professional'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Company / College:</span>
                    <p className="font-bold text-slate-900">
                      {selectedTenantDossier.kyc?.companyOrCollege || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Monthly Rent:</span>
                    <p className="font-bold text-emerald-700">
                      ₹{selectedTenantDossier.monthlyRent.toLocaleString('en-IN')} / month
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
