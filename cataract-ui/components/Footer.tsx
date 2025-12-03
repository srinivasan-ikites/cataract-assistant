
import React from 'react';
import { Phone, Building2, Stethoscope } from 'lucide-react';
import { useTheme } from '../theme';

const Footer: React.FC = () => {
  const { classes } = useTheme();

  return (
    <footer className="w-full bg-slate-900 text-slate-300 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
          
          <div className="flex items-center gap-3">
            <Building2 size={20} className={`${classes.footerIcon} transition-colors duration-300`} />
            <div>
              <p className="font-semibold text-white">Visionary Eye Center</p>
              <p className="text-slate-400">Excellence in Eye Care</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Stethoscope size={20} className={`${classes.footerIcon} transition-colors duration-300`} />
            <div>
              <p className="font-semibold text-white">Dr. Sarah Mitchell, MD</p>
              <p className="text-slate-400">Chief Surgeon</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Phone size={20} className={`${classes.footerIcon} transition-colors duration-300`} />
            <div className="text-right md:text-left">
              <p className="font-semibold text-white">Surgical Counselor</p>
              <a href="tel:+15550123456" className={`hover:${classes.footerIcon} transition-colors`}>555-012-3456</a>
            </div>
          </div>

        </div>
        <div className="border-t border-slate-800 mt-6 pt-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Visionary Eye Center. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
