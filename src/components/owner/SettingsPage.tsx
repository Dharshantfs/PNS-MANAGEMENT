import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { createTeamMember } from '../../services/authService';
import { Building2, Plus, Trash2, Save, Home, Users2, IndianRupee, MapPin, UserPlus, Copy, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    properties,
    activeProperty,
    activePropertyId,
    switchProperty,
    createNewProperty,
    updatePropertySettings,
    addRoomType,
    updateRoomType,
    deleteRoomType,
    addSharingOption,
    updateSharingOption,
    deleteSharingOption,
  } = usePG();

  const [isAddingProperty, setIsAddingProperty] = useState(properties.length === 0);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [newFloors, setNewFloors] = useState(4);

  const [newRoomTypeName, setNewRoomTypeName] = useState('');
  const [newSharingOccupancy, setNewSharingOccupancy] = useState(2);
  const [newSharingRent, setNewSharingRent] = useState(8000);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAddress.trim()) return;
    await createNewProperty({
      name: newName.trim(),
      address: newAddress.trim(),
      city: newCity.trim(),
      state: newState.trim(),
      pincode: newPincode.trim(),
      totalFloors: newFloors,
    });
    setNewName('');
    setNewAddress('');
    setNewCity('');
    setNewState('');
    setNewPincode('');
    setNewFloors(4);
    setIsAddingProperty(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Property Switcher */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>Your Properties</span>
          </h2>
          <button
            type="button"
            onClick={() => setIsAddingProperty((v) => !v)}
            className="px-3 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-xl flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </button>
        </div>

        {properties.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {properties.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchProperty(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                  activePropertyId === p.id
                    ? 'bg-blue-700 text-white border-blue-700 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {isAddingProperty && (
          <form onSubmit={handleCreateProperty} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Property name (e.g. Sunrise PG)" required
              className="col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
            <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Address" required
              className="col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
            <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="City"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
            <input value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="State"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
            <input value={newPincode} onChange={(e) => setNewPincode(e.target.value)} placeholder="Pincode"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
            <input type="number" min={1} max={20} value={newFloors} onChange={(e) => setNewFloors(Number(e.target.value))} placeholder="Total floors"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
            <button type="submit" className="col-span-2 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl">
              Create Property
            </button>
          </form>
        )}
      </div>

      {activeProperty && (
        <>
          {/* Basic property settings */}
          <PropertyBasicsCard />

          {/* Room types */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2 mb-4">
              <Home className="w-4 h-4 text-blue-700" />
              <span>Room Types</span>
            </h2>
            <div className="space-y-2 mb-4">
              {activeProperty.roomTypes.map((rt) => (
                <div key={rt.id} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    value={rt.name}
                    onChange={(e) => updateRoomType(rt.id, { name: e.target.value })}
                    className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                  />
                  <button type="button" onClick={() => deleteRoomType(rt.id)} className="text-rose-500 hover:text-rose-700">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newRoomTypeName}
                onChange={(e) => setNewRoomTypeName(e.target.value)}
                placeholder="e.g. 1BHK, 2BHK, Studio"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => { if (newRoomTypeName.trim()) { addRoomType(newRoomTypeName.trim()); setNewRoomTypeName(''); } }}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Sharing options / rent packages */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2 mb-1">
              <Users2 className="w-4 h-4 text-blue-700" />
              <span>Sharing Options & Rent Packages</span>
            </h2>
            <p className="text-[11px] text-slate-500 mb-4">Up to 6-sharing per room. These become the rent defaults when adding a room in the Bed Matrix.</p>
            <div className="space-y-2 mb-4">
              {activeProperty.sharingOptions
                .slice()
                .sort((a, b) => a.occupancy - b.occupancy)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-900 w-28 shrink-0">{s.label}</span>
                    <span className="text-[10px] text-slate-500 w-20 shrink-0">{s.occupancy} occupant{s.occupancy > 1 ? 's' : ''}</span>
                    <div className="flex items-center flex-1">
                      <IndianRupee className="w-3 h-3 text-slate-400 mr-1" />
                      <input
                        type="number"
                        value={s.defaultRent}
                        onChange={(e) => updateSharingOption(s.id, { defaultRent: Number(e.target.value) })}
                        className="w-24 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none border-b border-transparent focus:border-blue-600"
                      />
                      <span className="text-[10px] text-slate-500 ml-1">/ month</span>
                    </div>
                    <button type="button" onClick={() => deleteSharingOption(s.id)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={newSharingOccupancy}
                onChange={(e) => setNewSharingOccupancy(Number(e.target.value))}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n === 1 ? 'Single' : `${n}-Sharing`}</option>
                ))}
              </select>
              <div className="flex items-center px-3 py-2 rounded-xl border border-slate-300">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <input
                  type="number"
                  value={newSharingRent}
                  onChange={(e) => setNewSharingRent(Number(e.target.value))}
                  placeholder="Default rent"
                  className="w-24 text-xs font-mono focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => addSharingOption(newSharingOccupancy, newSharingRent)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Sharing Option</span>
              </button>
            </div>
          </div>
        </>
      )}

      <TeamAccessCard />
    </div>
  );
};

