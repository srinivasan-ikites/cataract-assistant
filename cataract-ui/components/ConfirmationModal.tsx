import React from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';

interface MissingField {
  section: string;
  fields: string[];
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  missingFields?: MissingField[];
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'info' | 'success';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  missingFields,
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
  type = 'warning',
}) => {
  if (!isOpen) return null;

  const typeConfig = {
    warning: {
      icon: <AlertTriangle size={28} />,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      confirmBg: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      icon: <AlertTriangle size={28} />,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
    },
    success: {
      icon: <CheckCircle2 size={28} />,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      confirmBg: 'bg-emerald-600 hover:bg-emerald-700',
    },
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-[slideUp_0.3s_ease-out] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${config.iconBg} ${config.iconColor}`}>
              {config.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              {message && <p className="text-sm text-slate-500 mt-1">{message}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Missing Fields List */}
        {missingFields && missingFields.length > 0 && (
          <div className="px-6 pb-4">
            <div className="bg-slate-50 rounded-xl p-4 max-h-60 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Missing or Incomplete Fields
              </p>
              <div className="space-y-3">
                {missingFields.map((section, idx) => (
                  <div key={idx}>
                    <p className="text-sm font-semibold text-slate-700">{section.section}</p>
                    <ul className="mt-1 space-y-0.5">
                      {section.fields.map((field, fIdx) => (
                        <li key={fIdx} className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-amber-400" />
                          {field}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${config.confirmBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmationModal;
