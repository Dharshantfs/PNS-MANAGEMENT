import React, { useState } from 'react';
import { usePG } from '../../context/PGContext';
import { Tenant } from '../../types';
import { fillAgreementTemplate } from '../../lib/agreementFill';
import { X, Printer, FileText } from 'lucide-react';

interface AgreementModalProps {
  tenant: Tenant;
  onClose: () => void;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({ tenant, onClose }) => {
  const { activeProperty, settings, rooms } = usePG();
  const templates = activeProperty?.agreementTemplates || [];
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');

  const template = templates.find((t) => t.id === templateId);
  const room = rooms.find((r) => r.id === tenant.roomId);
  const filled = template ? fillAgreementTemplate(template.body, tenant, activeProperty, settings, room) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-brand-100 text-slate-900">
        <div className="sticky top-0 bg-brand-700 text-white px-6 py-4 flex items-center justify-between z-10 shadow-sm print:hidden">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5" />
            <h2 className="font-bold text-sm">Generate Rental Agreement - {tenant.name}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!template}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button type="button" onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {templates.length === 0 ? (
            <p className="text-xs text-slate-500">
              No agreement templates yet - add one under Settings &gt; Rental Agreement Templates.
            </p>
          ) : (
            <>
              <div className="print:hidden">
                <label className="block text-xs font-bold text-slate-700 mb-1">Template</label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-600"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Review the filled-in details below before printing/signing - this template hasn't been checked by a lawyer.
                </p>
              </div>

              <div className="bg-white border border-slate-300 rounded-2xl p-6 whitespace-pre-wrap font-serif text-xs leading-relaxed text-slate-900 shadow-sm">
                {filled}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
