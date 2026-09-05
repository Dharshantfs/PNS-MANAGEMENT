import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Room, Bed, Tenant } from '../../types';
import { FACILITY_OPTIONS, facilityLabel } from '../../lib/facilities';
import {
  Layers,
  BedDouble,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Sparkles,
  IndianRupee,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Shared facilities checkbox grid - used in both the Add Room and Edit Room
// modals so the list only needs to be maintained in one place.
const FacilitiesChecklist: React.FC<{ selected: string[]; onToggle: (key: string) => void }> = ({ selected, onToggle }) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
    {FACILITY_OPTIONS.map((f) => (
      <label
        key={f.key}
        className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-xl border text-[11px] font-semibold cursor-pointer transition ${
          selected.includes(f.key) ? 'bg-brand-50 border-brand-300 text-brand-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <input
          type="checkbox"
          checked={selected.includes(f.key)}
          onChange={() => onToggle(f.key)}
          className="w-3.5 h-3.5 accent-current"
        />
        <span className="truncate">{f.label}</span>
      </label>
    ))}
  </div>
);

export const FloorBedMatrix: React.FC = () => {
  const {
    rooms,
    tenants,
    activeProperty,
    addRoom,
    updateRoom,
    deleteRoom,
    assignBed,
    vacateBed,
    transferBed,
  } = usePG();

  const totalFloors = activeProperty?.totalFloors || 4;
  const roomTypes = activeProperty?.roomTypes || [];
  const sharingOptions = (activeProperty?.sharingOptions || []).slice().sort((a, b) => a.occupancy - b.occupancy);
  const roomTypeLabel = (id: string) => roomTypes.find((rt) => rt.id === id)?.name || 'Room';
  const sharingLabel = (id: string) => sharingOptions.find((s) => s.id === id)?.label || 'Sharing';

  // The room's default deposit follows the "Deposit" dues category set up
  // under Settings > Dues Packages, instead of a number unrelated to it.
  const depositCategory = (activeProperty?.duesCategories || []).find((c) => c.categoryType === 'deposit' && c.active);
  const defaultDeposit = depositCategory?.amountType === 'fixed' ? depositCategory.fixedAmount || 0 : 15000;

  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVacancy, setFilterVacancy] = useState<'all' | 'has-vacant' | 'fully-occupied'>('all');

  // Modals state
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [assigningBedInfo, setAssigningBedInfo] = useState<{ room: Room; bed: Bed } | null>(null);
  const [transferringTenant, setTransferringTenant] = useState<Tenant | null>(null);

  // New room form state
  const [newFloor, setNewFloor] = useState<number>(1);
  const [newRoomNum, setNewRoomNum] = useState('');

  React.useEffect(() => {
    // Auto-generate Room ID based on floor
    const floorRooms = rooms.filter(r => r.floor === newFloor);
    const maxNum = floorRooms.reduce((max, r) => {
      const match = r.roomNumber.match(/F\dR(\d+)/);
      if (match) {
        return Math.max(max, parseInt(match[1], 10));
      }
      return max;
    }, 0);
    const nextNum = (maxNum + 1).toString().padStart(2, '0');
    setNewRoomNum(`F${newFloor}R${nextNum}`);
  }, [newFloor, rooms, isAddRoomOpen]);

  const [newRoomTypeId, setNewRoomTypeId] = useState<string>(roomTypes[0]?.id || '');
  const [newSharingId, setNewSharingId] = useState<string>(sharingOptions[0]?.id || '');
  const [newFacilities, setNewFacilities] = useState<string[]>([]);
  const [newAvailableForRent, setNewAvailableForRent] = useState(true);
  const [newNotes, setNewNotes] = useState('');
  const [newPrice, setNewPrice] = useState(sharingOptions[0]?.defaultRent || 8500);
  const [newDeposit, setNewDeposit] = useState(defaultDeposit);

  // Keep room-type/sharing selections valid as the property's config changes,
  // and default the price/deposit to the configured rent package / dues category.
  React.useEffect(() => {
    if (!newRoomTypeId && roomTypes[0]) setNewRoomTypeId(roomTypes[0].id);
  }, [roomTypes, newRoomTypeId]);

  React.useEffect(() => {
    if (!newSharingId && sharingOptions[0]) setNewSharingId(sharingOptions[0].id);
  }, [sharingOptions, newSharingId]);

  React.useEffect(() => {
    const sharing = sharingOptions.find((s) => s.id === newSharingId);
    if (sharing) setNewPrice(sharing.defaultRent);
  }, [newSharingId]);

  React.useEffect(() => {
    if (isAddRoomOpen) setNewDeposit(defaultDeposit);
  }, [isAddRoomOpen, defaultDeposit]);

  const toggleNewFacility = (key: string) => {
    setNewFacilities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleEditFacility = (key: string) => {
    if (!editingRoom) return;
    setEditingRoom({
      ...editingRoom,
      facilities: editingRoom.facilities.includes(key)
        ? editingRoom.facilities.filter((k) => k !== key)
        : [...editingRoom.facilities, key],
    });
  };

  // Assign bed state
  const [selectedTenantIdToAssign, setSelectedTenantIdToAssign] = useState<string>('');

  // Transfer bed state
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [targetBedId, setTargetBedId] = useState<string>('');

  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    if (selectedFloor !== 'all' && r.floor !== selectedFloor) return false;
    if (searchTerm && !r.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    const hasVacant = r.beds.some((b) => b.status === 'vacant');
    if (filterVacancy === 'has-vacant' && !hasVacant) return false;
    if (filterVacancy === 'fully-occupied' && hasVacant) return false;
    return true;
  });

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNum.trim() || !newRoomTypeId || !newSharingId) return;

    addRoom({
      roomNumber: newRoomNum.trim(),
      floor: Number(newFloor),
      roomTypeId: newRoomTypeId,
      sharingId: newSharingId,
      facilities: newFacilities,
      pricePerBed: Number(newPrice),
      securityDeposit: Number(newDeposit),
      availableForRent: newAvailableForRent,
      notes: newNotes.trim() || undefined,
    });

    setIsAddRoomOpen(false);
    setNewRoomNum('');
    setNewFacilities([]);
    setNewNotes('');
    setNewAvailableForRent(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
  };

  const handleSaveEditRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    updateRoom(editingRoom.id, {
      pricePerBed: Number(editingRoom.pricePerBed),
      securityDeposit: Number(editingRoom.securityDeposit),
      facilities: editingRoom.facilities,
      availableForRent: editingRoom.availableForRent,
    });

    setEditingRoom(null);
  };

  const handleConfirmAssign = () => {
    if (!assigningBedInfo || !selectedTenantIdToAssign) return;
    const success = assignBed(assigningBedInfo.room.id, assigningBedInfo.bed.id, selectedTenantIdToAssign);
    if (success) {
      confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
      setAssigningBedInfo(null);
      setSelectedTenantIdToAssign('');
    }
  };

  const handleConfirmTransfer = () => {
    if (!transferringTenant || !targetRoomId || !targetBedId) return;
    const success = transferBed(transferringTenant.id, targetRoomId, targetBedId);
    if (success) {
      confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
      setTransferringTenant(null);
      setTargetRoomId('');
      setTargetBedId('');
    }
  };

  // Find all vacant beds across the entire PG for transfer dropdown
  const allVacantBeds = rooms.flatMap((r) =>
    r.beds
      .filter((b) => b.status === 'vacant')
      .map((b) => ({
        roomId: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        bedId: b.id,
        bedLabel: b.bedLabel,
        price: b.pricePerMonth || r.pricePerBed,
      }))
  );

  return (
    <div id="floor-bed-matrix-view" className="space-y-6 animate-in fade-in text-slate-900">

      {/* Top Header & Floor Switcher Bar */}
      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-brand-700" />
              <span>Room & Bed Layout Matrix</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure room prices, manage bed counts, and assign or transfer tenant beds across {totalFloors} floors.
            </p>
          </div>

          <button
            id="add-new-room-btn"
            type="button"
            onClick={() => setIsAddRoomOpen(true)}
            className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-md shadow-brand-700/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Configure New Room</span>
          </button>
        </div>

        {/* Floors Tab Switcher + Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto whitespace-nowrap scrollbar-hide max-w-full">
            <button
              type="button"
              onClick={() => setSelectedFloor('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedFloor === 'all'
                  ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All {totalFloors} Floors ({rooms.length} Rooms)
            </button>
            {Array.from({ length: totalFloors }, (_, i) => i + 1).map((f) => {
              const floorVacantCount = rooms
                .filter((r) => r.floor === f)
                .reduce((acc, r) => acc + r.beds.filter((b) => b.status === 'vacant').length, 0);

              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFloor(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                    selectedFloor === f
                      ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Floor {f}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedFloor === f ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {floorVacantCount} Vacant
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search Room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 w-full sm:w-48"
              />
            </div>

            <select
              value={filterVacancy}
              onChange={(e) => setFilterVacancy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600"
            >
              <option value="all">All Rooms</option>
              <option value="has-vacant">Has Vacant Beds</option>
              <option value="fully-occupied">Fully Occupied</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Rooms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRooms.map((room, index) => {
          const vacantCount = room.beds.filter((b) => b.status === 'vacant').length;

          return (
            <div
              key={`${room.id}-${index}`}
              className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm hover:border-brand-300 transition flex flex-col justify-between"
            >
              {/* Room Card Top Header */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-700 border border-brand-200 flex items-center justify-center font-black text-sm">
                      {room.roomNumber}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 font-bold border border-brand-200">
                          Floor {room.floor}
                        </span>
                        {!room.availableForRent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">
                            Not for Rent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {roomTypeLabel(room.roomTypeId)} • {sharingLabel(room.sharingId)}
                      </p>
                    </div>
                  </div>

                  {/* Room Status & Config Action */}
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                        vacantCount > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-brand-50 text-brand-800 border-brand-200'
                      }`}
                    >
                      {vacantCount > 0 ? `${vacantCount} Vacant` : 'Occupied'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingRoom(room)}
                      className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition"
                      title="Edit Room Pricing & Amenities"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRoom(room.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete Room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Amenities Badges & Price */}
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs py-2.5 px-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2 text-slate-500 font-medium">
                    {room.facilities.length === 0 ? (
                      <span className="text-[10px] text-slate-400">No facilities listed</span>
                    ) : (
                      room.facilities.slice(0, 5).map((key) => (
                        <span key={key} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200">
                          {facilityLabel(key)}
                        </span>
                      ))
                    )}
                    {room.facilities.length > 5 && (
                      <span className="text-[10px] text-slate-400">+{room.facilities.length - 5} more</span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="font-black text-brand-900 text-xs">
                      ₹{room.pricePerBed.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400"> / bed</span>
                  </div>
                </div>

                {/* Visual Bed Grid in this Room */}
                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Beds in Room ({room.beds.length})</span>
                    <span className="text-[10px] text-slate-400 font-normal">Manage allocation</span>
                  </div>

                  <div className="space-y-2">
                    {room.beds.map((bed, bIndex) => {
                      const isOccupied = bed.status === 'occupied';
                      const occupant = isOccupied ? tenants.find((t) => t.id === bed.tenantId) : null;

                      return (
                        <div
                          key={`${bed.id}-${bIndex}`}
                          className={`p-3 rounded-2xl border transition flex items-center justify-between ${
                            isOccupied
                              ? 'bg-brand-50/60 border-brand-200'
                              : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400'
                          }`}
                        >
                          {/* Bed Info & Occupant Avatar */}
                          <div className="flex items-center space-x-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                                isOccupied
                                  ? 'bg-brand-700 text-white'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              <BedDouble className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                                {bed.bedLabel}
                              </p>
                              {isOccupied && occupant ? (
                                <p className="text-[11px] text-brand-800 font-semibold leading-tight truncate flex items-center space-x-1 mt-0.5">
                                  <span>{occupant.name}</span>
                                  {occupant.kyc?.status === 'verified' && (
                                    <span className="text-[9px] text-emerald-700 font-bold">✓ KYC</span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-[11px] text-emerald-700 font-semibold leading-tight mt-0.5">
                                  Available (₹{bed.pricePerMonth || room.pricePerBed}/mo)
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Action on Bed */}
                          <div className="flex items-center space-x-1.5 shrink-0">
                            {isOccupied ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => occupant && setTransferringTenant(occupant)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold rounded-lg transition flex items-center space-x-1"
                                  title="Transfer Tenant to another Bed"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  <span>Transfer</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Vacate ${bed.bedLabel} in Room ${room.roomNumber}?`)) {
                                      vacateBed(room.id, bed.id);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition flex items-center space-x-1"
                                  title="Mark Bed as Vacant"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>Vacate</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningBedInfo({ room, bed });
                                  setSelectedTenantIdToAssign('');
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Assign</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: CONFIGURE NEW ROOM */}
      {isAddRoomOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-brand-100 text-slate-900 my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-brand-700 text-white shadow-sm">
              <h2 className="font-bold text-white text-sm flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Configure & Add New Room</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAddRoomOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Room Name (Auto-Generated)</label>
                  <input
                    type="text"
                    required
                    value={newRoomNum}
                    onChange={(e) => setNewRoomNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-brand-800 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Floor (1 to {totalFloors}) *</label>
                  <select
                    value={newFloor}
                    onChange={(e) => setNewFloor(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    {Array.from({ length: totalFloors }, (_, i) => i + 1).map((f) => (
                      <option key={f} value={f}>Floor {f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Type *</label>
                  <select
                    value={newRoomTypeId}
                    onChange={(e) => setNewRoomTypeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sharing Type *</label>
                  <select
                    value={newSharingId}
                    onChange={(e) => setNewSharingId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                  >
                    {sharingOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.label} (₹{s.defaultRent}/bed)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount Per Bed (₹/mo) *</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Security Deposit (₹)</label>
                  <input
                    type="number"
                    value={newDeposit}
                    onChange={(e) => setNewDeposit(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Defaults from Settings &gt; Dues Packages &gt; Deposit category - editable per room.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Room Remarks</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional notes about this room"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Is this room available to rent? *</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="radio" checked={newAvailableForRent} onChange={() => setNewAvailableForRent(true)} />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="radio" checked={!newAvailableForRent} onChange={() => setNewAvailableForRent(false)} />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Room Facilities</label>
                <FacilitiesChecklist selected={newFacilities} onToggle={toggleNewFacility} />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20"
                >
                  Create & Initialize Beds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ROOM PRICING & AMENITIES */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-100 text-slate-900 my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-brand-700 text-white shadow-sm">
              <h2 className="font-bold text-white text-sm">Edit Room {editingRoom.roomNumber}</h2>
              <button
                type="button"
                onClick={() => setEditingRoom(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditRoom} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Price per Bed (₹)</label>
                  <input
                    type="number"
                    required
                    value={editingRoom.pricePerBed}
                    onChange={(e) => setEditingRoom({ ...editingRoom, pricePerBed: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Security Deposit (₹)</label>
                  <input
                    type="number"
                    required
                    value={editingRoom.securityDeposit}
                    onChange={(e) => setEditingRoom({ ...editingRoom, securityDeposit: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Available to rent?</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={editingRoom.availableForRent}
                      onChange={() => setEditingRoom({ ...editingRoom, availableForRent: true })}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      checked={!editingRoom.availableForRent}
                      onChange={() => setEditingRoom({ ...editingRoom, availableForRent: false })}
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Room Facilities</label>
                <FacilitiesChecklist selected={editingRoom.facilities} onToggle={toggleEditFacility} />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN VACANT BED TO TENANT */}
      {assigningBedInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-100 text-slate-900">
            <div className="flex items-center justify-between px-6 py-4 bg-brand-700 text-white shadow-sm">
              <div>
                <h2 className="font-bold text-white text-sm">
                  Assign {assigningBedInfo.bed.bedLabel}
                </h2>
                <p className="text-xs text-brand-100">
                  Room {assigningBedInfo.room.roomNumber} • Floor {assigningBedInfo.room.floor} (₹{assigningBedInfo.bed.pricePerMonth}/mo)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningBedInfo(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Tenant to Assign *
                </label>
                <select
                  value={selectedTenantIdToAssign}
                  onChange={(e) => setSelectedTenantIdToAssign(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.phone}) - Current: {t.roomNumber ? `Room ${t.roomNumber}` : 'Unassigned'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTenantIdToAssign && (
                <div className="bg-brand-50/60 p-3.5 rounded-2xl border border-brand-200 text-xs space-y-1">
                  {(() => {
                    const t = tenants.find((item) => item.id === selectedTenantIdToAssign);
                    if (!t) return null;
                    return (
                      <>
                        <p className="font-bold text-slate-900">{t.name}</p>
                        <p className="text-slate-600">Phone: {t.phone}</p>
                        <p className="text-slate-600">
                          Aadhaar KYC:{' '}
                          <span
                            className={
                              t.kyc?.status === 'verified'
                                ? 'text-emerald-700 font-bold'
                                : 'text-amber-700 font-bold'
                            }
                          >
                            {t.kyc?.status?.toUpperCase() || 'NOT SUBMITTED'}
                          </span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}

              <button
                type="button"
                disabled={!selectedTenantIdToAssign}
                onClick={handleConfirmAssign}
                className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20"
              >
                Confirm Bed Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: TRANSFER TENANT TO ANOTHER BED */}
      {transferringTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-brand-100 text-slate-900">
            <div className="flex items-center justify-between px-6 py-4 bg-brand-700 text-white shadow-sm">
              <div>
                <h2 className="font-bold text-white text-sm flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Transfer Resident: {transferringTenant.name}</span>
                </h2>
                <p className="text-xs text-brand-100">
                  Current: Room {transferringTenant.roomNumber} ({transferringTenant.bedLabel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferringTenant(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Target Vacant Bed *
                </label>
                <select
                  value={`${targetRoomId}::${targetBedId}`}
                  onChange={(e) => {
                    const [rId, bId] = e.target.value.split('::');
                    setTargetRoomId(rId || '');
                    setTargetBedId(bId || '');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                >
                  <option value="">-- Choose Vacant Room & Bed --</option>
                  {allVacantBeds.map((v, vIndex) => (
                    <option key={`${v.roomId}-${v.bedId}-${vIndex}`} value={`${v.roomId}::${v.bedId}`}>
                      Floor {v.floor} - Room {v.roomNumber} ({v.bedLabel}) - ₹{v.price}/mo
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={!targetRoomId || !targetBedId}
                onClick={handleConfirmTransfer}
                className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20"
              >
                Execute Room Transfer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
