import React, { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  iconClassName?: string;
  expanded: boolean;
  onToggle: () => void;
  maxHeight?: string;
  bodyClassName?: string;
  children: ReactNode;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  subtitle,
  icon,
  iconClassName,
  expanded,
  onToggle,
  maxHeight = '1200px',
  bodyClassName = 'px-5 pb-5 space-y-3',
  children,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClassName || 'bg-slate-50 text-slate-500'}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
      </button>
      <div
        className="transition-all duration-200 ease-out overflow-hidden"
        style={{ maxHeight: expanded ? maxHeight : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className={bodyClassName}>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleCard;


