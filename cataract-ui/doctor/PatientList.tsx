import React, { useState, useEffect } from 'react';
import {
  Plus,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Filter,
  Users,
  Search,
  ChevronRight
} from 'lucide-react';
import { api, Patient } from '../services/api';
import { Skeleton } from '../components/Loader';

interface PatientListProps {
  onSelectPatient: (id: string, allPatientIds?: string[]) => void;
  clinicId: string;
}

interface PatientListItem extends Patient {
  status: 'new' | 'extracted' | 'reviewed';
  lastUpdated: string;
}

const PatientList: React.FC<PatientListProps> = ({ onSelectPatient, clinicId }) => {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All Patients');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const rawPatients = await api.getPatients();

        // Transform and add dummy patients for demo
        const list: PatientListItem[] = [
          ...rawPatients.map(p => ({
            ...p,
            status: (p.patient_id === '1245583' ? 'extracted' : 'reviewed') as any,
            lastUpdated: 'Today, 9:41 AM'
          })),
          {
            patient_id: '882190',
            name: { first: 'John', last: 'Doe' },
            dob: '1992-05-12', // 32 years
            status: 'new',
            lastUpdated: 'Today, 9:41 AM'
          } as PatientListItem,
          {
            patient_id: '9921',
            name: { first: 'Sarah', last: 'Smith' },
            dob: '1996-11-20', // 28 years
            status: 'reviewed', // Stable
            lastUpdated: 'Yesterday'
          } as PatientListItem,
          {
            patient_id: '1024',
            name: { first: 'Michael', last: 'King' },
            dob: '1979-05-12', // 45 years
            status: 'reviewed',
            lastUpdated: 'Oct 24'
          } as PatientListItem,
          {
            patient_id: '5512',
            name: { first: 'Robert', last: 'Fox' },
            dob: '1963-05-12', // 61 years
            status: 'new', // Critical in demo
            lastUpdated: 'Oct 22'
          } as PatientListItem,
          {
            patient_id: '1245583',
            name: { first: 'Lata', last: 'Bhagia' },
            dob: '1956-01-20', // 68 years
            status: 'new',
            lastUpdated: 'Just now'
          } as PatientListItem
        ];

        setPatients(list);
      } catch (err) {
        console.error('Failed to load patients', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [clinicId]);

  const getStatusBadge = (status: PatientListItem['status'], pid?: string) => {
    // Standardized badge styling
    const badgeBase = 'inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide';

    // Mapping our status to the image status labels
    if (pid === '5512') {
      return (
        <span className={`${badgeBase} bg-rose-100 text-rose-700 shadow-[0_4px_12px_-6px_rgba(244,63,94,0.45)]`}>
          CRITICAL
        </span>
      );
    }

    switch (status) {
      case 'new':
        return (
          <span className={`${badgeBase} bg-amber-100 text-amber-700 shadow-[0_4px_12px_-6px_rgba(251,191,36,0.35)]`}>
            PENDING
          </span>
        );
      case 'extracted':
        return (
          <span className={`${badgeBase} bg-blue-100 text-blue-700 shadow-[0_4px_12px_-6px_rgba(37,99,235,0.35)]`}>
            REVIEWED
          </span>
        );
      case 'reviewed':
        return (
          <span className={`${badgeBase} bg-emerald-100 text-emerald-700 shadow-[0_4px_12px_-6px_rgba(16,185,129,0.35)]`}>
            STABLE
          </span>
        );
    }
  };

  const getAge = (dob: string) => {
    const year = new Date(dob).getFullYear();
    const current = new Date().getFullYear();
    return current - year;
  };

  const filters = ['All Patients', 'Pending Review', 'Recent', 'Critical'];

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden animate-[fadeIn_0.5s_ease-out]">
      <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Recent Patients</h3>
          <p className="text-sm text-slate-400 font-medium mt-1">Manage patient records and OCR status</p>
        </div>
        <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-1">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeFilter === filter
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-50'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
              <th className="px-10 py-6">PATIENT NAME</th>
              <th className="px-6 py-6">ID & AGE</th>
              <th className="px-6 py-6">STATUS</th>
              <th className="px-6 py-6">LAST UPDATE</th>
              <th className="px-10 py-6 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              // Skeleton loading rows
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <Skeleton width="w-11" height="h-11" circle />
                      <div className="space-y-2">
                        <Skeleton width="w-32" height="h-4" />
                        <Skeleton width="w-20" height="h-3" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="space-y-2">
                      <Skeleton width="w-20" height="h-4" />
                      <Skeleton width="w-24" height="h-3" />
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <Skeleton width="w-20" height="h-7" className="rounded-lg" />
                  </td>
                  <td className="px-6 py-6">
                    <Skeleton width="w-24" height="h-4" />
                  </td>
                  <td className="px-10 py-6 text-right">
                    <Skeleton width="w-10" height="h-10" className="rounded-xl ml-auto" />
                  </td>
                </tr>
              ))
            ) : patients.map((patient) => (
              <tr
                key={patient.patient_id}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                onClick={() => onSelectPatient(patient.patient_id, patients.map(p => p.patient_id))}
              >
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm overflow-hidden">
                      {patient.patient_id === '9921' || patient.patient_id === '1024' || patient.patient_id === '5512' ? (
                        <img src={`https://i.pravatar.cc/100?u=${patient.patient_id}`} alt="Patient" className="w-full h-full object-cover" />
                      ) : (
                        <span>{patient.name.first[0]}{patient.name.last[0]}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {patient.name.first} {patient.name.last}
                      </p>
                      <p className="text-xs text-slate-400 font-medium tracking-tight mt-0.5">
                        {patient.patient_id === '9921' ? 'OCR Scanned' : patient.patient_id === '1024' ? 'Lab Results' : patient.patient_id === '5512' ? 'Emergency' : 'Manual Entry'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <p className="text-sm font-bold text-slate-700">#{patient.patient_id}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {getAge(patient.dob)} Years • {patient.patient_id === '9921' ? 'Female' : 'Male'}
                  </p>
                </td>
                <td className="px-6 py-6">
                  {getStatusBadge(patient.status, patient.patient_id)}
                </td>
                <td className="px-6 py-6">
                  <p className="text-sm font-bold text-slate-700">{patient.lastUpdated}</p>
                </td>
                <td className="px-10 py-6 text-right">
                  <button className="p-2.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                    <ChevronRight size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-10 py-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Showing 4 of 128 patients
        </span>
        <div className="flex gap-4">
          <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
            <ChevronRight size={18} className="rotate-180" />
          </button>
          <button className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientList;

