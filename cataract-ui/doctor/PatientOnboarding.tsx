import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  Eye,
  FileText,
  Save,
  User,
  X,
  Trash2,
  Heart,
  Stethoscope,
  Target,
  Brain,
  Pill,
  Scissors,
  Calendar,
  Clock,
  CheckCircle2,
  Check,
  Zap,
  DollarSign,
  Package,
  Sparkles,
  LayoutDashboard,
  Users,
  Upload,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { api, DoctorContextResponse } from '../services/api';
import CollapsibleCard from './components/CollapsibleCard';
import UploadPanel from './components/UploadPanel';
import { PatientOnboardingSkeleton } from '../components/Loader';
import { useToast } from '../components/Toast';
import DatePicker from '../components/DatePicker';

interface PatientOnboardingProps {
  patientId: string;
  clinicId: string;
  onBack: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const PatientOnboarding: React.FC<PatientOnboardingProps> = ({
  patientId,
  clinicId,
  onBack,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [recentUploads, setRecentUploads] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'extracted' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    alerts: true,
    identity: true,
    medical: true,
    clinical: true,
    lifestyle: true,
    surgical: true,
    postop_meds: false,
    documents: false,
  });
  const [showUploads, setShowUploads] = useState(false);
  const [showAllUploads, setShowAllUploads] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Clinic context - loaded from API
  const [clinicContext, setClinicContext] = useState<DoctorContextResponse | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  // ── Forms & Documents State ──
  const [formTemplates, setFormTemplates] = useState<Record<string, any>>({});
  const [patientForms, setPatientForms] = useState<Record<string, any>>({});
  const [loadingForms, setLoadingForms] = useState(false);
  const [uploadingSignedForm, setUploadingSignedForm] = useState<string | null>(null);
  const signedFormInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const FORM_TYPES = [
    { id: 'medical_clearance', label: 'Medical Clearance', icon: <ShieldCheck size={16} />, color: 'blue' },
    { id: 'iol_selection', label: 'IOL Selection', icon: <Eye size={16} />, color: 'purple' },
    { id: 'consent', label: 'Consent Form', icon: <FileText size={16} />, color: 'slate' },
  ];

