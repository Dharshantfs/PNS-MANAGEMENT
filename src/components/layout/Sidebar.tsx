import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  IndianRupee,
  Bell,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Building2,
} from 'lucide-react';

export type OwnerTab = 'dashboard' | 'matrix' | 'tenants' | 'finance' | 'notices' | 'googleforms' | 'settings';

interface SidebarProps {
  activeTab: OwnerTab;
  onChange: (tab: OwnerTab) => void;
  vacantBeds: number;
  pendingKYCCount: number;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{ tab: OwnerTab; label: string; icon: React.ElementType }> = [
  { tab: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { tab: 'matrix', label: 'Rooms', icon: Layers },
  { tab: 'tenants', label: 'Tenants', icon: Users },
  { tab: 'finance', label: 'Money', icon: IndianRupee },
  { tab: 'notices', label: 'Notices', icon: Bell },
  { tab: 'googleforms', label: 'Forms', icon: FileText },
  { tab: 'settings', label: 'Settings', icon: SettingsIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onChange, vacantBeds, pendingKYCCount, onLogout }) => {
  return (
    <aside className="hidden sm:flex flex-col items-center w-20 shrink-0 bg-brand-700 min-h-screen py-4 space-y-1">
      <div className="w-10 h-10 rounded-2xl bg-white text-brand-700 flex items-center justify-center shadow-md mb-3 shrink-0">
        <Building2 className="w-5 h-5" />
      </div>

      <nav className="flex-1 w-full flex flex-col items-center space-y-1 px-2">
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
          const isActive = activeTab === tab;
          const badge =
            tab === 'matrix' && vacantBeds > 0
              ? vacantBeds
              : tab === 'tenants' && pendingKYCCount > 0
              ? pendingKYCCount
              : null;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`relative w-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl text-[10px] font-bold transition ${
                isActive ? 'bg-white text-brand-700 shadow-md' : 'text-brand-100 hover:bg-brand-600'
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
              {badge !== null && (
                <span
                  className={`absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-brand-700 text-white' : 'bg-rose-500 text-white'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="w-full flex flex-col items-center justify-center gap-1 py-2.5 mx-2 rounded-2xl text-[10px] font-bold text-brand-100 hover:bg-brand-600 transition"
        title="Logout"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>
    </aside>
  );
};
