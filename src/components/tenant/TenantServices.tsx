import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { weeklyMenu } from '../../data/initialData';
import { MaintenanceTicket } from '../../types';
import {
  Utensils,
  Wrench,
  Clock,
  Plus,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Shield,
  ChevronRight,
  Coffee,
  Sun,
  Moon,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const TenantServices: React.FC = () => {
  const { activeTenant, tickets, raiseTicket, settings, notices } = usePG();

  // Current Day of Week
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = days[new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState(todayName);

  // New ticket state
  const [category, setCategory] = useState<MaintenanceTicket['category']>('Air Conditioner');
  const [priority, setPriority] = useState<MaintenanceTicket['priority']>('Medium');
  const [description, setDescription] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const tenantTickets = tickets.filter((t) => t.tenantId === activeTenant?.id);
  const activeMenu = weeklyMenu.find((m) => m.day === selectedDay) || weeklyMenu[0];

  const handleRaiseTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !description.trim()) return;

    raiseTicket({
      tenantId: activeTenant.id,
      tenantName: activeTenant.name,
      roomNumber: activeTenant.roomNumber || 'N/A',
      bedLabel: activeTenant.bedLabel || 'Bed',
      floor: activeTenant.floor || 1,
      category,
      priority,
      description: description.trim(),
    });

    setDescription('');
    setIsSuccess(true);
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
    setTimeout(() => setIsSuccess(false), 4000);
  };

  return (
    <div id="tenant-services-view" className="space-y-6 animate-in fade-in text-slate-900">
      
      {/* SECTION 1: DAILY MESS & FOOD MENU - Royal Blue & White */}
      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-800 border border-brand-200 text-xs font-bold">
                Weekly Meal Planner
              </span>
              <span className="text-xs text-slate-500 font-semibold">North & South Indian Gourmet</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1.5 flex items-center space-x-2">
              <Utensils className="w-5 h-5 text-brand-700" />
              <span>Mess & Dining Timetable</span>
            </h2>
          </div>

          {/* Days Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto max-w-full">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedDay === day
                    ? 'bg-brand-700 text-white shadow-md shadow-brand-700/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Day Meals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* Breakfast */}
          <div className="bg-brand-50/60 p-5 rounded-2xl border border-brand-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Coffee className="w-4 h-4 text-brand-700" />
                <span className="font-extrabold text-xs text-brand-900 uppercase">Breakfast</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                7:30 AM - 10:00 AM
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900">{activeMenu.breakfast}</p>
            <p className="text-[11px] text-slate-500">Includes Tea, Filter Coffee & Warm Milk</p>
          </div>

          {/* Lunch */}
          <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sun className="w-4 h-4 text-amber-700" />
                <span className="font-extrabold text-xs text-amber-900 uppercase">Lunch</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                12:30 PM - 2:30 PM
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900">{activeMenu.lunch}</p>
            <p className="text-[11px] text-slate-500">Fresh Salad, Curd & Papad</p>
          </div>

          {/* Dinner */}
          <div className="bg-indigo-50/60 p-5 rounded-2xl border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Moon className="w-4 h-4 text-indigo-700" />
                <span className="font-extrabold text-xs text-indigo-900 uppercase">Dinner</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                7:30 PM - 10:00 PM
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900">{activeMenu.dinner}</p>
            <p className="text-[11px] text-slate-500">Includes Hot Phulkas & Sweet Dessert</p>
          </div>

        </div>
      </div>

      {/* SECTION 2: MAINTENANCE TICKETS & COMPLAINTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Raise Ticket Form */}
        <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Raise Room Maintenance Ticket</h3>
              <p className="text-xs text-slate-500">AC, plumbing, electrical, cleaning or Wi-Fi requests</p>
            </div>
          </div>

          <form onSubmit={handleRaiseTicket} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Issue Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600"
                >
                  <option value="Air Conditioner">Air Conditioner (AC)</option>
                  <option value="Plumbing / Washroom">Plumbing / Washroom</option>
                  <option value="Electrical & Power">Electrical & Power</option>
                  <option value="Wi-Fi / Internet">Wi-Fi / Internet</option>
                  <option value="Housekeeping / Cleaning">Housekeeping / Cleaning</option>
                  <option value="Bed & Furniture">Bed & Furniture</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Urgency Priority *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600"
                >
                  <option value="Low">Low - Normal Request</option>
                  <option value="Medium">Medium - Needs Attention</option>
                  <option value="High">High - Urgent (Same Day)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Describe the Issue *</label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. AC cooling is slow, or bathroom tap needs washer replacement..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-brand-600 shadow-sm"
              />
            </div>

            {isSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ticket registered! Warden and maintenance staff have been alerted.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-700/20 flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Maintenance Ticket</span>
            </button>
          </form>
        </div>

        {/* My Open Tickets Ledger */}
        <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">My Maintenance Ticket Status</h3>
                <p className="text-xs text-slate-500">Live progress on raised complaints</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-800 font-bold border border-brand-200">
              {tenantTickets.length} Total
            </span>
          </div>

          <div className="space-y-3">
            {tenantTickets.length === 0 ? (
              <div className="p-8 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <span>No active tickets. Everything in Room {activeTenant?.roomNumber} is running great!</span>
              </div>
            ) : (
              tenantTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{ticket.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ticket.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ticket.status === 'In Progress'
                        ? 'bg-brand-100 text-brand-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-slate-600">{ticket.description}</p>
                  <p className="text-[10px] text-slate-400">Raised: {ticket.createdAt}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
