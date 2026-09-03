import React from 'react';
import { usePG } from '../context/PGContext';
import {
  Building2,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

interface NavbarProps {}

export const Navbar: React.FC<NavbarProps> = () => {
  const { role, activeTenant, getStats, logout, settings } = usePG();
  const stats = getStats();

  return (
    <header id="app-header" className="sticky top-0 z-40 bg-blue-700 border-b border-blue-800 text-white shadow-md">
      {/* Top Banner / Branding Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & PG Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-blue-700 flex items-center justify-center shadow-md font-black shrink-0">
              <Building2 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">{settings.pgName || 'PG Management'}</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-800 border border-blue-600 text-blue-100 font-semibold">
                  {settings.totalFloors} Floors • {stats.totalBeds} Beds
                </span>
              </div>
              <p className="text-xs text-blue-200">Hostel & Digital Tenant Management Portal</p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-3">
            
            {/* If Owner Mode Badge */}
            {role === 'owner' && (
              <div className="hidden sm:flex items-center space-x-2 bg-blue-800/90 border border-blue-600/80 px-3 py-1.5 rounded-xl text-xs text-white shadow-sm">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span className="font-bold">Admin / Owner Portal</span>
              </div>
            )}

            {/* If Tenant Mode: Display Current Tenant Profile */}
            {role === 'tenant' && (
              <div className="flex items-center space-x-2.5 bg-blue-800/90 border border-blue-600/80 px-3 py-1.5 rounded-xl text-xs text-left text-white shadow-sm">
                <img
                  src={activeTenant?.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={activeTenant?.name || 'Tenant'}
                  className="w-7 h-7 rounded-xl object-cover border-2 border-white/40"
                />
                <div className="hidden md:block">
                  <p className="font-bold text-white leading-none">{activeTenant?.name || 'Tenant Profile'}</p>
                  <p className="text-[10px] text-blue-200 leading-tight mt-0.5 font-medium">
                    Room {activeTenant?.roomNumber || 'Unassigned'} ({activeTenant?.bedLabel || 'Bed'}) • Flr {activeTenant?.floor || 1}
                  </p>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              id="switch-account-modal-btn"
              type="button"
              onClick={() => { logout(); }}
              className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition flex items-center space-x-1.5 font-semibold shadow-sm"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
