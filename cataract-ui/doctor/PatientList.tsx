import React, { useState, useEffect, useCallback } from 'react';
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
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { api, Patient } from '../services/api';
import { Skeleton } from '../components/Loader';
import RegisterPatientModal from './RegisterPatientModal';

interface PatientListProps {
  onSelectPatient: (id: string, allPatientIds?: string[]) => void;
  clinicId: string;
}

interface PatientListItem extends Patient {
  status: 'new' | 'extracted' | 'reviewed';
  lastUpdated: string;
}

// Helper function to determine patient status based on data
const determinePatientStatus = (patient: Patient): PatientListItem['status'] => {
  // If patient has module_content, they've been reviewed
  if (patient.module_content && Object.keys(patient.module_content).length > 0) {
    return 'reviewed';
  }
  // If patient has surgical recommendations, they've been extracted
  if (patient.surgical_recommendations_by_doctor?.recommended_lens_options?.length) {
    return 'extracted';
  }
  // Otherwise, they're new
  return 'new';
};

// Helper function to format last updated timestamp
const formatLastUpdated = (timestamp?: string): string => {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return 'Today';
  if (diffDays < 2) return 'Yesterday';
  if (diffDays < 7) return `${Math.floor(diffDays)} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const PatientList: React.FC<PatientListProps> = ({ onSelectPatient, clinicId }) => {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All Patients');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch patients for this specific clinic
      const rawPatients = await api.getPatients(clinicId);

      // Transform patients - no more dummy data
      const list: PatientListItem[] = rawPatients.map(p => ({
        ...p,
        status: determinePatientStatus(p),
        lastUpdated: formatLastUpdated(p._updated_at)
      }));

      setPatients(list);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Handle successful patient registration
  const handleRegisterSuccess = (patientId: string) => {
    setIsRegisterModalOpen(false);
    // Refresh the patient list and navigate to the new patient
    fetchPatients().then(() => {
      // Navigate to the newly created patient
      onSelectPatient(patientId);
    });
  };

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
    <>
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden animate-[fadeIn_0.5s_ease-out]">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Recent Patients</h3>
            <p className="text-sm text-slate-400 font-medium mt-1">Manage patient records and OCR status</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Register Patient Button */}
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              <UserPlus size={18} />
              Register Patient
            </button>
            {/* Filters */}
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
            ) : patients.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={5} className="px-10 py-16">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Users size={32} className="text-slate-400" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-700 mb-2">No patients yet</h4>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                      Get started by registering your first patient. You can upload their EMR documents to auto-populate their profile.
                    </p>
                    <button
                      onClick={() => setIsRegisterModalOpen(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                      <UserPlus size={18} />
                      Register Your First Patient
                    </button>
                  </div>
                </td>
              </tr>
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

        {patients.length > 0 && (
          <div className="px-10 py-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Showing {patients.length} patient{patients.length !== 1 ? 's' : ''}
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
        )}
      </div>

      {/* Register Patient Modal */}
      <RegisterPatientModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        clinicId={clinicId}
        onSuccess={handleRegisterSuccess}
      />
    </>
  );
};

export default PatientList;