const PropertyBasicsCard: React.FC = () => {
  const { activeProperty, updatePropertySettings } = usePG();
  const [form, setForm] = useState({
    name: activeProperty?.name || '',
    address: activeProperty?.address || '',
    upiId: activeProperty?.upiId || '',
    totalFloors: activeProperty?.totalFloors || 4,
    gateClosingTime: activeProperty?.gateClosingTime || '10:30 PM',
    rentDueDay: activeProperty?.rentDueDay || 5,
  });
  const [saved, setSaved] = useState(false);

  if (!activeProperty) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePropertySettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
        <MapPin className="w-4 h-4 text-blue-700" />
        <span>Property Settings</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Property Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">UPI ID</label>
          <input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="yourpg@okaxis"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Total Floors</label>
          <input type="number" min={1} max={20} value={form.totalFloors} onChange={(e) => setForm({ ...form, totalFloors: Number(e.target.value) })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Gate Closing Time</label>
          <input value={form.gateClosingTime} onChange={(e) => setForm({ ...form, gateClosingTime: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Rent Due Day (of month)</label>
          <input type="number" min={1} max={28} value={form.rentDueDay} onChange={(e) => setForm({ ...form, rentDueDay: Number(e.target.value) })}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600" />
        </div>
      </div>
      <button type="submit" className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5">
        <Save className="w-3.5 h-3.5" />
        <span>{saved ? 'Saved!' : 'Save Settings'}</span>
      </button>
    </form>
  );
};

// Invite-only admin/staff access - there is no public sign-up (see
// LoginScreen.tsx). Only an existing owner can add another account here;
// the backend (server/app.ts) re-checks this independently of the UI.
const TeamAccessCard: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'staff'>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const res = await createTeamMember(name.trim(), email.trim(), role);
      setResult(res);
      setName('');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to add team member.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-blue-700" />
          <span>Team Access</span>
        </h2>
        <p className="text-[11px] text-slate-500 mt-1">
          Admin login is invite-only - there's no public sign-up. Add a co-owner or staff account here; they'll get a
          one-time temporary password to log in with, then set their own.
        </p>
      </div>

      <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          required
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'owner' | 'staff')}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600"
        >
          <option value="staff">Staff</option>
          <option value="owner">Co-Owner</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{loading ? 'Adding...' : 'Add'}</span>
        </button>
      </form>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">{error}</div>}

      {result && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
          <p className="font-bold text-amber-900">
            Account created. Share this password with them now - it won't be shown again:
          </p>
          <div className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-3 py-2 font-mono">
            <span>
              {result.email} / <strong>{result.tempPassword}</strong>
            </span>
            <button type="button" onClick={handleCopy} className="text-amber-700 hover:text-amber-900 shrink-0 ml-2">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-amber-700">They'll be asked to set their own password the first time they sign in.</p>
        </div>
      )}
    </div>
  );
};
