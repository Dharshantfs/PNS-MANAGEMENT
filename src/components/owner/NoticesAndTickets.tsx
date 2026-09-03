import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Notice, MaintenanceTicket } from '../../types';
import {
  Bell,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  X,
  MessageSquare,
} from 'lucide-react';

export const NoticesAndTickets: React.FC = () => {
  const { notices, tickets, addNotice, deleteNotice, updateTicketStatus } = usePG();
  const [isAddNoticeOpen, setIsAddNoticeOpen] = useState(false);

  // New notice form state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<Notice['category']>('General');
  const [noticeFloor, setNoticeFloor] = useState<string>('all');
  const [noticeUrgent, setNoticeUrgent] = useState(false);

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) return;

    addNotice({
      title: noticeTitle.trim(),
      content: noticeContent.trim(),
      category: noticeCategory,
      floorTarget: noticeFloor === 'all' ? 'all' : Number(noticeFloor),
      urgent: noticeUrgent,
      author: 'PNS PG Management',
    });

    setIsAddNoticeOpen(false);
    setNoticeTitle('');
    setNoticeContent('');
  };

  return (
    <div id="notices-and-tickets-view" className="space-y-6 animate-in fade-in text-slate-900">
      
      {/* SECTION 1: BROADCAST NOTICES - Royal Blue & White */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">PG Notice Board & Announcements</h2>
              <p className="text-xs text-slate-500">Post announcements to all residents or specific floors</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddNoticeOpen(true)}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-blue-700/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Post Notice</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notices.length === 0 ? (
            <div className="col-span-full p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
              No active notices posted.
            </div>
          ) : (
            notices.map((n) => (
              <div
                key={n.id}
                className={`p-5 rounded-2xl border space-y-2 text-xs flex flex-col justify-between ${
                  n.urgent
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {n.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteNotice(n.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 mt-2">{n.title}</h3>
                  <p className="text-slate-600 mt-1 leading-relaxed">{n.content}</p>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-[10px] text-slate-400">
                  <span>{n.date}</span>
                  <span className="font-semibold">{n.floorTarget === 'all' ? 'All Floors' : `Floor ${n.floorTarget}`}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: MAINTENANCE TICKETS - Royal Blue & White */}
      <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Tenant Maintenance Requests</h2>
            <p className="text-xs text-slate-500">Live ticket queue raised by residents across 4 floors</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.length === 0 ? (
            <div className="col-span-full p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500 border border-slate-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
              <span>All tickets resolved!</span>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{t.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : t.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-slate-700">{t.description}</p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {t.tenantName} • Room {t.roomNumber} ({t.bedLabel})
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{t.createdAt}</span>
                  <select
                    value={t.status}
                    onChange={(e) => updateTicketStatus(t.id, e.target.value as any)}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Notice Modal */}
      {isAddNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blue-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-blue-100 text-slate-900 overflow-hidden">
            <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shadow-sm">
              <h3 className="font-bold text-sm text-white">Post New PG Announcement</h3>
              <button
                type="button"
                onClick={() => setIsAddNoticeOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notice Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deep Cleaning of Water Tanks"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={noticeCategory}
                    onChange={(e) => setNoticeCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="General">General</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Food & Mess">Food & Mess</option>
                    <option value="Payment">Payment</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Floor</label>
                  <select
                    value={noticeFloor}
                    onChange={(e) => setNoticeFloor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="all">All 4 Floors</option>
                    <option value="1">Floor 1</option>
                    <option value="2">Floor 2</option>
                    <option value="3">Floor 3</option>
                    <option value="4">Floor 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notice Details *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Details of the announcement..."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-blue-700/20"
              >
                Broadcast Notice to Residents
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
