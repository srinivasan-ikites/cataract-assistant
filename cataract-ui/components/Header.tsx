import React from 'react';
import { User, Calendar, ChevronRight } from 'lucide-react';
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
  const { classes } = useTheme();

  return (
    <header className={`w-full ${classes.headerBg} h-20 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors duration-300`}>
      {/* Interactive Patient Profile Section */}
      <div
        className="flex items-center gap-4 group cursor-pointer p-2 -ml-2 rounded-xl hover:bg-white/50 transition-all duration-200"
        onClick={onProfileClick}
        role="button"
        aria-label="Open Patient Profile"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${classes.headerIconContainer} transition-transform group-hover:scale-105 shadow-sm`}>
          <User size={20} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Patient</span>
            <span className="text-sm font-bold text-slate-800 leading-tight">{patientName}</span>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">DOB</span>
            <span className="text-xs font-medium text-slate-600">{patientDob}</span>
          </div>
          <ChevronRight size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
        </div>
      </div>

      <div className="text-right">
        <h1 className={`text-xl md:text-2xl font-normal ${classes.headerText} tracking-tight`}>
          Cataract Surgery Guide
        </h1>
      </div>
    </header>
  );
};

export default Header;