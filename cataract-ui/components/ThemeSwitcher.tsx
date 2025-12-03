import React, { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme, THEMES } from '../theme';

const ThemeSwitcher: React.FC = () => {
  const { currentTheme, setTheme, classes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const colorMap: Record<string, string> = {
    default: 'bg-blue-600',
    magenta: 'bg-pink-600',
    lavender: 'bg-violet-600',
    turquoise: 'bg-cyan-600',
    gradient: 'bg-gradient-to-br from-cyan-400 to-violet-600',
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-4">
      {/* Speed Dial Menu */}
      <div 
        className={`flex flex-col gap-3 transition-all duration-200 origin-bottom-left ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-10 pointer-events-none'
        }`}
      >
        {Object.values(THEMES).map((theme) => (
          <div key={theme.id} className="flex items-center gap-3 group">
            <button
              onClick={() => {
                setTheme(theme.id);
                setIsOpen(false);
              }}
              className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-transform hover:scale-110 ${colorMap[theme.id] || 'bg-slate-400'}`}
            >
               {currentTheme.id === theme.id && <Check size={16} className="text-white" />}
            </button>
            <span className="bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-sm whitespace-nowrap">
              {theme.name}
            </span>
          </div>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center text-white transition-all duration-300 hover:shadow-xl active:scale-95 ${
           isOpen ? 'bg-slate-800 rotate-90 rounded-[20px]' : classes.fabBg
        }`}
        aria-label="Change Theme"
      >
        <Palette size={24} />
      </button>
    </div>
  );
};

export default ThemeSwitcher;