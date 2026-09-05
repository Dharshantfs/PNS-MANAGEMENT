import React, { useMemo, useState } from 'react';
import { usePG } from '../../context/PGContext';
import { downloadCsv } from '../../lib/exportCsv';
import { History, Download, Search, User, ShieldCheck } from 'lucide-react';

// Turns an action key like "kyc.approve" into "Kyc → Approve" - readable
// without having to hardcode a label for every ActivityAction in types.ts.
const formatAction = (action: string): string =>
  action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' → ');

export const ActivityLogPage: React.FC = () => {
  const { activityLogs, settings } = usePG();

  const [searchTerm, setSearchTerm] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const actors = useMemo(
    () => Array.from(new Set(activityLogs.map((l) => l.actorName))).sort(),
    [activityLogs]
  );
  const actions = useMemo(
    () => Array.from(new Set(activityLogs.map((l) => l.action))).sort(),
    [activityLogs]
  );

  const filtered = useMemo(
    () =>
      activityLogs.filter((l) => {
        if (actorFilter !== 'all' && l.actorName !== actorFilter) return false;
        if (actionFilter !== 'all' && l.action !== actionFilter) return false;
        if (searchTerm && !l.summary.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      }),
    [activityLogs, actorFilter, actionFilter, searchTerm]
  );

  const exportCsv = () => {
    downloadCsv(
      `activity-log-${settings.pgName}`,
      ['Timestamp', 'Actor', 'Role', 'Action', 'Details'],
      filtered.map((l) => [new Date(l.createdAt).toLocaleString('en-IN'), l.actorName, l.actorRole, formatAction(l.action), l.summary])
    );
  };

  return (
    <div id="activity-log-view" className="space-y-6 animate-in fade-in text-slate-900">
      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <History className="w-5 h-5 text-brand-700" />
              <span>Activity Log</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              What every owner and staff account did in this property - tenants, rooms, payments, dues, settings, and team invites.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-md shadow-brand-700/20 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-brand-600"
            />
          </div>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
          >
            <option value="all">All Team Members</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
          >
            <option value="all">All Action Types</option>
            {actions.map((a) => (
              <option key={a} value={a}>{formatAction(a)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-brand-100 rounded-3xl p-6 shadow-sm space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-2 px-3">When</th>
                <th className="py-2 px-3">Who</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 px-3 text-center text-slate-500">
                    {activityLogs.length === 0
                      ? 'No activity recorded yet - entries appear here as staff and co-owner accounts use the app.'
                      : 'No entries match your filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                        {l.actorRole === 'owner' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-700" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        {l.actorName}
                      </span>
                      <span className="block text-[10px] text-slate-400 capitalize">{l.actorRole}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 font-bold border border-brand-200 whitespace-nowrap">
                        {formatAction(l.action)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{l.summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
