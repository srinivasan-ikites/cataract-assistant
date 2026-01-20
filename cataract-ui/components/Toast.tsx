import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast Provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id, duration: toast.duration ?? 4000 };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const success = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message, duration: 6000 });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message, duration: 5000 });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Hook to use toast
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Individual Toast Item
const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onRemove, 300);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  const config = {
    success: {
      icon: <CheckCircle2 size={20} />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconColor: 'text-emerald-500',
      titleColor: 'text-emerald-800',
      msgColor: 'text-emerald-600',
      progressBg: 'bg-emerald-400',
    },
    error: {
      icon: <AlertCircle size={20} />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: 'text-red-500',
      titleColor: 'text-red-800',
      msgColor: 'text-red-600',
      progressBg: 'bg-red-400',
    },
    warning: {
      icon: <AlertTriangle size={20} />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-500',
      titleColor: 'text-amber-800',
      msgColor: 'text-amber-600',
      progressBg: 'bg-amber-400',
    },
    info: {
      icon: <Info size={20} />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-800',
      msgColor: 'text-blue-600',
      progressBg: 'bg-blue-400',
    },
  };

  const c = config[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden w-80 rounded-xl border shadow-lg backdrop-blur-sm
        ${c.bg} ${c.border}
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="p-4 flex items-start gap-3">
        <div className={`flex-shrink-0 ${c.iconColor}`}>{c.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${c.titleColor}`}>{toast.title}</p>
          {toast.message && (
            <p className={`text-xs mt-0.5 ${c.msgColor}`}>{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-black/5">
        <div
          className={`h-full ${c.progressBg} transition-all ease-linear`}
          style={{
            width: isVisible && !isExiting ? '0%' : '100%',
            transitionDuration: `${toast.duration}ms`,
          }}
        />
      </div>
    </div>
  );
};

// Toast Container
const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
};

export default ToastProvider;
