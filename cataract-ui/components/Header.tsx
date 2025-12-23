import React from 'react';
import { User, Calendar, Building2, ShieldCheck } from 'lucide-react';
import { useTheme } from '../theme';

interface HeaderProps {
  onProfileClick: () => void;
  patientName?: string;
  patientId?: string;
  patientDob?: string;
}

const Header: React.FC<HeaderProps> = ({
  onProfileClick,
  patientName = "Jane Doe",
  patientId = "MRN-882401",
  patientDob = "Jan 15, 1954"
}) => {
  const { classes, currentTheme } = useTheme();

  const accentMap: Record<string, { avatar: string; badge: string; badgeIcon: string; guidePill: string }> = {
    default: {
      avatar: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      badge: 'bg-blue-600',
      badgeIcon: 'text-white',
      guidePill: 'bg-blue-50 text-blue-900 border-blue-100'
    },
    magenta: {
      avatar: 'bg-gradient-to-br from-pink-500 to-rose-600',
      badge: 'bg-pink-600',
      badgeIcon: 'text-white',
      guidePill: 'bg-pink-50 text-pink-900 border-pink-100'
    },
    lavender: {
      avatar: 'bg-gradient-to-br from-violet-500 to-purple-600',
      badge: 'bg-violet-600',
      badgeIcon: 'text-white',
      guidePill: 'bg-violet-50 text-violet-900 border-violet-100'
    },
    turquoise: {
      avatar: 'bg-gradient-to-br from-cyan-500 to-teal-600',
      badge: 'bg-cyan-600',
      badgeIcon: 'text-white',
      guidePill: 'bg-cyan-50 text-cyan-900 border-cyan-100'
    },
    gradient: {
      avatar: 'bg-gradient-to-br from-cyan-400 to-violet-600',
      badge: 'bg-gradient-to-r from-cyan-500 to-violet-600',
      badgeIcon: 'text-white',
      guidePill: 'bg-white/70 text-slate-800 border-slate-200'
    }
  };
  const accent = accentMap[currentTheme.id] || accentMap.default;

  return (
    <header className="w-full z-40 px-3 md:px-6 py-3">
      <div className={`w-full rounded-2xl ${classes.headerBg} backdrop-blur-md border border-slate-200/70 shadow-sm flex items-center justify-between px-3 md:px-5 py-2`}>
        
        {/* Patient badge */}
        <button
        onClick={onProfileClick}
          className="flex items-center gap-3 group cursor-pointer"
        aria-label="Open Patient Profile"
      >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent.avatar} text-white shadow-md group-hover:scale-105 transition-transform`}>
            <User size={18} />
        </div>
          <div className="flex items-center gap-3">
          <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Patient</span>
              <span className="text-sm font-semibold text-slate-800 leading-tight">{patientName}</span>
            </div>
            <div className="hidden md:flex flex-col items-start pl-3 border-l border-slate-200">
              <div className="flex items-center gap-1 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <Calendar size={12} /> DOB
              </div>
              <span className="text-xs font-medium text-slate-700">{patientDob}</span>
            </div>
          </div>
        </button>

        {/* Title & clinic pill */}
        <div className="flex items-center gap-3">
          <div className={`hidden md:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border ${accent.guidePill}`}>
            <Building2 size={14} />
            <span>Cataract Surgery Guide</span>
          </div>
          <div className={`flex items-center gap-2 ${accent.badge} ${accent.badgeIcon} rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm`}>
            <ShieldCheck size={14} className={accent.badgeIcon} />
            <span>Education Portal</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;