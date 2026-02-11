import React from 'react';
import { Phone, Eye, Stethoscope, ShieldCheck } from 'lucide-react';
import { useTheme } from '../theme';
import Logo from './Logo';
import type { Clinic, Patient } from '../services/api';

type FooterProps = {
  clinic: Clinic | null;
  patient: Patient | null;
};

const Footer: React.FC<FooterProps> = ({ clinic, patient }) => {
  const { classes } = useTheme();

  const clinicProfile = clinic?.clinic_profile;
  const staff = clinic?.staff_directory || [];

  const surgeonId =
    (patient as any)?.surgical_recommendations_by_doctor?.doctor_ref_id ||
    (patient as any)?.extra?.surgical_recommendations_by_doctor?.doctor_ref_id;
  const counselorId =
    (patient as any)?.surgical_recommendations_by_doctor?.counselor_ref_id ||
    (patient as any)?.extra?.surgical_recommendations_by_doctor?.counselor_ref_id;

  const surgeon =
    (surgeonId && staff.find((s) => s.provider_id === surgeonId)) ||
    staff.find((s) => (s.role || '').toLowerCase().includes('surgeon')) ||
    staff.find((s) => (s.role || '').toLowerCase().includes('primary provider')) ||
    null;

  const counselor =
    (counselorId && staff.find((s) => s.provider_id === counselorId)) ||
    staff.find((s) => (s.role || '').toLowerCase().includes('counselor')) ||
    null;

  const clinicName = clinicProfile?.name || 'Clinic';
  const clinicTagline = clinicProfile?.parent_organization || 'Excellence in Eye Care';
  const clinicLogoUrl = clinicProfile?.branding?.logo_url;
  const phone = clinicProfile?.contact_info?.phone_work || 'Contact clinic';

  return (
    <footer className={`w-full ${classes.footerBg} text-slate-200 mt-auto`}>
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-sm">

          {/* Clinic identity */}
          <div className="flex items-center gap-3">
            {clinicLogoUrl ? (
              <img
                src={clinicLogoUrl}
                alt={clinicName}
                className="w-10 h-10 rounded-full object-contain bg-white/10 p-1"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full ${classes.footerAccent} flex items-center justify-center`}>
                <Eye size={18} />
              </div>
            )}
            <div>
              <p className="font-semibold text-white">{clinicName}</p>
              <p className="text-slate-400">{clinicTagline}</p>
            </div>
          </div>

          {/* Surgeon */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${classes.footerAccent} flex items-center justify-center`}>
              <Stethoscope size={18} />
            </div>
            <div>
              <p className="font-semibold text-white">{surgeon?.name || 'Surgeon'}</p>
              <p className="text-slate-400">{surgeon?.role || 'Primary Provider / Surgeon'}</p>
            </div>
          </div>

          {/* Contact */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${classes.footerAccent} flex items-center justify-center`}>
              <Phone size={18} />
            </div>
            <div className="text-right md:text-left">
              <p className="font-semibold text-white">{counselor?.name || 'Surgical Counselor'}</p>
              {clinicProfile?.contact_info?.phone_work ? (
                <a
                  href={`tel:${clinicProfile.contact_info.phone_work.replace(/[^0-9+]/g, '')}`}
                  className={`${classes.footerLink} transition-colors`}
                >
                  {phone}
                </a>
              ) : (
                <span className="text-slate-400">{phone}</span>
              )}
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-4 border-t ${classes.footerBorder}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 text-xs text-slate-500">
            <div className={`flex items-center gap-2 ${classes.footerIcon}`}>
              <ShieldCheck size={14} />
              <span>Trusted cataract care</span>
            </div>
            <span className="hidden md:inline text-slate-700">&middot;</span>
            <div className="text-slate-500">&copy; {new Date().getFullYear()} {clinicName}. All rights reserved.</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Powered by</span>
            <Logo size="sm" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