  const EYE_CONFIG = [
    { key: 'od_right', label: 'Right Eye (OD)', shortLabel: 'OD', dotColor: 'bg-blue-500', badgeBg: 'bg-blue-50', badgeText: 'text-blue-700' },
    { key: 'os_left', label: 'Left Eye (OS)', shortLabel: 'OS', dotColor: 'bg-emerald-500', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700' },
  ];

  const loadFormsData = useCallback(async () => {
    try {
      setLoadingForms(true);
      const [templatesRes, formsRes] = await Promise.all([
        api.getFormTemplates(clinicId),
        api.getPatientForms(clinicId, patientId),
      ]);
      if (templatesRes?.templates) setFormTemplates(templatesRes.templates);
      if (formsRes?.forms) setPatientForms(formsRes.forms);
    } catch (err) {
      console.error('Failed to load forms data:', err);
    } finally {
      setLoadingForms(false);
    }
  }, [clinicId, patientId]);

  const handleSignedFormUpload = async (formType: string, eye: string, file: File) => {
    const refKey = `${formType}_${eye}`;
    try {
      setUploadingSignedForm(refKey);
      await api.uploadSignedForm(clinicId, patientId, formType, eye, file);
      toast.success('Uploaded', `Signed form uploaded successfully.`);
      await loadFormsData();
    } catch (err: any) {
      toast.error('Upload failed', err.message || 'Could not upload the signed form.');
    } finally {
      setUploadingSignedForm(null);
    }
  };

  const handleFormDownload = async (formType: string, docType: 'blank' | 'signed', eye?: string) => {
    try {
      const url = await api.getFormDownloadUrl(clinicId, formType, docType, patientId, eye);
      if (url) window.open(url, '_blank');
    } catch (err: any) {
      toast.error('Download failed', err.message || 'Could not generate download link.');
    }
  };

  // Calculate age from DOB
  const calculateAge = (dob: string): number | null => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setLoadingContext(true);

        const [patientResult, contextResult, filesResult] = await Promise.all([
          api.getReviewedPatient(clinicId, patientId).catch(() => null),
          api.getDoctorContext(clinicId).catch(() => null),
          api.getPatientFiles(clinicId, patientId).catch(() => ({ files: [], count: 0 }))
        ]);

        if (contextResult) {
          setClinicContext(contextResult);
        }
        setLoadingContext(false);

        // Set recent uploads from Supabase bucket (persistent across refreshes)
        if (filesResult && filesResult.files && filesResult.files.length > 0) {
          setRecentUploads(filesResult.files.map((f: { name: string }) => f.name));
        }

        if (patientResult && patientResult.reviewed) {
          // Preserve the system-generated IDs even when loading reviewed data
          setData({
            ...patientResult.reviewed,
            patient_identity: {
              ...patientResult.reviewed.patient_identity,
              patient_id: patientId,
              clinic_ref_id: clinicId,
            },
          });
          setStatus('saved');
        } else {
          try {
            const extracted = await api.getExtractedPatient(clinicId, patientId);
            if (extracted && extracted.extracted) {
              // Preserve the system-generated IDs even when loading extracted data
              setData({
                ...extracted.extracted,
                patient_identity: {
                  ...extracted.extracted.patient_identity,
                  patient_id: patientId,
                  clinic_ref_id: clinicId,
                },
              });
              setStatus('extracted');
            } else {
              throw new Error('No data');
            }
          } catch {
            setData({
              patient_identity: { patient_id: patientId, clinic_ref_id: clinicId },
              medical_profile: {
                systemic_conditions: [],
                medications_systemic: [],
                allergies: [],
                review_of_systems: [],
                surgical_history: { non_ocular: [], ocular: [] }
              },
              clinical_context: {
                od_right: { biometry: { iol_master: {}, pentacam_topography: {} } },
                os_left: { biometry: { iol_master: {}, pentacam_topography: {} } },
                ocular_comorbidities: [],
                clinical_alerts: []
              },
              lifestyle_profile: { hobbies: [], visual_goals: {}, personality_traits: {}, symptoms_impact: {} },
              surgical_plan: { eligible_packages: [], selected_package_id: '' },
              medications_plan: {},
              documents: { signed_consents: [] }
            });
          }
        }
      } catch (err) {
        console.log('Error loading data:', err);
        setData({
          patient_identity: { patient_id: patientId, clinic_ref_id: clinicId },
          medical_profile: { systemic_conditions: [], medications_systemic: [], allergies: [] },
          clinical_context: { od_right: {}, os_left: {}, clinical_alerts: [] },
          lifestyle_profile: {},
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [clinicId, patientId]);

  // Auto-show upload panel only for new patients (no data yet)
  useEffect(() => {
    if (!loading) {
      setShowUploads(status === 'idle');
    }
  }, [loading, status]);

  // Load forms data when documents section is expanded
  useEffect(() => {
    if (expanded.documents && !loadingForms) {
      loadFormsData();
    }
  }, [expanded.documents, loadFormsData]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.altKey && e.key === 'ArrowRight' && hasNext && onNavigate) {
        e.preventDefault();
        onNavigate('next');
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (data && status !== 'saved' && !saving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onNavigate, data, status, saving]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      // Append new files to existing ones, avoiding duplicates based on name and size
      setFiles((prev) => {
        const uniqueNewFiles = newFiles.filter(
          (newFile) => !prev.some(
            (existing) => existing.name === newFile.name && existing.size === newFile.size
          )
        );
        return [...prev, ...uniqueNewFiles];
      });
      // Update recent uploads to show all selected files
      setRecentUploads((prev) => {
        const newNames = newFiles.map((f) => f.name);
        const uniqueNames = newNames.filter((name) => !prev.includes(name));
        return [...prev, ...uniqueNames];
      });
      // Reset the input value so the same file can be selected again if removed
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const startExtraction = async () => {
    if (files.length === 0) return;
    try {
      setExtracting(true);
      setError(null);
      const res = await api.uploadPatientDocs(clinicId, patientId, files);
      const uploadedNames = (res && (res.files as string[])) || files.map((f) => f.name);

      // Merge extracted data but PRESERVE the original system-generated IDs
      const extractedData = res.extracted ?? res.data ?? res;
      setData((prevData: any) => ({
        ...extractedData,
        patient_identity: {
          ...extractedData.patient_identity,
          // Always keep the system-generated IDs, don't let extraction overwrite them
          patient_id: prevData?.patient_identity?.patient_id || patientId,
          clinic_ref_id: prevData?.patient_identity?.clinic_ref_id || clinicId,
        },
      }));
      setRecentUploads(uploadedNames);
      setStatus('extracted');
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const cleanData = (obj: any): any => {
        if (Array.isArray(obj)) {
          const arr = obj
            .map((v) => cleanData(v))
            .filter((v) => v !== null && v !== '' && (Array.isArray(v) ? v.length > 0 : typeof v === 'object' ? Object.keys(v).length > 0 : true));
          return arr.length > 0 ? arr : null;
        } else if (obj !== null && typeof obj === 'object') {
          const newObj: any = {};
          Object.keys(obj).forEach((k) => {
            const cleaned = cleanData(obj[k]);
            if (cleaned !== null && cleaned !== '' && (Array.isArray(cleaned) ? cleaned.length > 0 : typeof cleaned === 'object' ? Object.keys(cleaned).length > 0 : true)) {
              newObj[k] = cleaned;
            }
          });
          return Object.keys(newObj).length > 0 ? newObj : null;
        }
        return obj;
      };

      const finalData = cleanData(data) || {};
      await api.saveReviewedPatient(clinicId, patientId, finalData);
      setStatus('saved');
      toast.success('Saved', 'Patient data saved successfully');
    } catch (err: any) {
      const errorMsg = err.message || 'Save failed';
      setError(errorMsg);
      toast.error('Save Failed', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete all data for this patient? This cannot be undone.')) return;
    try {
      setDeleting(true);
      setError(null);
      await api.deletePatientData(clinicId, patientId);
      setData({});
      setFiles([]);
      setRecentUploads([]);
      setStatus('idle');
      toast.success('Deleted', 'Patient data has been deleted');
    } catch (err: any) {
      const errorMsg = err.message || 'Delete failed';
      setError(errorMsg);
      toast.error('Delete Failed', errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const updateNestedField = (path: string, value: any) => {
    setStatus('idle');
    setData((prev: any) => {
      const newData = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let current = newData;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = !isNaN(Number(parts[i + 1])) ? [] : {};
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
      return newData;
    });
  };

  // Toggle package eligibility
  const togglePackageEligibility = (packageId: string) => {
    const current = data?.surgical_plan?.eligible_packages || [];
    const newList = current.includes(packageId)
      ? current.filter((id: string) => id !== packageId)
      : [...current, packageId];
    updateNestedField('surgical_plan.eligible_packages', newList);
  };

  // Select package as patient's choice
  const selectPackage = (packageId: string) => {
    updateNestedField('surgical_plan.selected_package_id', packageId);
  };

  const renderTagList = (path: string, label: string, placeholder?: string) => {
    const parts = path.split('.');
    let list = data;
    for (const part of parts) list = list?.[part];
    const arr: string[] = Array.isArray(list) ? list : [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {arr.length > 0 && (
            <span className="text-[10px] font-semibold text-slate-400">{arr.length} items</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {arr.map((item, idx) => (
            <span key={idx} className="px-3 py-1.5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-2 border border-slate-200 shadow-sm">
              {item}
              <button
                onClick={() => {
                  const newList = arr.filter((_, i) => i !== idx);
                  updateNestedField(path, newList);
                }}
                className="hover:text-rose-500 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) {
                updateNestedField(path, [...arr, val]);
                (e.target as HTMLInputElement).value = '';
              }
            }
          }}
        />
      </div>
    );
  };

  const renderField = (
    path: string,
    label: string,
    type: 'text' | 'number' | 'date' | 'select' = 'text',
    options?: string[],
    placeholder?: string,
    disabled?: boolean
  ) => {
    const parts = path.split('.');
    let val = data;
    for (const part of parts) val = val?.[part];
    const isEmpty = val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
    return (
      <div className="group/field relative">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <label className="block text-xs font-bold text-slate-700 transition-colors group-focus-within/field:text-blue-600">
            {label}
          </label>
          {isEmpty && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" title="Not Extracted"></div>}
        </div>
        {type === 'select' ? (
          <div className="relative">
            <select
              value={val || ''}
              onChange={(e) => updateNestedField(path, e.target.value)}
              disabled={disabled}
              className={`w-full bg-white border ${disabled ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700'} rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all appearance-none`}
            >
              <option value="">Select...</option>
              {options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>
        ) : type === 'date' ? (
          <DatePicker
            value={val || ''}
            onChange={(value) => updateNestedField(path, value)}
            placeholder={placeholder || `Select ${label.toLowerCase()}...`}
            disabled={disabled}
            maxDate={path.includes('dob') ? new Date().toISOString().split('T')[0] : undefined}
          />
        ) : (
          <input
            type={type}
            value={val ?? ''}
            onChange={(e) => updateNestedField(path, type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value)}
            disabled={disabled}
            readOnly={disabled}
            className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all ${
              disabled
                ? 'bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed'
                : 'bg-white border-slate-200 text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
            }`}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          />
        )}
      </div>
    );
  };

  const renderToggle = (path: string, label: string) => {
    const parts = path.split('.');
    let val = data;
    for (const part of parts) val = val?.[part];
    return (
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <button
          onClick={() => updateNestedField(path, !val)}
          className={`w-11 h-6 rounded-full transition-all ${val ? 'bg-blue-600' : 'bg-slate-200'}`}
        >
          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  };

  if (loading || loadingContext) {
    return <PatientOnboardingSkeleton />;
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-32">
        <AlertCircle className="text-rose-400" size={32} />
        <p className="font-medium">Failed to load patient data</p>
        <button onClick={onBack} className="text-blue-600 hover:underline text-sm">Go back</button>
      </div>
    );
  }

  const firstName = data?.patient_identity?.first_name || '';
  const middleName = data?.patient_identity?.middle_name || '';
  const lastName = data?.patient_identity?.last_name || '';
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Patient';
  const age = calculateAge(data?.patient_identity?.dob);
  const gender = data?.patient_identity?.gender || '';
  const clinicalAlerts = data?.clinical_context?.clinical_alerts || [];

  // Get packages from clinic context
  const surgicalPackages = clinicContext?.surgical_packages || [];
  const eligiblePackages = data?.surgical_plan?.eligible_packages || [];
  const selectedPackageId = data?.surgical_plan?.selected_package_id || '';

  // Get medications from clinic context (matches doctor-context endpoint response)
  const preOpAntibiotics = clinicContext?.medications?.pre_op?.antibiotics || [];
  const preOpDefaultDays = clinicContext?.medications?.pre_op?.default_start_days_before_surgery || clinicContext?.medications?.pre_op?.default_start_days || 3;
  const postOpAntibiotics = clinicContext?.medications?.post_op?.antibiotics || [];
  const postOpNsaids = clinicContext?.medications?.post_op?.nsaids || [];
  const postOpSteroids = clinicContext?.medications?.post_op?.steroids || [];
  const combinationDrops = clinicContext?.medications?.post_op?.combination_drops || [];
  const glaucomaDrops = clinicContext?.medications?.post_op?.glaucoma_drops || [];
  const droplessOption = clinicContext?.medications?.dropless_option; // Note: dropless_option is at medications level, not post_op
  const frequencyOptions = clinicContext?.medications?.frequency_options || [];

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors group"
        >
          <LayoutDashboard size={14} className="group-hover:scale-110 transition-transform" />
          <span className="font-medium">Dashboard</span>
        </button>
        <ChevronRight size={14} className="text-slate-300" />
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors group"
        >
          <Users size={14} className="group-hover:scale-110 transition-transform" />
          <span className="font-medium">Patients</span>
        </button>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
          <User size={14} className="text-blue-500" />
          {fullName || 'Patient Details'}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all" title="Back">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">
              {firstName.charAt(0)}{lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs font-medium text-slate-400">ID: {data?.patient_identity?.patient_id || patientId}</span>
                {age && <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{age} years</span>}
                {gender && <span className="text-xs font-medium text-slate-400">{gender}</span>}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  status === 'saved' ? 'bg-emerald-100 text-emerald-600' :
                  status === 'extracted' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {status === 'saved' ? 'Reviewed' : status === 'extracted' ? 'Pending Review' : 'New'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => onNavigate('prev')} disabled={!hasPrev} className={`p-2 rounded-lg transition-all ${hasPrev ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-200 cursor-not-allowed'}`} title="Previous (Alt+Left)">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => onNavigate('next')} disabled={!hasNext} className={`p-2 rounded-lg transition-all ${hasNext ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-200 cursor-not-allowed'}`} title="Next (Alt+Right)">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <button onClick={handleDelete} disabled={deleting} className={`p-2.5 rounded-xl transition-all ${deleting ? 'bg-rose-100 text-rose-300 cursor-not-allowed' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`} title="Delete">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setShowUploads((v) => !v)} className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all" title={showUploads ? 'Hide uploads' : 'Show uploads'}>
            {showUploads ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
          <button onClick={handleSave} disabled={!data || status === 'saved' || saving} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${!data || status === 'saved' || saving ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`} title="Save (Ctrl+S)">
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Clinical Alerts */}
      {clinicalAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 overflow-hidden">
          <button
            onClick={() => setExpanded(p => ({ ...p, alerts: !p.alerts }))}
            className="w-full flex items-center justify-between p-4 hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle size={18} className="text-amber-600" /></div>
              <div className="text-left">
                <h3 className="font-bold text-amber-900">Clinical Alerts</h3>
                <p className="text-xs text-amber-600">{clinicalAlerts.length} alert{clinicalAlerts.length > 1 ? 's' : ''} require attention</p>
              </div>
            </div>
            <ChevronDown size={18} className={`text-amber-400 transition-transform ${expanded.alerts ? 'rotate-180' : ''}`} />
          </button>
          {expanded.alerts && (
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {clinicalAlerts.map((alert: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white/60 rounded-xl border border-amber-100">
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-800">{alert.trigger}</p>
                    <p className="text-xs text-amber-600 mt-0.5">{alert.alert_msg}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-12 gap-4">
        <div className={`col-span-12 ${showUploads ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4 lg:max-h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar`}>

          {/* Patient Identity */}
          <CollapsibleCard title="Patient Identity" icon={<User size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200" expanded={expanded.identity} onToggle={() => setExpanded((p) => ({ ...p, identity: !p.identity }))} maxHeight="600px" bodyClassName="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {renderField('patient_identity.first_name', 'First Name')}
              {renderField('patient_identity.middle_name', 'Middle Name')}
              {renderField('patient_identity.last_name', 'Last Name')}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {renderField('patient_identity.dob', 'Date of Birth', 'date')}
              {renderField('patient_identity.gender', 'Gender', 'select', ['Male', 'Female', 'Other'])}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 px-1">Age (Auto-calculated)</label>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-bold text-blue-700">
                  {age ? `${age} years` : 'Enter DOB'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField('patient_identity.patient_id', 'Patient ID', 'text', undefined, undefined, true)}
              {renderField('patient_identity.clinic_ref_id', 'Clinic Reference ID', 'text', undefined, undefined, true)}
            </div>
          </CollapsibleCard>

          {/* Medical Profile */}
          <CollapsibleCard title="Medical Profile" subtitle="Conditions, medications, allergies, surgical history" icon={<Heart size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200" expanded={expanded.medical} onToggle={() => setExpanded((p) => ({ ...p, medical: !p.medical }))} maxHeight="1200px" bodyClassName="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>{renderTagList('medical_profile.systemic_conditions', 'Systemic Conditions', 'Add condition...')}</div>
              <div>{renderTagList('medical_profile.medications_systemic', 'Current Medications', 'Add medication...')}</div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>{renderTagList('medical_profile.allergies', 'Allergies', 'Add allergy...')}</div>
              <div>{renderTagList('medical_profile.review_of_systems', 'Review of Systems', 'Add item...')}</div>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Scissors size={14} />Surgical History</h4>
              <div className="grid grid-cols-2 gap-5">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-2"><Eye size={12} />Ocular Surgeries</p>
                  {renderTagList('medical_profile.surgical_history.ocular', '', 'Add surgery...')}
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-2"><Activity size={12} />Non-Ocular Surgeries</p>
                  {renderTagList('medical_profile.surgical_history.non_ocular', '', 'Add surgery...')}
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* Clinical Context */}
          <CollapsibleCard title="Clinical Context" subtitle="Pathology, visual acuity, biometry" icon={<Stethoscope size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-200" expanded={expanded.clinical} onToggle={() => setExpanded((p) => ({ ...p, clinical: !p.clinical }))} maxHeight="2000px" bodyClassName="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              {/* OD */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">OD</div>
                  <span className="font-bold text-slate-800">Right Eye</span>
                </div>
                {renderField('clinical_context.od_right.pathology', 'Pathology')}
                {renderField('clinical_context.od_right.primary_cataract_type', 'Primary Cataract Type', 'select', ['nuclear_sclerosis', 'cortical', 'posterior_subcapsular', 'combined', 'congenital'])}
                {renderField('clinical_context.od_right.visual_acuity.bcva', 'BCVA (Best Corrected)')}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                  <p className="text-xs font-bold text-blue-700">IOL Master Biometry</p>
                  <div className="grid grid-cols-3 gap-3">
                    {renderField('clinical_context.od_right.biometry.iol_master.axial_length_mm', 'Axial Length (mm)', 'number')}
                    {renderField('clinical_context.od_right.biometry.iol_master.acd_mm', 'ACD (mm)', 'number')}
                    {renderField('clinical_context.od_right.biometry.iol_master.wtw_mm', 'WTW (mm)', 'number')}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField('clinical_context.od_right.biometry.iol_master.flat_k_k1', 'Flat K (K1)', 'number')}
                    {renderField('clinical_context.od_right.biometry.iol_master.steep_k_k2', 'Steep K (K2)', 'number')}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {renderField('clinical_context.od_right.biometry.iol_master.astigmatism_power', 'Astigmatism (D)', 'number')}
                    {renderField('clinical_context.od_right.biometry.iol_master.axis', 'Axis (°)', 'number')}
                    {renderField('clinical_context.od_right.biometry.iol_master.cct_um', 'CCT (μm)', 'number')}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                  <p className="text-xs font-bold text-purple-700">Pentacam / Topography</p>
                  <div className="grid grid-cols-3 gap-3">
                    {renderField('clinical_context.od_right.biometry.pentacam_topography.astigmatism_power', 'Astigmatism (D)', 'number')}
                    {renderField('clinical_context.od_right.biometry.pentacam_topography.axis', 'Axis (°)', 'number')}
                    {renderField('clinical_context.od_right.biometry.pentacam_topography.cct_um', 'CCT / Pachy (μm)', 'number')}
                  </div>
                  {renderField('clinical_context.od_right.biometry.pentacam_topography.belin_ambrosio_score', 'Belin-Ambrosio', 'number')}
                </div>
              </div>

              {/* OS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">OS</div>
                  <span className="font-bold text-slate-800">Left Eye</span>
                </div>
                {renderField('clinical_context.os_left.pathology', 'Pathology')}
                {renderField('clinical_context.os_left.primary_cataract_type', 'Primary Cataract Type', 'select', ['nuclear_sclerosis', 'cortical', 'posterior_subcapsular', 'combined', 'congenital'])}
                {renderField('clinical_context.os_left.visual_acuity.bcva', 'BCVA (Best Corrected)')}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
                  <p className="text-xs font-bold text-emerald-700">IOL Master Biometry</p>
                  <div className="grid grid-cols-3 gap-3">
                    {renderField('clinical_context.os_left.biometry.iol_master.axial_length_mm', 'Axial Length (mm)', 'number')}
                    {renderField('clinical_context.os_left.biometry.iol_master.acd_mm', 'ACD (mm)', 'number')}
                    {renderField('clinical_context.os_left.biometry.iol_master.wtw_mm', 'WTW (mm)', 'number')}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField('clinical_context.os_left.biometry.iol_master.flat_k_k1', 'Flat K (K1)', 'number')}
                    {renderField('clinical_context.os_left.biometry.iol_master.steep_k_k2', 'Steep K (K2)', 'number')}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {renderField('clinical_context.os_left.biometry.iol_master.astigmatism_power', 'Astigmatism (D)', 'number')}
                    {renderField('clinical_context.os_left.biometry.iol_master.axis', 'Axis (°)', 'number')}
                    {renderField('clinical_context.os_left.biometry.iol_master.cct_um', 'CCT (μm)', 'number')}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                  <p className="text-xs font-bold text-purple-700">Pentacam / Topography</p>
                  <div className="grid grid-cols-3 gap-3">
                    {renderField('clinical_context.os_left.biometry.pentacam_topography.astigmatism_power', 'Astigmatism (D)', 'number')}
                    {renderField('clinical_context.os_left.biometry.pentacam_topography.axis', 'Axis (°)', 'number')}
                    {renderField('clinical_context.os_left.biometry.pentacam_topography.cct_um', 'CCT / Pachy (μm)', 'number')}
                  </div>
                  {renderField('clinical_context.os_left.biometry.pentacam_topography.belin_ambrosio_score', 'Belin-Ambrosio', 'number')}
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100">
              {renderTagList('clinical_context.ocular_comorbidities', 'Ocular Comorbidities', 'Add comorbidity...')}
            </div>
          </CollapsibleCard>

          {/* Lifestyle Profile */}
          <CollapsibleCard title="Lifestyle Profile" subtitle="Occupation, hobbies, visual goals" icon={<Target size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200" expanded={expanded.lifestyle} onToggle={() => setExpanded((p) => ({ ...p, lifestyle: !p.lifestyle }))} maxHeight="1000px" bodyClassName="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              {renderField('lifestyle_profile.occupation', 'Occupation')}
              <div>{renderTagList('lifestyle_profile.hobbies', 'Hobbies', 'Add hobby...')}</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-4">
              <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><Eye size={14} />Visual Goals</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderField('lifestyle_profile.visual_goals.primary_zone', 'Primary Vision Range', 'select', ['Distance', 'Intermediate', 'Near', 'All'])}
                {renderField('lifestyle_profile.visual_goals.spectacle_independence_desire', 'Spectacle Independence', 'select', ['None', 'Distance only', 'Reading only', 'Distance and Reading', 'Distance and Computer', 'All ranges of vision'])}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-4">
              <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2"><Brain size={14} />Personality Traits</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderField('lifestyle_profile.personality_traits.perfectionism_score', 'Perfectionism (1-10)', 'number')}
                {renderField('lifestyle_profile.personality_traits.risk_tolerance', 'Risk Tolerance', 'select', ['Low', 'Medium', 'High'])}
              </div>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-4">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2"><AlertCircle size={14} />Symptoms Impact</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderToggle('lifestyle_profile.symptoms_impact.night_driving_difficulty', 'Night Driving Difficulty')}
                {renderToggle('lifestyle_profile.symptoms_impact.glare_halos', 'Glare / Halos')}
              </div>
            </div>
          </CollapsibleCard>

          {/* Surgical Plan - Candidacy Assessment & Package Selection */}
          <CollapsibleCard title="Surgical Plan" subtitle="Assess candidacy and offer packages per eye" icon={<Package size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-purple-200" expanded={expanded.surgical} onToggle={() => setExpanded((p) => ({ ...p, surgical: !p.surgical }))} maxHeight="3500px" bodyClassName="p-6 space-y-6">

            {/* Same Plan Toggle */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Eye size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Same Lens Options for Both Eyes</p>
                  <p className="text-xs text-slate-500">Turn off if each eye needs different lens options (e.g., only one eye has significant astigmatism)</p>
                </div>
              </div>
              <button
                onClick={() => updateNestedField('surgical_plan.same_plan_both_eyes', !data?.surgical_plan?.same_plan_both_eyes)}
                className={`w-14 h-7 rounded-full transition-all ${data?.surgical_plan?.same_plan_both_eyes ? 'bg-purple-600' : 'bg-slate-200'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform ${data?.surgical_plan?.same_plan_both_eyes ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* SECTION 1: Candidacy Assessment */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center">
                  <Target size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Premium Lens Candidacy</h4>
                  <p className="text-xs text-slate-500">Standard monofocal IOL is available for all patients. Select any premium lens types this patient also qualifies for:</p>
                </div>
              </div>

              {data?.surgical_plan?.same_plan_both_eyes ? (
                /* Single view when same plan for both eyes */
                <div className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm font-bold text-purple-800">Both Eyes (OU)</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold">UNIFIED</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { key: 'is_candidate_multifocal', label: 'Multifocal', desc: 'Full spectacle independence', color: 'blue' },
                      { key: 'is_candidate_edof', label: 'EDOF', desc: 'Extended range, fewer halos', color: 'sky' },
                      { key: 'is_candidate_toric', label: 'Toric', desc: 'Astigmatism ≥0.75D', color: 'emerald' },
                      { key: 'is_candidate_lal', label: 'LAL', desc: 'Post-op fine-tuning', color: 'amber' },
                    ].map(item => {
                      const value = data?.surgical_plan?.candidacy_profile?.od_right?.[item.key];
                      const colorClasses: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
                        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', activeBg: 'bg-blue-600' },
                        sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', activeBg: 'bg-sky-600' },
                        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', activeBg: 'bg-emerald-600' },
                        amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', activeBg: 'bg-amber-600' },
                      };
                      const colors = colorClasses[item.color];
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            updateNestedField(`surgical_plan.candidacy_profile.od_right.${item.key}`, !value);
                            updateNestedField(`surgical_plan.candidacy_profile.os_left.${item.key}`, !value);
                          }}
                          className={`p-4 rounded-xl border-2 transition-all ${value ? `${colors.activeBg} border-transparent` : `${colors.bg} ${colors.border} hover:shadow-md`}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-bold ${value ? 'text-white' : colors.text}`}>{item.label}</span>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${value ? 'bg-white/20' : 'bg-white border border-slate-200'}`}>
                              {value && <Check size={14} className="text-white" />}
                            </div>
                          </div>
                          <p className={`text-xs ${value ? 'text-white/80' : 'text-slate-500'}`}>{item.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Split view for each eye */
                <div className="grid grid-cols-2 gap-4">
                  {/* OD (Right Eye) */}
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">OD</div>
                      <div>
                        <span className="text-sm font-bold text-blue-800">Right Eye</span>
                        <span className="block text-[10px] text-blue-500">Oculus Dexter</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'is_candidate_multifocal', label: 'Multifocal', desc: 'Full spectacle independence' },
                        { key: 'is_candidate_edof', label: 'EDOF', desc: 'Extended range, fewer halos' },
                        { key: 'is_candidate_toric', label: 'Toric', desc: 'Astigmatism ≥0.75D' },
                        { key: 'is_candidate_lal', label: 'LAL', desc: 'Post-op adjustment' },
                      ].map(item => {
                        const value = data?.surgical_plan?.candidacy_profile?.od_right?.[item.key];
                        return (
                          <button
                            key={item.key}
                            onClick={() => updateNestedField(`surgical_plan.candidacy_profile.od_right.${item.key}`, !value)}
                            className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${value ? 'bg-blue-600 border-blue-600' : 'bg-white border-blue-100 hover:border-blue-300'}`}
                          >
                            <div>
                              <span className={`text-sm font-semibold ${value ? 'text-white' : 'text-slate-700'}`}>{item.label}</span>
                              <span className={`block text-[10px] ${value ? 'text-blue-100' : 'text-slate-400'}`}>{item.desc}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${value ? 'bg-white/20' : 'border border-slate-200'}`}>
                              {value && <Check size={14} className="text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* OS (Left Eye) */}
                  <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">OS</div>
                      <div>
                        <span className="text-sm font-bold text-emerald-800">Left Eye</span>
                        <span className="block text-[10px] text-emerald-500">Oculus Sinister</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'is_candidate_multifocal', label: 'Multifocal', desc: 'Full spectacle independence' },
                        { key: 'is_candidate_edof', label: 'EDOF', desc: 'Extended range, fewer halos' },
                        { key: 'is_candidate_toric', label: 'Toric', desc: 'Astigmatism ≥0.75D' },
                        { key: 'is_candidate_lal', label: 'LAL', desc: 'Post-op adjustment' },
                      ].map(item => {
                        const value = data?.surgical_plan?.candidacy_profile?.os_left?.[item.key];
                        return (
                          <button
                            key={item.key}
                            onClick={() => updateNestedField(`surgical_plan.candidacy_profile.os_left.${item.key}`, !value)}
                            className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${value ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-emerald-100 hover:border-emerald-300'}`}
                          >
                            <div>
                              <span className={`text-sm font-semibold ${value ? 'text-white' : 'text-slate-700'}`}>{item.label}</span>
                              <span className={`block text-[10px] ${value ? 'text-emerald-100' : 'text-slate-400'}`}>{item.desc}</span>
                            </div>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${value ? 'bg-white/20' : 'border border-slate-200'}`}>
                              {value && <Check size={14} className="text-white" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: Package Selection - Grouped by Category */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center">
                  <Package size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Packages to Offer</h4>
                  <p className="text-xs text-slate-500">Select packages to offer based on candidacy. Packages are grouped by lens category.</p>
                </div>
              </div>

              {/* Packages grouped by category */}
              {(() => {
                if (surgicalPackages.length === 0) {
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">No clinical packages configured</p>
                        <p className="text-xs text-amber-600 mt-0.5">Please go to Clinic Setup → Surgical Packages to add packages before offering them to patients.</p>
                      </div>
                    </div>
                  );
                }

                const samePlanBothEyes = data?.surgical_plan?.same_plan_both_eyes ?? true;
                const odCandidacy = data?.surgical_plan?.candidacy_profile?.od_right || {};
                const osCandidacy = data?.surgical_plan?.candidacy_profile?.os_left || {};
                // Use per-eye packages when toggle is off, otherwise unified
                const offeredPackages = samePlanBothEyes
                  ? (data?.surgical_plan?.offered_packages || [])
                  : (data?.surgical_plan?.offered_packages || []); // For unified summary
                const offeredPackagesOD = data?.surgical_plan?.offered_packages_od || [];
                const offeredPackagesOS = data?.surgical_plan?.offered_packages_os || [];
                const isMultifocalCandidateOD = odCandidacy.is_candidate_multifocal;
                const isEdofCandidateOD = odCandidacy.is_candidate_edof;
                const isToricCandidateOD = odCandidacy.is_candidate_toric;
                const isLalCandidateOD = odCandidacy.is_candidate_lal;
                const isMultifocalCandidateOS = osCandidacy.is_candidate_multifocal;
                const isEdofCandidateOS = osCandidacy.is_candidate_edof;
                const isToricCandidateOS = osCandidacy.is_candidate_toric;
                const isLalCandidateOS = osCandidacy.is_candidate_lal;
                const isMultifocalCandidate = odCandidacy.is_candidate_multifocal || osCandidacy.is_candidate_multifocal;
                const isEdofCandidate = odCandidacy.is_candidate_edof || osCandidacy.is_candidate_edof;
                const isToricCandidate = odCandidacy.is_candidate_toric || osCandidacy.is_candidate_toric;
                const isLalCandidate = odCandidacy.is_candidate_lal || osCandidacy.is_candidate_lal;

                // Define package categories
                const packageCategories = [
                  {
                    id: 'monofocal',
                    title: 'Monofocal',
                    subtitle: 'Single distance focus - Insurance covered',
                    color: 'slate',
                    bgGradient: 'from-slate-50 to-gray-50',
                    borderColor: 'border-slate-200',
                    packages: ['PKG_STD', 'PKG_LASER_LRI'],
                    alwaysShow: true,
                  },
                  {
                    id: 'toric',
                    title: 'Toric',
                    subtitle: 'Distance and astigmatism correction',
                    color: 'emerald',
                    bgGradient: 'from-emerald-50 to-teal-50',
                    borderColor: 'border-emerald-200',
                    packages: ['PKG_TORIC', 'PKG_TORIC_LASER'],
                    alwaysShow: false,
                    showWhen: isToricCandidate,
                  },
                  {
                    id: 'edof',
                    title: 'Extended Depth of Focus (EDOF)',
                    subtitle: 'Excellent intermediate vision with minimal halos',
                    color: 'blue',
                    bgGradient: 'from-blue-50 to-sky-50',
                    borderColor: 'border-blue-200',
                    packages: ['PKG_EDOF', 'PKG_EDOF_LASER'],
                    alwaysShow: false,
                    showWhen: isEdofCandidate,
                  },
                  {
                    id: 'multifocal',
                    title: 'Multifocal',
                    subtitle: 'Near, intermediate, and distance vision',
                    color: 'purple',
                    bgGradient: 'from-purple-50 to-violet-50',
                    borderColor: 'border-purple-200',
                    packages: ['PKG_MULTIFOCAL', 'PKG_MULTIFOCAL_LASER'],
                    alwaysShow: false,
                    showWhen: isMultifocalCandidate,
                  },
                  {
                    id: 'lal',
                    title: 'Light Adjustable Lens (LAL)',
                    subtitle: 'Post-operative customization via UV light',
                    color: 'amber',
                    bgGradient: 'from-amber-50 to-orange-50',
                    borderColor: 'border-amber-200',
                    packages: ['PKG_LAL'],
                    alwaysShow: false,
                    showWhen: isLalCandidate,
                  },
                ];

                const colorClasses: Record<string, { text: string; bg: string; activeBg: string; badge: string }> = {
                  slate: { text: 'text-slate-700', bg: 'bg-slate-100', activeBg: 'bg-slate-600', badge: 'bg-slate-100 text-slate-600' },
                  emerald: { text: 'text-emerald-700', bg: 'bg-emerald-100', activeBg: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-600' },
                  blue: { text: 'text-blue-700', bg: 'bg-blue-100', activeBg: 'bg-blue-600', badge: 'bg-blue-100 text-blue-600' },
                  purple: { text: 'text-purple-700', bg: 'bg-purple-100', activeBg: 'bg-purple-600', badge: 'bg-purple-100 text-purple-600' },
                  amber: { text: 'text-amber-700', bg: 'bg-amber-100', activeBg: 'bg-amber-600', badge: 'bg-amber-100 text-amber-600' },
                };

                const visibleCategories = packageCategories.filter(cat => cat.alwaysShow || cat.showWhen);

                // Helper to get visible categories for a specific eye
                const getVisibleCategoriesForEye = (eye: 'od' | 'os') => {
                  const candidacy = eye === 'od' ? odCandidacy : osCandidacy;
                  return packageCategories.filter(cat => {
                    if (cat.alwaysShow) return true;
                    if (cat.id === 'toric' && candidacy.is_candidate_toric) return true;
                    if (cat.id === 'edof' && candidacy.is_candidate_edof) return true;
                    if (cat.id === 'multifocal' && candidacy.is_candidate_multifocal) return true;
                    if (cat.id === 'lal' && candidacy.is_candidate_lal) return true;
                    return false;
                  });
                };

                // Helper to render package card for per-eye selection
                const renderPerEyePackageCard = (pkg: any, eye: 'od' | 'os', colors: any) => {
                  const packages = eye === 'od' ? offeredPackagesOD : offeredPackagesOS;
                  const fieldPath = eye === 'od' ? 'surgical_plan.offered_packages_od' : 'surgical_plan.offered_packages_os';
                  const isOffered = packages.includes(pkg.package_id);
                  return (
                    <div
                      key={pkg.package_id}
                      onClick={() => {
                        const newList = isOffered
                          ? packages.filter((id: string) => id !== pkg.package_id)
                          : [...packages, pkg.package_id];
                        updateNestedField(fieldPath, newList);
                      }}
                      className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        isOffered
                          ? `${colors.activeBg} border-transparent`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold ${isOffered ? 'text-white' : 'text-slate-800'}`}>
                          {pkg.display_name}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[10px] ${isOffered ? 'text-white/80' : 'text-slate-500'}`}>
                            {pkg.price_cash === 0 ? 'Insurance' : `$${pkg.price_cash.toLocaleString()}`}
                          </span>
                          {pkg.includes_laser && <Zap size={10} className={isOffered ? 'text-yellow-300' : 'text-amber-500'} />}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ml-1 ${
                        isOffered ? 'bg-white/20' : 'border border-slate-300'
                      }`}>
                        {isOffered && <Check size={10} className="text-white" />}
                      </div>
                    </div>
                  );
                };

                // Per-eye package selection UI
                if (!samePlanBothEyes) {
                  const visibleCategoriesOD = getVisibleCategoriesForEye('od');
                  const visibleCategoriesOS = getVisibleCategoriesForEye('os');

                  return (
                    <div className="space-y-4">
                      {/* Two-column layout for per-eye package selection */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* OD (Right Eye) Column */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl border-2 border-blue-200">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">OD</div>
                            <div>
                              <span className="text-sm font-bold text-blue-800">Right Eye</span>
                              <p className="text-[10px] text-blue-600">{offeredPackagesOD.length} package(s) selected</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {visibleCategoriesOD.map(category => {
                              const colors = colorClasses[category.color];
                              const categoryPackages = surgicalPackages.filter(pkg => category.packages.includes(pkg.package_id));
                              if (categoryPackages.length === 0) return null;
                              return (
                                <div key={category.id} className="space-y-1.5">
                                  <p className={`text-xs font-bold ${colors.text}`}>{category.title}</p>
                                  <div className="space-y-1">
                                    {categoryPackages.map(pkg => renderPerEyePackageCard(pkg, 'od', colors))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* OS (Left Eye) Column */}
                        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">OS</div>
                            <div>
                              <span className="text-sm font-bold text-emerald-800">Left Eye</span>
                              <p className="text-[10px] text-emerald-600">{offeredPackagesOS.length} package(s) selected</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {visibleCategoriesOS.map(category => {
                              const colors = colorClasses[category.color];
                              const categoryPackages = surgicalPackages.filter(pkg => category.packages.includes(pkg.package_id));
                              if (categoryPackages.length === 0) return null;
                              return (
                                <div key={category.id} className="space-y-1.5">
                                  <p className={`text-xs font-bold ${colors.text}`}>{category.title}</p>
                                  <div className="space-y-1">
                                    {categoryPackages.map(pkg => renderPerEyePackageCard(pkg, 'os', colors))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Summary for per-eye packages */}
                      {(offeredPackagesOD.length > 0 || offeredPackagesOS.length > 0) && (
                        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={16} className="text-indigo-600" />
                            <span className="text-sm font-bold text-indigo-800">Packages Offered (Per Eye)</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-bold text-blue-700 mb-1.5">OD (Right)</p>
                              <div className="flex flex-wrap gap-1">
                                {offeredPackagesOD.length > 0 ? offeredPackagesOD.map((pkgId: string) => {
                                  const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                                  return pkg ? (
                                    <span key={pkgId} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-blue-700 border border-blue-200">
                                      {pkg.display_name}
                                    </span>
                                  ) : null;
                                }) : <span className="text-xs text-slate-400">None selected</span>}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-emerald-700 mb-1.5">OS (Left)</p>
                              <div className="flex flex-wrap gap-1">
                                {offeredPackagesOS.length > 0 ? offeredPackagesOS.map((pkgId: string) => {
                                  const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                                  return pkg ? (
                                    <span key={pkgId} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                      {pkg.display_name}
                                    </span>
                                  ) : null;
                                }) : <span className="text-xs text-slate-400">None selected</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Unified package selection (same plan for both eyes)
                return (
                  <div className="space-y-4">
                    {/* Visible categories based on candidacy */}
                    {visibleCategories.map(category => {
                      const colors = colorClasses[category.color];
                      const categoryPackages = surgicalPackages.filter(pkg => category.packages.includes(pkg.package_id));
                      if (categoryPackages.length === 0) return null;

                      return (
                        <div key={category.id} className={`p-4 bg-gradient-to-r ${category.bgGradient} rounded-2xl border ${category.borderColor}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h5 className={`text-sm font-bold ${colors.text}`}>{category.title}</h5>
                              <p className="text-xs text-slate-500">{category.subtitle}</p>
                            </div>
                            {!category.alwaysShow && (
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${colors.badge}`}>
                                ELIGIBLE
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {categoryPackages.map(pkg => {
                              const isOffered = offeredPackages.includes(pkg.package_id);
                              return (
                                <div
                                  key={pkg.package_id}
                                  onClick={() => {
                                    const newList = isOffered
                                      ? offeredPackages.filter((id: string) => id !== pkg.package_id)
                                      : [...offeredPackages, pkg.package_id];
                                    updateNestedField('surgical_plan.offered_packages', newList);
                                  }}
                                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                    isOffered
                                      ? `${colors.activeBg} border-transparent`
                                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-semibold ${isOffered ? 'text-white' : 'text-slate-800'}`}>
                                        {pkg.display_name}
                                      </span>
                                      {pkg.includes_laser && (
                                        <Zap size={12} className={isOffered ? 'text-yellow-300' : 'text-amber-500'} />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`text-xs font-medium ${isOffered ? 'text-white/80' : 'text-slate-500'}`}>
                                        {pkg.price_cash === 0 ? 'Insurance Covered' : `$${pkg.price_cash.toLocaleString()}`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ml-2 ${
                                    isOffered ? 'bg-white/20' : 'border-2 border-slate-300'
                                  }`}>
                                    {isOffered && <Check size={12} className="text-white" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}


                    {/* Summary of offered packages */}
                    {offeredPackages.length > 0 && (
                      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={16} className="text-indigo-600" />
                          <span className="text-sm font-bold text-indigo-800">{offeredPackages.length} Package(s) Offered to Patient</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {offeredPackages.map((pkgId: string) => {
                            const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                            return pkg ? (
                              <span key={pkgId} className="px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-indigo-700 border border-indigo-200">
                                {pkg.display_name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* SECTION 3: Patient Selection Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Patient Selection</h4>
                  <p className="text-xs text-slate-500">Shows which package the patient chose from the options offered above</p>
                </div>
              </div>

              {/* Per-eye selection when different plans for each eye */}
              {!(data?.surgical_plan?.same_plan_both_eyes ?? true) ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* OD (Right Eye) Selection */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border border-blue-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">OD</div>
                      <span className="text-sm font-bold text-blue-800">Right Eye Selection</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-700 mb-1.5">Selected Package</label>
                      <div className="relative">
                        <select
                          value={data?.surgical_plan?.patient_selection_od?.selected_package_id || ''}
                          onChange={(e) => updateNestedField('surgical_plan.patient_selection_od.selected_package_id', e.target.value)}
                          className="w-full bg-white border-2 border-blue-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-blue-300"
                        >
                          <option value="">Not yet selected</option>
                          {(data?.surgical_plan?.offered_packages_od || []).map((pkgId: string) => {
                            const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                            return pkg ? (
                              <option key={pkgId} value={pkgId}>{pkg.display_name}</option>
                            ) : null;
                          })}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-700 mb-1.5">Status</label>
                      <div className="relative">
                        <select
                          value={data?.surgical_plan?.patient_selection_od?.status || ''}
                          onChange={(e) => updateNestedField('surgical_plan.patient_selection_od.status', e.target.value)}
                          className="w-full bg-white border-2 border-blue-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-blue-300"
                        >
                          <option value="">Select status...</option>
                          <option value="pending">Pending Decision</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="declined">Declined Surgery</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 pointer-events-none" />
                      </div>
                    </div>
                    {renderField('surgical_plan.patient_selection_od.selection_date', 'Selection Date', 'date')}
                  </div>

                  {/* OS (Left Eye) Selection */}
                  <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">OS</div>
                      <span className="text-sm font-bold text-emerald-800">Left Eye Selection</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-700 mb-1.5">Selected Package</label>
                      <div className="relative">
                        <select
                          value={data?.surgical_plan?.patient_selection_os?.selected_package_id || ''}
                          onChange={(e) => updateNestedField('surgical_plan.patient_selection_os.selected_package_id', e.target.value)}
                          className="w-full bg-white border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer hover:border-emerald-300"
                        >
                          <option value="">Not yet selected</option>
                          {(data?.surgical_plan?.offered_packages_os || []).map((pkgId: string) => {
                            const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                            return pkg ? (
                              <option key={pkgId} value={pkgId}>{pkg.display_name}</option>
                            ) : null;
                          })}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-700 mb-1.5">Status</label>
                      <div className="relative">
                        <select
                          value={data?.surgical_plan?.patient_selection_os?.status || ''}
                          onChange={(e) => updateNestedField('surgical_plan.patient_selection_os.status', e.target.value)}
                          className="w-full bg-white border-2 border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer hover:border-emerald-300"
                        >
                          <option value="">Select status...</option>
                          <option value="pending">Pending Decision</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="declined">Declined Surgery</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 pointer-events-none" />
                      </div>
                    </div>
                    {renderField('surgical_plan.patient_selection_os.selection_date', 'Selection Date', 'date')}
                  </div>
                </div>
              ) : (
                /* Unified selection when same plan for both eyes */
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 px-1">Selected Package</label>
                    <div className="relative">
                      <select
                        value={data?.surgical_plan?.patient_selection?.selected_package_id || ''}
                        onChange={(e) => updateNestedField('surgical_plan.patient_selection.selected_package_id', e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer hover:border-slate-300"
                      >
                        <option value="">Not yet selected</option>
                        {(data?.surgical_plan?.offered_packages || []).map((pkgId: string) => {
                          const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                          return pkg ? (
                            <option key={pkgId} value={pkgId}>{pkg.display_name}</option>
                          ) : null;
                        })}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 px-1">Selection Status</label>
                    <div className="relative">
                      <select
                        value={data?.surgical_plan?.patient_selection?.status || ''}
                        onChange={(e) => updateNestedField('surgical_plan.patient_selection.status', e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer hover:border-slate-300"
                      >
                        <option value="">Select status...</option>
                        <option value="pending">Pending Decision</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="declined">Declined Surgery</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  {renderField('surgical_plan.patient_selection.selection_date', 'Selection Date', 'date')}
                </div>
              )}
            </div>

            {/* SURGERY SCHEDULING - After Patient Selection */}
            <div className="p-5 bg-gradient-to-r from-rose-50 to-orange-50 rounded-2xl border-2 border-rose-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Surgery Scheduling</h4>
                    <p className="text-xs text-rose-600">Set surgery dates for each eye</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* OD Surgery Date */}
                <div className="p-4 bg-white rounded-xl border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">OD</div>
                    <span className="text-sm font-bold text-slate-800">Right Eye</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Surgery Date</label>
                    <DatePicker
                      value={data?.surgical_plan?.operative_logistics?.od_right?.surgery_date || ''}
                      onChange={(value) => updateNestedField('surgical_plan.operative_logistics.od_right.surgery_date', value)}
                      placeholder="Select surgery date"
                      minDate={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                {/* OS Surgery Date */}
                <div className="p-4 bg-white rounded-xl border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">OS</div>
                    <span className="text-sm font-bold text-slate-800">Left Eye</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Surgery Date</label>
                    <DatePicker
                      value={data?.surgical_plan?.operative_logistics?.os_left?.surgery_date || ''}
                      onChange={(value) => updateNestedField('surgical_plan.operative_logistics.os_left.surgery_date', value)}
                      placeholder="Select surgery date"
                      minDate={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Lens Selection & Operative Logistics */}
            {(() => {
              const samePlanBothEyes = data?.surgical_plan?.same_plan_both_eyes ?? true;
              const hasUnifiedSelection = data?.surgical_plan?.patient_selection?.selected_package_id;
              const hasODSelection = data?.surgical_plan?.patient_selection_od?.selected_package_id;
              const hasOSSelection = data?.surgical_plan?.patient_selection_os?.selected_package_id;
              const showLensSection = samePlanBothEyes ? hasUnifiedSelection : (hasODSelection || hasOSSelection);

              if (!showLensSection) return null;

              // Helper to get lens models for a package
              const getLensModelsForPackage = (pkgId: string | undefined) => {
                if (!pkgId) return [];
                const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                const allowedLensCodes = pkg?.allowed_lens_codes || [];
                const lensInventory = clinicContext?.lens_inventory || {};
                const models: Array<{ category: string; categoryName: string; model: any }> = [];
                allowedLensCodes.forEach((code: string) => {
                  const category = lensInventory[code];
                  if (category?.models) {
                    category.models.forEach((model: any) => {
                      models.push({ category: code, categoryName: category.display_name || code, model });
                    });
                  }
                });
                return models;
              };

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center">
                      <Eye size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Lens Model Selection</h4>
                      <p className="text-xs text-slate-500">Select specific lens model from inventory based on patient's package choice</p>
                    </div>
                  </div>

                  {/* Per-eye lens selection when different plans */}
                  {!samePlanBothEyes ? (
                    <div className="grid grid-cols-2 gap-4">
                      {/* OD Lens Selection */}
                      {hasODSelection && (() => {
                        const selectedPkgOD = surgicalPackages.find(p => p.package_id === data?.surgical_plan?.patient_selection_od?.selected_package_id);
                        const lensModelsOD = getLensModelsForPackage(data?.surgical_plan?.patient_selection_od?.selected_package_id);
                        return (
                          <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl border border-blue-200 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">OD</div>
                              <div>
                                <span className="text-sm font-bold text-blue-800">Right Eye Lens</span>
                                <p className="text-[10px] text-blue-600">Package: {selectedPkgOD?.display_name}</p>
                              </div>
                            </div>
                            {lensModelsOD.length > 0 ? (
                              <div className="space-y-2">
                                {lensModelsOD.map((item, idx) => {
                                  const isSelected = data?.surgical_plan?.operative_logistics?.od_right?.lens_order?.model_code === item.model.model_code;
                                  return (
                                    <div
                                      key={`od-${item.category}-${idx}`}
                                      onClick={() => {
                                        updateNestedField('surgical_plan.operative_logistics.od_right.lens_order.model_name', item.model.model);
                                        updateNestedField('surgical_plan.operative_logistics.od_right.lens_order.model_code', item.model.model_code);
                                      }}
                                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                                        isSelected ? 'border-blue-500 bg-blue-100' : 'border-slate-200 bg-white hover:border-blue-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-xs font-bold text-slate-800">{item.model.model}</p>
                                          <p className="text-[10px] text-slate-500">{item.model.manufacturer}</p>
                                        </div>
                                        {isSelected && <Check size={14} className="text-blue-600" />}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-amber-600">No lenses available for this package</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* OS Lens Selection */}
                      {hasOSSelection && (() => {
                        const selectedPkgOS = surgicalPackages.find(p => p.package_id === data?.surgical_plan?.patient_selection_os?.selected_package_id);
                        const lensModelsOS = getLensModelsForPackage(data?.surgical_plan?.patient_selection_os?.selected_package_id);
                        return (
                          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">OS</div>
                              <div>
                                <span className="text-sm font-bold text-emerald-800">Left Eye Lens</span>
                                <p className="text-[10px] text-emerald-600">Package: {selectedPkgOS?.display_name}</p>
                              </div>
                            </div>
                            {lensModelsOS.length > 0 ? (
                              <div className="space-y-2">
                                {lensModelsOS.map((item, idx) => {
                                  const isSelected = data?.surgical_plan?.operative_logistics?.os_left?.lens_order?.model_code === item.model.model_code;
                                  return (
                                    <div
                                      key={`os-${item.category}-${idx}`}
                                      onClick={() => {
                                        updateNestedField('surgical_plan.operative_logistics.os_left.lens_order.model_name', item.model.model);
                                        updateNestedField('surgical_plan.operative_logistics.os_left.lens_order.model_code', item.model.model_code);
                                      }}
                                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                                        isSelected ? 'border-emerald-500 bg-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-xs font-bold text-slate-800">{item.model.model}</p>
                                          <p className="text-[10px] text-slate-500">{item.model.manufacturer}</p>
                                        </div>
                                        {isSelected && <Check size={14} className="text-emerald-600" />}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-amber-600">No lenses available for this package</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* Unified lens selection when same plan for both eyes */
                    (() => {
                      const selectedPkgId = data?.surgical_plan?.patient_selection?.selected_package_id;
                      const selectedPkg = surgicalPackages.find(p => p.package_id === selectedPkgId);
                      const allowedLensCodes = selectedPkg?.allowed_lens_codes || [];
                      const lensInventory = clinicContext?.lens_inventory || {};

                      const availableLensModels: Array<{ category: string; categoryName: string; model: any }> = [];
                      allowedLensCodes.forEach((code: string) => {
                        const category = lensInventory[code];
                        if (category?.models) {
                          category.models.forEach((model: any) => {
                            availableLensModels.push({ category: code, categoryName: category.display_name || code, model });
                          });
                        }
                      });

                      const isToric = allowedLensCodes.some((code: string) => code.includes('TORIC'));

                      return (
                        <div className="p-5 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl border border-cyan-200 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-cyan-800">
                                Available Lenses for: {selectedPkg?.display_name}
                              </p>
                              <p className="text-xs text-cyan-600">{availableLensModels.length} lens model(s) available in inventory</p>
                            </div>
                            {isToric && (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                                TORIC OPTIONS AVAILABLE
                              </span>
                            )}
                          </div>

                          {availableLensModels.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {availableLensModels.map((item, idx) => {
                                const isSelectedOD = data?.surgical_plan?.operative_logistics?.od_right?.lens_order?.model_code === item.model.model_code;
                                const isSelectedOS = data?.surgical_plan?.operative_logistics?.os_left?.lens_order?.model_code === item.model.model_code;
                                return (
                                  <div
                                    key={`${item.category}-${idx}`}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                      isSelectedOD || isSelectedOS
                                        ? 'border-cyan-500 bg-cyan-100'
                                        : 'border-slate-200 bg-white hover:border-cyan-300 hover:shadow-sm'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-800">{item.model.model}</p>
                                        <p className="text-[10px] text-slate-500">{item.model.manufacturer}</p>
                                        <p className="text-[10px] text-cyan-600 font-medium">{item.model.model_code}</p>
                                      </div>
                                      {item.category.includes('TORIC') && (
                                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-bold rounded">TORIC</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mb-2 line-clamp-2">{item.model.description}</p>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => {
                                          updateNestedField('surgical_plan.operative_logistics.od_right.lens_order.model_name', item.model.model);
                                          updateNestedField('surgical_plan.operative_logistics.od_right.lens_order.model_code', item.model.model_code);
                                        }}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                          isSelectedOD
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        }`}
                                      >
                                        {isSelectedOD ? '✓ OD Selected' : 'Select for OD'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          updateNestedField('surgical_plan.operative_logistics.os_left.lens_order.model_name', item.model.model);
                                          updateNestedField('surgical_plan.operative_logistics.os_left.lens_order.model_code', item.model.model_code);
                                        }}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                          isSelectedOS
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        }`}
                                      >
                                        {isSelectedOS ? '✓ OS Selected' : 'Select for OS'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
                              <p className="text-sm text-amber-700">No lens models found in inventory for this package category.</p>
                              <p className="text-xs text-amber-500 mt-1">Please ensure lens inventory is configured for: {allowedLensCodes.join(', ')}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })()}

            {/* SECTION 5: Operative Scheduling */}
            {(
              (data?.surgical_plan?.same_plan_both_eyes ?? true)
                ? data?.surgical_plan?.patient_selection?.selected_package_id
                : (data?.surgical_plan?.patient_selection_od?.selected_package_id || data?.surgical_plan?.patient_selection_os?.selected_package_id)
            ) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white flex items-center justify-center">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Operative Scheduling</h4>
                    <p className="text-xs text-slate-500">Schedule surgery and enter lens specifications per eye</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* OD (Right Eye) Logistics */}
                  <div className="p-5 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl border border-blue-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">OD</div>
                        <div>
                          <span className="text-sm font-bold text-blue-800">Right Eye</span>
                          {data?.surgical_plan?.operative_logistics?.od_right?.lens_order?.model_name && (
                            <span className="block text-[10px] text-blue-500">
                              Lens: {data?.surgical_plan?.operative_logistics?.od_right?.lens_order?.model_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <select
                          value={data?.surgical_plan?.operative_logistics?.od_right?.status || ''}
                          onChange={(e) => updateNestedField('surgical_plan.operative_logistics.od_right.status', e.target.value)}
                          className="bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-700 outline-none focus:border-blue-400 appearance-none cursor-pointer pr-7"
                        >
                          <option value="">Status...</option>
                          <option value="pending">Pending</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="lens_ordered">Lens Ordered</option>
                          <option value="ready">Ready for Surgery</option>
                          <option value="completed">Completed</option>
                          <option value="not_applicable">N/A</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {renderField('surgical_plan.operative_logistics.od_right.surgery_date', 'Surgery Date', 'date')}
                      {renderField('surgical_plan.operative_logistics.od_right.arrival_time', 'Arrival Time')}
                    </div>
                    <div className="p-3 bg-white/60 rounded-xl border border-blue-100 space-y-3">
                      <p className="text-xs font-bold text-blue-700">Lens Specifications</p>
                      <div className="grid grid-cols-3 gap-2">
                        {renderField('surgical_plan.operative_logistics.od_right.lens_order.power', 'Power (D)')}
                        {renderField('surgical_plan.operative_logistics.od_right.lens_order.cylinder', 'Cylinder')}
                        {renderField('surgical_plan.operative_logistics.od_right.lens_order.axis_alignment', 'Axis')}
                      </div>
                    </div>
                  </div>

                  {/* OS (Left Eye) Logistics */}
                  <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">OS</div>
                        <div>
                          <span className="text-sm font-bold text-emerald-800">Left Eye</span>
                          {data?.surgical_plan?.operative_logistics?.os_left?.lens_order?.model_name && (
                            <span className="block text-[10px] text-emerald-500">
                              Lens: {data?.surgical_plan?.operative_logistics?.os_left?.lens_order?.model_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <select
                          value={data?.surgical_plan?.operative_logistics?.os_left?.status || ''}
                          onChange={(e) => updateNestedField('surgical_plan.operative_logistics.os_left.status', e.target.value)}
                          className="bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 outline-none focus:border-emerald-400 appearance-none cursor-pointer pr-7"
                        >
                          <option value="">Status...</option>
                          <option value="pending">Pending</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="lens_ordered">Lens Ordered</option>
                          <option value="ready">Ready for Surgery</option>
                          <option value="completed">Completed</option>
                          <option value="not_applicable">N/A</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {renderField('surgical_plan.operative_logistics.os_left.surgery_date', 'Surgery Date', 'date')}
                      {renderField('surgical_plan.operative_logistics.os_left.arrival_time', 'Arrival Time')}
                    </div>
                    <div className="p-3 bg-white/60 rounded-xl border border-emerald-100 space-y-3">
                      <p className="text-xs font-bold text-emerald-700">Lens Specifications</p>
                      <div className="grid grid-cols-3 gap-2">
                        {renderField('surgical_plan.operative_logistics.os_left.lens_order.power', 'Power (D)')}
                        {renderField('surgical_plan.operative_logistics.os_left.lens_order.cylinder', 'Cylinder')}
                        {renderField('surgical_plan.operative_logistics.os_left.lens_order.axis_alignment', 'Axis')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Book Surgery Button */}
                {data?.surgical_plan?.operative_logistics?.od_right?.lens_order?.model_name &&
                 data?.surgical_plan?.operative_logistics?.od_right?.surgery_date && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        updateNestedField('surgical_plan.operative_logistics.od_right.status', 'scheduled');
                        if (data?.surgical_plan?.operative_logistics?.os_left?.lens_order?.model_name &&
                            data?.surgical_plan?.operative_logistics?.os_left?.surgery_date) {
                          updateNestedField('surgical_plan.operative_logistics.os_left.status', 'scheduled');
                        }
                        toast.success('Scheduled', 'Surgery has been scheduled successfully');
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all"
                    >
                      <Calendar size={16} className="inline mr-2" />
                      Confirm Surgery Booking
                    </button>
                  </div>
                )}
              </div>
            )}

          </CollapsibleCard>

          {/* Medications Plan */}
          <CollapsibleCard title="Medications Plan" subtitle="Pre-op and post-op protocols" icon={<Pill size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200" expanded={expanded.postop_meds} onToggle={() => setExpanded((p) => ({ ...p, postop_meds: !p.postop_meds }))} maxHeight="3000px" bodyClassName="p-6 space-y-6">

            {/* Protocol Type Selection - At Top */}
            <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Select Medication Protocol</h4>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'STANDARD', label: 'Standard Drops', desc: 'Individual drops: Antibiotic + NSAID + Steroid', icon: <Eye size={22} /> },
                  { id: 'COMBINATION', label: 'Combination Drop', desc: '3-in-1 drop for both pre-op and post-op', icon: <Activity size={22} /> },
                  { id: 'DROPLESS', label: 'Dropless Surgery', desc: 'Intracameral injection - minimal drops', icon: <Sparkles size={22} /> },
                ].map(opt => {
                  const isSelected = (data?.medications_plan?.protocol_type || 'STANDARD') === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => updateNestedField('medications_plan.protocol_type', opt.id)}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-white shadow-xl shadow-indigo-100'
                          : 'border-transparent bg-white hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        {opt.icon}
                      </div>
                      <h5 className={`font-bold text-sm mb-1 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</h5>
                      <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
                      {isSelected && (
                        <div className="mt-3 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-indigo-500" />
                          <span className="text-xs font-semibold text-indigo-600">Selected</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ========== COMBINATION PROTOCOL ========== */}
            {data?.medications_plan?.protocol_type === 'COMBINATION' && (
              <div className="space-y-5">
                {/* Info Banner */}
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 flex items-start gap-3">
                  <Activity size={18} className="text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">Combination Drop Protocol</p>
                    <p className="text-xs text-indigo-600 mt-0.5">The selected combination drop will be used for both pre-operative and post-operative care with a taper schedule.</p>
                  </div>
                </div>

                {/* Combination Drop Selection */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Combination Drop</h5>
                  <div className="relative">
                    <select
                      value={data?.medications_plan?.combination?.name || ''}
                      onChange={(e) => {
                        const combo = combinationDrops.find((c: any) => c.name === e.target.value);
                        updateNestedField('medications_plan.combination.name', e.target.value);
                        updateNestedField('medications_plan.combination.components', combo?.components || []);
                        if (!data?.medications_plan?.combination?.taper_schedule) {
                          updateNestedField('medications_plan.combination.taper_schedule', [4, 3, 2, 1]);
                          updateNestedField('medications_plan.combination.taper_type', 'standard');
                        }
                      }}
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer hover:border-slate-300"
                    >
                      <option value="" className="text-slate-400">Choose a combination drop...</option>
                      {combinationDrops.map((c: any) => (
                        <option key={c.id} value={c.name} className="py-2">{c.name} ({c.components?.join(' + ')})</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Show selected combination components */}
                  {data?.medications_plan?.combination?.name && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {(data?.medications_plan?.combination?.components || []).map((comp: string, idx: number) => (
                        <span key={idx} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold">{comp}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Taper Schedule */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <Activity size={18} className="text-white" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-800">Taper Schedule</h5>
                        <p className="text-xs text-slate-400">Automated weekly frequency reduction</p>
                      </div>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
                      <button
                        onClick={() => {
                          updateNestedField('medications_plan.combination.taper_type', 'standard');
                          updateNestedField('medications_plan.combination.taper_schedule', [4, 3, 2, 1]);
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          (data?.medications_plan?.combination?.taper_type || 'standard') === 'standard'
                            ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Standard Taper
                      </button>
                      <button
                        onClick={() => {
                          updateNestedField('medications_plan.combination.taper_type', 'short');
                          updateNestedField('medications_plan.combination.taper_schedule', [2, 1, 0, 0]);
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          data?.medications_plan?.combination?.taper_type === 'short'
                            ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Short Taper
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Taper Schedule Visualizer</p>
                      <div className="flex gap-2">
                        {(data?.medications_plan?.combination?.taper_schedule || [4, 3, 2, 1]).map((freq: number, i: number) => (
                          <div key={i} className="flex-1 text-center">
                            <div className={`py-4 rounded-xl font-bold text-white text-base transition-all ${
                              freq === 0 ? 'bg-slate-300' : 'bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200'
                            }`}>
                              {freq}x
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-semibold">WK {i + 1}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Manual Frequency Adjustment</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map((weekIdx) => (
                          <div key={weekIdx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-xs font-semibold text-slate-600">Week {weekIdx + 1}</span>
                            <select
                              value={(data?.medications_plan?.combination?.taper_schedule || [4, 3, 2, 1])[weekIdx] || 0}
                              onChange={(e) => {
                                const newSchedule = [...(data?.medications_plan?.combination?.taper_schedule || [4, 3, 2, 1])];
                                newSchedule[weekIdx] = parseInt(e.target.value);
                                updateNestedField('medications_plan.combination.taper_schedule', newSchedule);
                                updateNestedField('medications_plan.combination.taper_type', 'custom');
                              }}
                              className="w-16 bg-white border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-indigo-600 outline-none focus:border-indigo-400 cursor-pointer"
                            >
                              {[0, 1, 2, 3, 4].map(n => (
                                <option key={n} value={n}>{n}x</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== DROPLESS PROTOCOL ========== */}
            {data?.medications_plan?.protocol_type === 'DROPLESS' && (
              <div className="space-y-5">
                <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <Sparkles size={24} className="text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-emerald-900">Dropless Surgery Protocol</h4>
                      <p className="text-sm text-emerald-700 mt-1">{droplessOption?.description || 'Intracameral injection at time of surgery - no post-op drops required'}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Available Medications</p>
                    <div className="flex flex-wrap gap-2">
                      {(droplessOption?.medications || []).map((med: string, idx: number) => (
                        <span key={idx} className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold">{med}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pre-op antibiotic still needed for dropless */}
                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2 uppercase tracking-wide">
                      <Clock size={16} />Pre-Op Antibiotic (Still Required)
                    </h4>
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      Start {preOpDefaultDays} days before
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Select Antibiotic</label>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.pre_op?.antibiotic_id || ''}
                          onChange={(e) => {
                            const id = parseInt(e.target.value);
                            const ab = preOpAntibiotics.find((a: any) => a.id === id);
                            updateNestedField('medications_plan.pre_op.antibiotic_id', id);
                            updateNestedField('medications_plan.pre_op.antibiotic_name', ab?.name || '');
                          }}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value="">Select...</option>
                          {preOpAntibiotics.map((ab: any) => (
                            <option key={ab.id} value={ab.id}>{ab.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Frequency</label>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.pre_op?.frequency || ''}
                          onChange={(e) => {
                            updateNestedField('medications_plan.pre_op.frequency', e.target.value);
                          }}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value="">Select...</option>
                          {(frequencyOptions.length > 0 ? frequencyOptions : [
                            { label: '2x Daily', times_per_day: 2 },
                            { label: '3x Daily', times_per_day: 3 },
                            { label: '4x Daily', times_per_day: 4 },
                          ]).map((f: any, idx: number) => (
                            <option key={idx} value={f.label || `${f.times_per_day}x Daily`}>
                              {f.label || `${f.times_per_day}x Daily`}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Duration</label>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.pre_op?.duration_days || 3}
                          onChange={(e) => updateNestedField('medications_plan.pre_op.duration_days', parseInt(e.target.value))}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value={3}>3 Days</option>
                          <option value={7}>1 Week</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== STANDARD PROTOCOL ========== */}
            {(data?.medications_plan?.protocol_type === 'STANDARD' || !data?.medications_plan?.protocol_type) && (
              <div className="space-y-6">
                {/* PRE-OP SECTION */}
                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2 uppercase tracking-wide">
                      <Clock size={16} />Pre-Op Medications
                    </h4>
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                      Start {preOpDefaultDays} days before
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Select Antibiotic</label>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.pre_op?.antibiotic_id || ''}
                          onChange={(e) => {
                            const id = parseInt(e.target.value);
                            const ab = preOpAntibiotics.find((a: any) => a.id === id);
                            updateNestedField('medications_plan.pre_op.antibiotic_id', id);
                            updateNestedField('medications_plan.pre_op.antibiotic_name', ab?.name || '');
                          }}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value="">Select antibiotic...</option>
                          {preOpAntibiotics.map((ab: any) => (
                            <option key={ab.id} value={ab.id}>{ab.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Frequency</label>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.pre_op?.frequency || ''}
                          onChange={(e) => {
                            updateNestedField('medications_plan.pre_op.frequency', e.target.value);
                          }}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value="">Select frequency...</option>
                          {(frequencyOptions.length > 0 ? frequencyOptions : [
                            { label: '2x Daily', times_per_day: 2 },
                            { label: '3x Daily', times_per_day: 3 },
                            { label: '4x Daily', times_per_day: 4 },
                          ]).map((f: any, idx: number) => (
                            <option key={idx} value={f.label || `${f.times_per_day}x Daily`}>
                              {f.label || `${f.times_per_day}x Daily`}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Duration</label>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.pre_op?.duration_days || 3}
                          onChange={(e) => updateNestedField('medications_plan.pre_op.duration_days', parseInt(e.target.value))}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value={3}>3 Days</option>
                          <option value={7}>1 Week</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Additional Instructions for Pre-Op */}
                  <div className="pt-3 border-t border-blue-200">
                    <label className="block text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Additional Pre-Op Instructions</label>
                    <textarea
                      value={data?.medications_plan?.pre_op?.additional_instructions || ''}
                      onChange={(e) => updateNestedField('medications_plan.pre_op.additional_instructions', e.target.value)}
                      placeholder="Enter any additional instructions (e.g., continue dry eye medications, hold specific drops, etc.)"
                      className="w-full bg-white border-2 border-blue-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 transition-all resize-none"
                      rows={2}
                    />
                  </div>
                </div>

                {/* POST-OP SECTION */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Post-Op Medications</h4>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    {/* A. ANTIBIOTIC */}
                    <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 space-y-4 hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">A. Antibiotic</h5>
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">1 Week</span>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Select Antibiotic</label>
                        <div className="relative">
                          <select
                            value={data?.medications_plan?.post_op?.antibiotic?.name || ''}
                            onChange={(e) => {
                              const ab = postOpAntibiotics.find((a: any) => a.name === e.target.value);
                              updateNestedField('medications_plan.post_op.antibiotic.name', e.target.value);
                              updateNestedField('medications_plan.post_op.antibiotic.frequency', ab?.default_frequency || 4);
                              updateNestedField('medications_plan.post_op.antibiotic.weeks', ab?.default_weeks || 1);
                            }}
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none cursor-pointer hover:border-slate-300"
                          >
                            <option value="">Select antibiotic...</option>
                            {postOpAntibiotics.map((a: any) => (
                              <option key={a.id} value={a.name}>{a.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                        <Activity size={14} className="text-indigo-400" />
                        <span className="font-medium">Fixed: {data?.medications_plan?.post_op?.antibiotic?.frequency || 4}x Daily (7 Days)</span>
                      </div>
                    </div>

                    {/* B. ANTI-INFLAMMATORY (NSAID) */}
                    <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 space-y-4 hover:border-slate-300 transition-all">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">B. Anti-Inflammatory (NSAID)</h5>
                      <div className="relative">
                        <select
                          value={data?.medications_plan?.post_op?.nsaid?.name || ''}
                          onChange={(e) => {
                            const nsaid = postOpNsaids.find((n: any) => n.name === e.target.value);
                            updateNestedField('medications_plan.post_op.nsaid.name', e.target.value);
                            if (nsaid) {
                              updateNestedField('medications_plan.post_op.nsaid.frequency', nsaid.default_frequency);
                              updateNestedField('medications_plan.post_op.nsaid.frequency_label', nsaid.frequency_label);
                              updateNestedField('medications_plan.post_op.nsaid.weeks', nsaid.default_weeks);
                            }
                          }}
                          className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none cursor-pointer hover:border-slate-300"
                        >
                          <option value="">Select NSAID...</option>
                          {postOpNsaids.map((n: any) => (
                            <option key={n.id} value={n.name}>{n.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Frequency</label>
                          <div className="relative">
                            <select
                              value={data?.medications_plan?.post_op?.nsaid?.frequency || ''}
                              onChange={(e) => {
                                const freq = parseInt(e.target.value);
                                const label = freq === 1 ? '1x Daily' : freq === 2 ? '2x Daily' : freq === 3 ? '3x Daily' : '4x Daily';
                                updateNestedField('medications_plan.post_op.nsaid.frequency', freq);
                                updateNestedField('medications_plan.post_op.nsaid.frequency_label', label);
                              }}
                              className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer"
                            >
                              <option value="">Select...</option>
                              <option value={1}>1x Daily</option>
                              <option value={2}>2x Daily</option>
                              <option value={3}>3x Daily</option>
                              <option value={4}>4x Daily</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Duration</label>
                          <div className="relative">
                            <select
                              value={data?.medications_plan?.post_op?.nsaid?.weeks || 4}
                              onChange={(e) => updateNestedField('medications_plan.post_op.nsaid.weeks', parseInt(e.target.value))}
                              className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 transition-all appearance-none cursor-pointer"
                            >
                              <option value={2}>2 Weeks</option>
                              <option value={3}>3 Weeks</option>
                              <option value={4}>4 Weeks</option>
                              <option value={6}>6 Weeks</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* C. STEROID TAPER REGIMEN */}
                  <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 space-y-5 hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                          <Activity size={18} className="text-white" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-800">C. Steroid Taper Regimen</h5>
                          <p className="text-xs text-slate-400">Automated weekly schedule</p>
                        </div>
                      </div>
                      <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
                        <button
                          onClick={() => {
                            updateNestedField('medications_plan.post_op.steroid.taper_type', 'standard');
                            updateNestedField('medications_plan.post_op.steroid.taper_schedule', [4, 3, 2, 1]);
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            (data?.medications_plan?.post_op?.steroid?.taper_type || 'standard') === 'standard'
                              ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Standard Taper
                        </button>
                        <button
                          onClick={() => {
                            updateNestedField('medications_plan.post_op.steroid.taper_type', 'short');
                            updateNestedField('medications_plan.post_op.steroid.taper_schedule', [2, 1, 0, 0]);
                          }}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            data?.medications_plan?.post_op?.steroid?.taper_type === 'short'
                              ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Short Taper
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Steroid Name</label>
                          <div className="relative">
                            <select
                              value={data?.medications_plan?.post_op?.steroid?.name || ''}
                              onChange={(e) => {
                                const steroid = postOpSteroids.find((s: any) => s.name === e.target.value);
                                updateNestedField('medications_plan.post_op.steroid.name', e.target.value);
                                if (steroid) {
                                  updateNestedField('medications_plan.post_op.steroid.taper_schedule', steroid.default_taper || [4, 3, 2, 1]);
                                }
                              }}
                              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all appearance-none cursor-pointer hover:border-slate-300"
                            >
                              <option value="">Select steroid...</option>
                              {postOpSteroids.map((s: any) => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Taper Schedule Visualizer</p>
                          <div className="flex gap-2">
                            {(data?.medications_plan?.post_op?.steroid?.taper_schedule || [4, 3, 2, 1]).map((freq: number, i: number) => (
                              <div key={i} className="flex-1 text-center">
                                <div className={`py-4 rounded-xl font-bold text-white text-base transition-all ${
                                  freq === 0 ? 'bg-slate-300' : 'bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-200'
                                }`}>
                                  {freq}x
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-semibold">WK {i + 1}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Manual Frequency Adjustment</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[0, 1, 2, 3].map((weekIdx) => (
                            <div key={weekIdx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-xs font-semibold text-slate-600">Week {weekIdx + 1}</span>
                              <select
                                value={(data?.medications_plan?.post_op?.steroid?.taper_schedule || [4, 3, 2, 1])[weekIdx] || 0}
                                onChange={(e) => {
                                  const newSchedule = [...(data?.medications_plan?.post_op?.steroid?.taper_schedule || [4, 3, 2, 1])];
                                  newSchedule[weekIdx] = parseInt(e.target.value);
                                  updateNestedField('medications_plan.post_op.steroid.taper_schedule', newSchedule);
                                  updateNestedField('medications_plan.post_op.steroid.taper_type', 'custom');
                                }}
                                className="w-16 bg-white border-2 border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-indigo-600 outline-none focus:border-indigo-400 cursor-pointer"
                              >
                                {[0, 1, 2, 3, 4].map(n => (
                                  <option key={n} value={n}>{n}x</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Instructions for Post-Op */}
                  <div className="pt-3 border-t border-indigo-200">
                    <label className="block text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wide">Additional Post-Op Instructions</label>
                    <textarea
                      value={data?.medications_plan?.post_op?.additional_instructions || ''}
                      onChange={(e) => updateNestedField('medications_plan.post_op.additional_instructions', e.target.value)}
                      placeholder="Enter any additional instructions (e.g., activity restrictions, follow-up reminders, special considerations, etc.)"
                      className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm text-slate-700 outline-none focus:border-indigo-400 transition-all resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ========== GLAUCOMA / LONG-TERM DROPS ========== */}
            <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2 uppercase tracking-wide">
                  <AlertCircle size={16} />Glaucoma / Long-Term Drops
                </h4>
                <button
                  onClick={() => updateNestedField('medications_plan.post_op.glaucoma.resume', !data?.medications_plan?.post_op?.glaucoma?.resume)}
                  className={`w-12 h-6 rounded-full transition-all ${data?.medications_plan?.post_op?.glaucoma?.resume ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${data?.medications_plan?.post_op?.glaucoma?.resume ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {data?.medications_plan?.post_op?.glaucoma?.resume && (
                <div className="space-y-3">
                  <p className="text-xs text-emerald-700">Select drops to resume after surgery:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {glaucomaDrops.map((drop: any) => {
                      const isSelected = (data?.medications_plan?.post_op?.glaucoma?.medications || []).includes(drop.name);
                      return (
                        <button
                          key={drop.id}
                          onClick={() => {
                            const current = data?.medications_plan?.post_op?.glaucoma?.medications || [];
                            const newList = isSelected ? current.filter((d: string) => d !== drop.name) : [...current, drop.name];
                            updateNestedField('medications_plan.post_op.glaucoma.medications', newList);
                          }}
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                              : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && <Check size={12} />}
                            <span className="truncate">{drop.name}</span>
                          </div>
                          <span className={`text-[9px] mt-0.5 block ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>{drop.category}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleCard>

          {/* Forms & Documents */}
          <CollapsibleCard title="Forms & Documents" subtitle="Templates & signed copies" icon={<FileText size={16} />} iconClassName="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 text-white flex items-center justify-center shadow-lg shadow-slate-200" expanded={expanded.documents} onToggle={() => setExpanded((p) => ({ ...p, documents: !p.documents }))} maxHeight="1200px" bodyClassName="p-5 space-y-4">
            {loadingForms ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-48" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Info banner */}
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-3 flex gap-2.5 items-start">
                  <AlertCircle className="flex-shrink-0 text-blue-600 mt-0.5" size={14} />
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Upload signed copies of each form per eye. Blank templates are managed in <span className="font-semibold">Clinic Setup &rarr; Documents</span>.
                  </p>
                </div>

                {/* Form type sections */}
                {FORM_TYPES.map(formDef => {
                  const formData = patientForms[formDef.id] || {};
                  const hasTemplate = formTemplates[formDef.id]?.uploaded;

                  // Determine which eyes have surgery scheduled
                  const odStatus = data?.surgical_plan?.operative_logistics?.od_right?.status;
                  const osStatus = data?.surgical_plan?.operative_logistics?.os_left?.status;
                  const scheduledEyes = EYE_CONFIG.filter(e =>
                    (e.key === 'od_right' && odStatus) || (e.key === 'os_left' && osStatus)
                  );
                  // If no eyes scheduled, show both by default
                  const eyesToShow = scheduledEyes.length > 0 ? scheduledEyes : EYE_CONFIG;

                  return (
                    <div key={formDef.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      {/* Form type header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                          {formDef.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-slate-800">{formDef.label}</h4>
                        </div>
                        {hasTemplate ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold uppercase tracking-wide">
                            Template Ready
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold uppercase tracking-wide">
                            No Template
                          </span>
                        )}
                      </div>

                      {/* Per-eye rows */}
                      <div className="divide-y divide-slate-100">
                        {eyesToShow.map(eyeConf => {
                          const eyeData = formData?.eyes?.[eyeConf.key] || {};
                          const eyeStatus = eyeData.status || (hasTemplate ? 'ready' : 'not_available');
                          const refKey = `${formDef.id}_${eyeConf.key}`;
                          const isUploading = uploadingSignedForm === refKey;

                          return (
                            <div key={eyeConf.key} className="flex items-center gap-3 px-4 py-3">
                              {/* Eye label */}
                              <div className="flex items-center gap-2 min-w-[80px]">
                                <div className={`w-2 h-2 rounded-full ${eyeConf.dotColor}`} />
                                <span className="text-xs font-semibold text-slate-700">{eyeConf.shortLabel}</span>
                              </div>

                              {/* Status badge */}
                              <div className="flex-1">
                                {eyeStatus === 'signed' ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                                      Signed
                                    </span>
                                    {eyeData.signed_date && (
                                      <span className="text-[10px] text-slate-400">{eyeData.signed_date}</span>
                                    )}
                                    {eyeData.file_name && (
                                      <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{eyeData.file_name}</span>
                                    )}
                                  </div>
                                ) : eyeStatus === 'ready' ? (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                                    Ready to Sign
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
                                    Pending
                                  </span>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5">
                                {eyeStatus === 'signed' && (
                                  <button
                                    onClick={() => handleFormDownload(formDef.id, 'signed', eyeConf.key)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Download signed copy"
                                  >
                                    <Download size={13} />
                                  </button>
                                )}
                                {hasTemplate && eyeStatus === 'ready' && (
                                  <button
                                    onClick={() => handleFormDownload(formDef.id, 'blank')}
                                    className="px-2 py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all"
                                    title="Download blank template"
                                  >
                                    Blank PDF
                                  </button>
                                )}
                                {/* Upload signed copy button */}
                                <button
                                  onClick={() => signedFormInputRefs.current[refKey]?.click()}
                                  disabled={isUploading}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                    eyeStatus === 'signed'
                                      ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                      : 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm'
                                  } disabled:opacity-50`}
                                  title={eyeStatus === 'signed' ? 'Replace signed copy' : 'Upload signed copy'}
                                >
                                  {isUploading ? (
                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Upload size={11} />
                                  )}
                                  {eyeStatus === 'signed' ? 'Replace' : 'Upload'}
                                </button>
                                <input
                                  type="file"
                                  ref={(el) => { signedFormInputRefs.current[refKey] = el; }}
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleSignedFormUpload(formDef.id, eyeConf.key, file);
                                    e.target.value = '';
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CollapsibleCard>
        </div>

        {/* Upload Panel */}
        {showUploads && (
          <div className="col-span-12 lg:col-span-4">
            <UploadPanel fileInputRef={fileInputRef} files={files} setFiles={setFiles} startExtraction={startExtraction} extracting={extracting} handleFileChange={handleFileChange} recentUploads={recentUploads} showAllUploads={showAllUploads} setShowAllUploads={setShowAllUploads} extractionError={error} extractionSuccess={status === 'extracted'} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-center gap-3">
          <AlertCircle size={18} />{error}
        </div>
      )}

      {/* Keyboard hints */}
      {/* <div className="text-center text-[10px] text-slate-400 py-2">
        <span className="px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono">Ctrl+S</span> Save
        {onNavigate && (
          <>
            <span className="mx-2">|</span>
            <span className="px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono">Alt+←</span> Prev
            <span className="mx-1">|</span>
            <span className="px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono">Alt+→</span> Next
          </>
        )}
      </div> */}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default PatientOnboarding;
