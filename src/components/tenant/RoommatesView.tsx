import React from 'react';
import { usePG } from '../../context/PGContext';
import { getSharingLabel, getSharingOccupancy } from '../../lib/roomLabels';
import {
  Users,
  Phone,
  MessageSquare,
  Building,
  MapPin,
  Utensils,
  ShieldCheck,
  Lock,
  BedDouble,
  Sparkles,
  Info,
} from 'lucide-react';

export const RoommatesView: React.FC = () => {
  const { activeTenant, getRoommates, rooms, activeProperty } = usePG();

  if (!activeTenant) {
    return (
      <div className="p-8 text-center bg-white border border-brand-100 rounded-3xl text-slate-900">
        <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold">No active tenant selected.</p>
      </div>
    );
  }

  const roommates = getRoommates(activeTenant.id);
  const currentRoom = rooms.find((r) => r.id === activeTenant.roomId);

  const getWhatsAppUrl = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `Hi ${name}! This is ${activeTenant.name}, your roommate in Room ${activeTenant.roomNumber} at PNS PG.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div id="roommates-view-container" className="space-y-6 animate-in fade-in">
      
      {/* Header Banner with Privacy Guarantee - Royal Blue & White */}
      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4 text-slate-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-800 border border-brand-200 text-xs font-bold">
                Room {activeTenant.roomNumber || 'N/A'} • Floor {activeTenant.floor}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                {getSharingLabel(activeProperty, currentRoom?.sharingId)}
                {currentRoom?.facilities?.includes('ac') ? ' (AC)' : ''}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 mt-1.5 flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-700" />
              <span>My Roommate Contact Directory</span>
            </h1>
          </div>

          <div className="flex items-center space-x-2 text-xs bg-brand-50 px-3.5 py-2 rounded-2xl border border-brand-200 text-brand-900 font-bold">
            <Lock className="w-3.5 h-3.5 text-brand-700" />
            <span>Strict Privacy: Same Room Contacts Only</span>
          </div>
        </div>

        {/* Privacy Callout Banner */}
        <div className="bg-brand-50/60 p-4 rounded-2xl border border-brand-200 flex items-start space-x-3 text-xs text-brand-950">
          <Info className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-xs">
            In accordance with PG privacy policy, you are strictly granted access to the verified contact information of your 
            <strong className="text-brand-900"> direct roommates in Room {activeTenant.roomNumber}</strong> alone. Contact details of occupants in other rooms or floors remain private and protected.
          </p>
        </div>
      </div>

      {/* Roommates Grid */}
      {roommates.length === 0 ? (
        <div className="bg-white border border-brand-100 rounded-3xl p-10 text-center space-y-3 text-slate-900">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
            <BedDouble className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Other Roommates in Room {activeTenant.roomNumber}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {getSharingOccupancy(activeProperty, currentRoom?.sharingId) === 1
              ? 'You are residing in a Private Single Room.'
              : 'The remaining beds in this room are currently vacant and awaiting new tenant allocations.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {roommates.map((roommate) => (
            <div
              key={roommate.id}
              className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm hover:border-brand-300 transition flex flex-col justify-between text-slate-900"
            >
              <div>
                {/* Top Profile Card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={roommate.photoUrl}
                      alt={roommate.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-600 shadow-sm shrink-0"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{roommate.name}</h3>
                      <p className="text-xs text-brand-700 font-bold mt-0.5">
                        {roommate.bedLabel || 'Roommate Bed'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Check-in: {roommate.checkInDate}
                      </p>
                    </div>
                  </div>

                  {roommate.kyc?.status === 'verified' && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center space-x-1 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Aadhaar OK</span>
                    </span>
                  )}
                </div>

                {/* Details Section */}
                <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                      <Building className="w-3.5 h-3.5 text-brand-700" />
                      <span>Profession / Org:</span>
                    </span>
                    <span className="font-bold text-slate-900 truncate max-w-[160px]">
                      {roommate.kyc?.companyOrCollege || roommate.kyc?.occupation || 'Working Professional'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-brand-700" />
                      <span>Hometown:</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                      {roommate.hometown || roommate.kyc?.permanentAddress?.split(',')[0] || 'Bengaluru'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-500 flex items-center space-x-1.5 font-medium">
                      <Utensils className="w-3.5 h-3.5 text-brand-700" />
                      <span>Food Habit:</span>
                    </span>
                    <span className="font-bold text-brand-900">
                      {roommate.kyc?.foodPreference || 'Veg'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 pt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Mobile Contact:</span>
                    <span className="font-mono text-slate-900 font-bold">{roommate.phone}</span>
                  </div>
                </div>
              </div>

              {/* Direct 1-Click Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4 pt-2">
                <a
                  href={`tel:${roommate.phone}`}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border border-slate-300 shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5 text-brand-700" />
                  <span>Call Resident</span>
                </a>

                <a
                  href={getWhatsAppUrl(roommate.phone, roommate.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Chat</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
