import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  PanelRightOpen,
  PanelRightClose,
  Eye,
  FileText,
  Save,
  User,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import {
  ANTIBIOTIC_OPTIONS,
  FREQUENCY_OPTIONS,
  getAntibioticName,
  getFrequencyName,
  POST_OP_ANTIBIOTICS,
  POST_OP_NSAIDS,
  POST_OP_STEROIDS,
  GLAUCOMA_DROPS,
  COMBO_DROP_EXAMPLES
} from '../constants/medications';
import CollapsibleCard from './components/CollapsibleCard';
import UploadPanel from './components/UploadPanel';

interface PatientOnboardingProps {
  patientId: string;
  clinicId: string;
  onBack: () => void;
}

const PatientOnboarding: React.FC<PatientOnboardingProps> = ({ patientId, clinicId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [recentUploads, setRecentUploads] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'extracted' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    identity: true,
    medical: true,
    clinical: true,
    lifestyle: true,
    surgical: true,
    postop_meds: true,
    documents: true,
  });
  const [showUploads, setShowUploads] = useState(true);
  const [showAllUploads, setShowAllUploads] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        setLoading(true);
        const reviewed = await api.getReviewedPatient(clinicId, patientId);
        if (reviewed && reviewed.reviewed) {
          setData(reviewed.reviewed);
          setStatus('saved');
        } else {
          const extracted = await api.getExtractedPatient(clinicId, patientId);
          if (extracted && extracted.extracted) {
            setData(extracted.extracted);
            setStatus('extracted');
          }
        }
        setRecentUploads((reviewed?.files as string[]) || []);
      } catch (err) {
        console.log('No existing data for this patient - starting fresh');
        // Initialize empty structure so the form renders
        setData({
          patient_identity: { patient_id: patientId },
          medications: { pre_op: {} },
          surgical_recommendations_by_doctor: { scheduling: {}, pre_op_instructions: {} },
          documents: { signed_consents: [] }
        });
      } finally {
        setLoading(false);
      }
    };
    checkExisting();
  }, [clinicId, patientId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const list = Array.from(e.target.files);
      setFiles(list);
      setRecentUploads(list.map((f) => f.name));
    }
  };

  const startExtraction = async () => {
    if (files.length === 0) return;
    try {
      setExtracting(true);
      setError(null);
      const res = await api.uploadPatientDocs(clinicId, patientId, files);
      const uploadedNames = (res && (res.files as string[])) || files.map((f) => f.name);
      setData(res.extracted ?? res.data ?? res);
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
      setLoading(true);
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
      alert('Patient data saved successfully! Empty fields were removed to keep the record clean.');
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setLoading(false);
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
      alert('Patient data deleted. You can upload again to start fresh.');
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const updateNestedField = (path: string, value: any) => {
    // Reset status so save button is re-enabled
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

  const renderTagList = (path: string, label: string) => {
    const parts = path.split('.');
    let list = data;
    for (const part of parts) list = list?.[part];
    const arr: string[] = Array.isArray(list) ? list : [];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {arr.map((item, idx) => (
            <span key={idx} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2 border border-slate-200">
              {item}
              <button
                onClick={() => {
                  const newList = arr.filter((_, i) => i !== idx);
                  updateNestedField(path, newList);
                }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder={`Add ${label.toLowerCase()}...`}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
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
    const isEmpty = val === null || val === '' || (Array.isArray(val) && val.length === 0);
    return (
      <div className="group/field relative">
        <div className="flex items-center justify-between mb-2 px-1">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-tight transition-colors group-focus-within/field:text-blue-600">
            {label}
          </label>
          {isEmpty && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" title="Not Extracted"></div>}
        </div>
        {type === 'select' ? (
          <div className="relative">
            <select
              value={val || ''}
              onChange={(e) => updateNestedField(path, e.target.value)}
              disabled={disabled}
              className={`w-full bg-white border ${disabled ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700'} rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 transition-all appearance-none`}
            >
              <option value="">Select...</option>
              {options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>
        ) : (
          <input
            type={type}
            value={val || ''}
            onChange={(e) => updateNestedField(path, e.target.value)}
            disabled={disabled}
            className={`w-full bg-white border ${disabled ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-700'} rounded-xl px-4 py-3 text-[14px] font-medium outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 transition-all`}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          />
        )}
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-32">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="font-medium">Loading patient record...</p>
      </div>
    );
  }

  const name = `${data?.patient_identity?.first_name || ''} ${data?.patient_identity?.last_name || ''}`.trim() || 'Patient';

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all bg-white shadow-sm"
            title="Back"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">Patient ID: {data?.patient_identity?.patient_id || patientId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`p-3 rounded-xl shadow-sm transition-all ${deleting ? 'bg-rose-100 text-rose-300 cursor-not-allowed' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              }`}
            title="Delete patient data"
            aria-label="Delete patient data"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setShowUploads((v) => !v)}
            className="p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all bg-white shadow-sm"
            title={showUploads ? 'Hide uploads panel' : 'Show uploads panel'}
            aria-label="Toggle uploads panel"
          >
            {showUploads ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
          <button
            onClick={handleSave}
            disabled={!data || status === 'saved'}
            className={`p-3 rounded-xl shadow-sm transition-all ${!data || status === 'saved'
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            title="Save Changes"
            aria-label="Save Changes"
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-6 min-h-0">
        {/* Left: form sections */}
        <div className={`col-span-12 ${showUploads ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4 lg:max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar`}>
          {/* Identity */}
          <CollapsibleCard
            title="Identity"
            icon={<User size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
            expanded={expanded.identity}
            onToggle={() => setExpanded((p) => ({ ...p, identity: !p.identity }))}
            maxHeight="1200px"
            bodyClassName="px-5 pb-5 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              {renderField('patient_identity.first_name', 'First Name')}
              {renderField('patient_identity.last_name', 'Last Name')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField('patient_identity.dob', 'Date of Birth', 'date')}
              {renderField('patient_identity.age', 'Age', 'number')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField('patient_identity.gender', 'Gender')}
              {renderField('patient_identity.occupation', 'Occupation')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField('patient_identity.patient_id', 'Patient ID')}
              {renderField('patient_identity.clinic_ref_id', 'Clinic Ref ID')}
            </div>
          </CollapsibleCard>

          {/* Medical History */}
          <CollapsibleCard
            title="Medical History"
            subtitle="Allergies, medications, prior conditions"
            icon={<AlertCircle size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center"
            expanded={expanded.medical}
            onToggle={() => setExpanded((p) => ({ ...p, medical: !p.medical }))}
            maxHeight="1000px"
          >
            {renderField('medical_history.source', 'Source')}
            {renderField('medical_history.ocular_history', 'Ocular History')}
            {renderTagList('medical_history.systemic_conditions', 'Systemic Conditions')}
            {renderTagList('medical_history.allergies', 'Allergies')}
          </CollapsibleCard>

          {/* Clinical Notes */}
          <CollapsibleCard
            title="Clinical Notes"
            subtitle="Diagnosis, ICD codes, pathology"
            icon={<Eye size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"
            expanded={expanded.clinical}
            onToggle={() => setExpanded((p) => ({ ...p, clinical: !p.clinical }))}
            maxHeight="1600px"
          >
            <div className="grid grid-cols-2 gap-4">
              {renderField('clinical_context.diagnosis.icd_10_code', 'ICD-10 Code')}
              {renderField('clinical_context.diagnosis.type', 'Diagnosis Type')}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField('clinical_context.diagnosis.pathology', 'Pathology')}
              {renderField('clinical_context.diagnosis.anatomical_status', 'Anatomical Status')}
            </div>
            {renderTagList('clinical_context.comorbidities', 'Comorbidities')}
            {renderTagList('clinical_context.symptoms_reported_by_patient', 'Symptoms Reported')}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Right Eye (OD)</p>
                {renderField('clinical_context.measurements.od_right_eye.axial_length_mm', 'Axial Length (mm)', 'number')}
                {renderField('clinical_context.measurements.od_right_eye.astigmatism_power', 'Astigmatism Power (D)', 'number')}
                {renderField('clinical_context.measurements.od_right_eye.astigmatism_axis', 'Astigmatism Axis (°)', 'number')}
                {renderField('clinical_context.measurements.od_right_eye.biometric_insight', 'Biometric Insight')}
              </div>
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Left Eye (OS)</p>
                {renderField('clinical_context.measurements.os_left_eye.axial_length_mm', 'Axial Length (mm)', 'number')}
                {renderField('clinical_context.measurements.os_left_eye.astigmatism_power', 'Astigmatism Power (D)', 'number')}
                {renderField('clinical_context.measurements.os_left_eye.astigmatism_axis', 'Astigmatism Axis (°)', 'number')}
                {renderField('clinical_context.measurements.os_left_eye.biometric_insight', 'Biometric Insight')}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Triggered Alerts</p>
              {(data?.clinical_context?.triggered_alerts || []).length === 0 ? (
                <p className="text-xs text-slate-400">No alerts</p>
              ) : (
                <div className="space-y-2">
                  {(data?.clinical_context?.triggered_alerts || []).map((alert: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl border border-amber-100 bg-amber-50 text-xs text-amber-700 flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{alert.type || 'Alert'}</p>
                        <p className="mt-1 text-amber-600">{alert.message || alert.id}</p>
                      </div>
                      <button
                        onClick={() => {
                          const list = data?.clinical_context?.triggered_alerts || [];
                          const next = list.filter((_: any, i: number) => i !== idx);
                          updateNestedField('clinical_context.triggered_alerts', next);
                        }}
                        className="text-amber-400 hover:text-amber-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleCard>

          {/* Lifestyle */}
          <CollapsibleCard
            title="Lifestyle"
            subtitle="Priorities, hobbies, attitudes"
            icon={<Activity size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center"
            expanded={expanded.lifestyle}
            onToggle={() => setExpanded((p) => ({ ...p, lifestyle: !p.lifestyle }))}
            maxHeight="800px"
          >
            {renderTagList('lifestyle.hobbies', 'Hobbies')}
            {renderField('lifestyle.visual_priorities', 'Visual Priorities')}
            {renderField('lifestyle.attitude_toward_glasses', 'Attitude Toward Glasses')}
          </CollapsibleCard>

          {/* Surgical Plan */}
          <CollapsibleCard
            title="Surgical Plan"
            subtitle="Lens selection, logistics"
            icon={<Save size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center"
            expanded={expanded.surgical}
            onToggle={() => setExpanded((p) => ({ ...p, surgical: !p.surgical }))}
            maxHeight="1800px"
          >
            <div className="grid grid-cols-2 gap-4">
              {renderField('surgical_recommendations_by_doctor.doctor_ref_id', 'Doctor ID')}
              {renderField('surgical_recommendations_by_doctor.counselor_ref_id', 'Counselor ID')}
              {renderField('surgical_recommendations_by_doctor.decision_date', 'Decision Date', 'date')}
              {renderField('surgical_recommendations_by_doctor.candidate_for_laser', 'Candidate for Laser')}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Recommended Lens Options</p>
                <button
                  onClick={() => {
                    const current = data?.surgical_recommendations_by_doctor?.recommended_lens_options || [];
                    updateNestedField('surgical_recommendations_by_doctor.recommended_lens_options', [
                      ...current,
                      { package_id: '', name: '', description: '', reason: '', is_selected_preference: false },
                    ]);
                  }}
                  className="text-[11px] font-bold text-blue-600 uppercase tracking-wide"
                >
                  + Add
                </button>
              </div>
              {(data?.surgical_recommendations_by_doctor?.recommended_lens_options || []).map((opt: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(`surgical_recommendations_by_doctor.recommended_lens_options.${idx}.name`, 'Name')}
                    {renderField(`surgical_recommendations_by_doctor.recommended_lens_options.${idx}.package_id`, 'Package ID')}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(`surgical_recommendations_by_doctor.recommended_lens_options.${idx}.description`, 'Description')}
                    {renderField(`surgical_recommendations_by_doctor.recommended_lens_options.${idx}.reason`, 'Reason')}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!opt.is_selected_preference}
                      onChange={(e) =>
                        updateNestedField(
                          `surgical_recommendations_by_doctor.recommended_lens_options.${idx}.is_selected_preference`,
                          e.target.checked,
                        )
                      }
                    />
                    <span className="text-xs font-semibold text-slate-600">Selected Preference</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Implant OD</p>
                {renderField('surgical_recommendations_by_doctor.selected_implants.od_right.model', 'Model')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.od_right.power', 'Power')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.od_right.cylinder', 'Cylinder')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.od_right.alignment_axis', 'Alignment Axis')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.od_right.incision', 'Incision')}
              </div>
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Implant OS</p>
                {renderField('surgical_recommendations_by_doctor.selected_implants.os_left.model', 'Model')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.os_left.power', 'Power')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.os_left.cylinder', 'Cylinder')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.os_left.alignment_axis', 'Alignment Axis')}
                {renderField('surgical_recommendations_by_doctor.selected_implants.os_left.incision', 'Incision')}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {renderField('surgical_recommendations_by_doctor.scheduling.surgery_date', 'Surgery Date', 'date')}
              {renderField('surgical_recommendations_by_doctor.scheduling.arrival_time', 'Arrival Time')}
              {renderField('surgical_recommendations_by_doctor.scheduling.pre_op_start_date', 'Pre-Op Start', 'date')}
              {renderField('surgical_recommendations_by_doctor.scheduling.post_op_visit_1', 'Post-Op Visit 1', 'date')}
              {renderField('surgical_recommendations_by_doctor.scheduling.post_op_visit_2', 'Post-Op Visit 2', 'date')}
            </div>

            {/* Pre-op Medication Orders */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Pre-op Medication Orders</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Antibiotic</label>
                  <div className="relative">
                    <select
                      value={data.medications?.pre_op?.antibiotic_id || ''}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        updateNestedField('medications.pre_op.antibiotic_id', id);
                        updateNestedField('medications.pre_op.antibiotic_name', getAntibioticName(id));
                      }}
                      className="w-full text-sm font-bold text-slate-700 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none transition-all"
                    >
                      <option value="">Select Antibiotic</option>
                      {ANTIBIOTIC_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Frequency</label>
                  <div className="relative">
                    <select
                      value={data.medications?.pre_op?.frequency_id || ''}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        updateNestedField('medications.pre_op.frequency_id', id);
                        updateNestedField('medications.pre_op.frequency', getFrequencyName(id));
                      }}
                      className="w-full text-sm font-bold text-slate-700 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none transition-all"
                    >
                      <option value="">Select Frequency</option>
                      {FREQUENCY_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* After Surgery Medications */}
          <CollapsibleCard
            title="After Surgery Medications"
            subtitle="Tapering, Dropless, and Multi-Drug Regimens"
            icon={<Activity size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"
            expanded={expanded.postop_meds}
            onToggle={() => setExpanded((p) => ({ ...p, postop_meds: !p.postop_meds }))}
            maxHeight="2500px"
          >
            <div className="space-y-6">
              {/* Global Post-Op Toggles */}
              <div className="grid grid-cols-2 gap-4 h-full">
                <div
                  onClick={() => {
                    const val = !data.medications?.post_op?.is_dropless;
                    updateNestedField('medications.post_op.is_dropless', val);
                    if (val) {
                      updateNestedField('medications.post_op.is_combination', false);
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center h-full ${data.medications?.post_op?.is_dropless
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                >
                  <PanelRightClose size={24} className={data.medications?.post_op?.is_dropless ? 'text-white' : 'text-slate-300'} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Dropless Surgery</p>
                    <p className={`text-[10px] mt-1 ${data.medications?.post_op?.is_dropless ? 'text-blue-100' : 'text-slate-400'}`}>No daily routine drops required</p>
                  </div>
                </div>

                <div
                  onClick={() => {
                    const val = !data.medications?.post_op?.is_combination;
                    updateNestedField('medications.post_op.is_combination', val);
                    if (val) {
                      updateNestedField('medications.post_op.is_dropless', false);
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center h-full ${data.medications?.post_op?.is_combination
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                >
                  <Activity size={24} className={data.medications?.post_op?.is_combination ? 'text-white' : 'text-slate-300'} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Combination Drop</p>
                    <p className={`text-[10px] mt-1 ${data.medications?.post_op?.is_combination ? 'text-indigo-100' : 'text-slate-400'}`}>3-in-1 medication regimen</p>
                  </div>
                </div>
              </div>

              {/* Conditional Warning */}
              {data.medications?.post_op?.is_dropless && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3 text-blue-700">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    <strong>Dropless Surgery selected.</strong> Standard antibiotic, NSAID, and steroid requirements will be hidden from the patient. They will only see an instruction to resume their usual glaucoma or long-term eye drops.
                  </p>
                </div>
              )}

              {/* Medication Inputs */}
              {!data.medications?.post_op?.is_dropless && (
                <div className="space-y-6 animate-fadeIn">

                  {/* Combination Name Selection (Visible only if is_combination) */}
                  {data.medications?.post_op?.is_combination && (
                    <div className="space-y-2 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                      <label className="text-[11px] font-bold text-indigo-500 uppercase tracking-tight">Bottle Name (Combo)</label>
                      {renderField('medications.post_op.combination_name', 'Select or Enter Combination Name', 'select', COMBO_DROP_EXAMPLES)}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* A. Antibiotic */}
                    {!data.medications?.post_op?.is_combination && (
                      <div className="space-y-3 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">A. Antibiotic</label>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">1 Week</span>
                        </div>
                        {renderField('medications.post_op.antibiotic.name', 'Select Antibiotic', 'select', POST_OP_ANTIBIOTICS)}
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 px-1">
                          <Activity size={14} />
                          <span>Fixed: 3x Daily (7 Days)</span>
                        </div>
                        {/* Sulfa Warning */}
                        {data.medications?.post_op?.antibiotic?.name === 'Neomycin-Polymyxin' &&
                          data.medical_history?.allergies?.includes('Sulfa') && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-2 text-[11px] text-rose-700">
                              <AlertCircle size={14} className="shrink-0" />
                              <p>Warning: Sulfa allergy detected. Neomycin may be contraindicated.</p>
                            </div>
                          )}
                      </div>
                    )}

                    {/* B. Anti-Inflammatory (NSAID) */}
                    {!data.medications?.post_op?.is_combination && (
                      <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">B. Anti-Inflammatory (NSAID)</label>
                        <div className="relative">
                          <select
                            value={data.medications?.post_op?.nsaid?.name || ''}
                            onChange={(e) => {
                              const name = e.target.value;
                              const ref = POST_OP_NSAIDS.find(n => n.name === name);
                              updateNestedField('medications.post_op.nsaid.name', name);
                              if (ref) {
                                updateNestedField('medications.post_op.nsaid.frequency', ref.defaultFrequency);
                                updateNestedField('medications.post_op.nsaid.frequency_label', ref.label);
                              }
                            }}
                            className="w-full text-sm font-medium text-slate-700 p-3 bg-white border border-slate-200 rounded-xl outline-none appearance-none"
                          >
                            <option value="">Select Drug</option>
                            {POST_OP_NSAIDS.map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>

                        {data.medications?.post_op?.nsaid?.name && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Frequency</p>
                              {POST_OP_NSAIDS.find(n => n.name === data.medications?.post_op?.nsaid?.name)?.variableFrequency ? (
                                <div className="relative">
                                  <select
                                    value={data.medications?.post_op?.nsaid?.frequency || ''}
                                    onChange={(e) => {
                                      const freq = parseInt(e.target.value);
                                      updateNestedField('medications.post_op.nsaid.frequency', freq);
                                      updateNestedField('medications.post_op.nsaid.frequency_label', `${freq}x Daily`);
                                    }}
                                    className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-lg outline-none appearance-none"
                                  >
                                    <option value="1">1x Daily</option>
                                    <option value="3">3x Daily</option>
                                    <option value="4">4x Daily</option>
                                  </select>
                                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                </div>
                              ) : (
                                <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                  {data.medications?.post_op?.nsaid?.frequency_label}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Duration</p>
                              <div className="relative">
                                <select
                                  value={data.medications?.post_op?.nsaid?.weeks || 4}
                                  onChange={(e) => updateNestedField('medications.post_op.nsaid.weeks', parseInt(e.target.value))}
                                  className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-lg outline-none appearance-none"
                                >
                                  <option value="1">1 Week</option>
                                  <option value="2">2 Weeks</option>
                                  <option value="4">4 Weeks</option>
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* C. Steroid (or Combined Drop) Tapering Section */}
                  <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                          <Activity size={18} />
                        </div>
                        <div>
                          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">
                            {data.medications?.post_op?.is_combination ? 'C. Combination Regimen' : 'C. Steroid Taper Regimen'}
                          </label>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Automated Weekly Schedule</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateNestedField('medications.post_op.steroid.taper_schedule', [4, 3, 2, 1])}
                          className="px-3 py-1 bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                        >
                          Standard Taper
                        </button>
                        <button
                          onClick={() => updateNestedField('medications.post_op.steroid.taper_schedule', [2, 1, 0, 0])}
                          className="px-3 py-1 bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                        >
                          Short Taper
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Drop Selection */}
                      <div className="space-y-4">
                        {!data.medications?.post_op?.is_combination && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Select Medication</p>
                            {renderField('medications.post_op.steroid.name', 'Steroid Name', 'select', POST_OP_STEROIDS)}
                          </div>
                        )}
                        <div className="p-4 bg-white/60 border border-slate-100 rounded-2xl shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-3">Taper Schedule Visualizer</p>
                          <div className="flex items-center justify-between gap-1">
                            {(data.medications?.post_op?.steroid?.taper_schedule || [4, 3, 2, 1]).map((freq: number, i: number) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                                <div className={`w-full h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all ${freq > 0 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                                  {freq}x
                                </div>
                                <span className="text-[9px] font-black text-slate-400 uppercase">Wk {i + 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Manual Weekly Adjustments */}
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Manual Frequency Adjustment</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[0, 1, 2, 3].map((week) => (
                            <div key={week} className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                              <span className="text-xs font-extrabold text-slate-500">Week {week + 1}</span>
                              <div className="relative">
                                <select
                                  value={data.medications?.post_op?.steroid?.taper_schedule?.[week] || 0}
                                  onChange={(e) => {
                                    const next = [...(data.medications?.post_op?.steroid?.taper_schedule || [0, 0, 0, 0])];
                                    next[week] = parseInt(e.target.value);
                                    updateNestedField('medications.post_op.steroid.taper_schedule', next);
                                  }}
                                  className="bg-transparent text-sm font-black text-indigo-600 outline-none appearance-none pr-4"
                                >
                                  {[4, 3, 2, 1, 0].map(v => <option key={v} value={v}>{v}x</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* D. Glaucoma Section */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                          <AlertCircle size={18} />
                        </div>
                        <label className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">D. Glaucoma / Long-Term</label>
                      </div>
                      <div
                        onClick={() => updateNestedField('medications.post_op.glaucoma.resume', !data.medications?.post_op?.glaucoma?.resume)}
                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${data.medications?.post_op?.glaucoma?.resume ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${data.medications?.post_op?.glaucoma?.resume ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                    </div>
                    {data.medications?.post_op?.glaucoma?.resume && (
                      <div className="animate-fadeIn space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Medications to Resume</p>
                        {renderTagList('medications.post_op.glaucoma.medications', 'Select Medications')}
                        <div className="relative">
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              const current = data.medications?.post_op?.glaucoma?.medications || [];
                              if (val && !current.includes(val)) {
                                updateNestedField('medications.post_op.glaucoma.medications', [...current, val]);
                              }
                            }}
                            className="w-full text-xs font-bold p-3 bg-white border border-slate-200 rounded-xl outline-none appearance-none"
                          >
                            <option value="">Quick Add Medication...</option>
                            {GLAUCOMA_DROPS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleCard>

          {/* Documents */}
          <CollapsibleCard
            title="Documents"
            subtitle="Consents & signatures"
            icon={<FileText size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center"
            expanded={expanded.documents}
            onToggle={() => setExpanded((p) => ({ ...p, documents: !p.documents }))}
            maxHeight="1000px"
          >
            {(data?.documents?.signed_consents || []).map((doc: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 bg-slate-50">
                <div className="grid grid-cols-2 gap-3 flex-1 pr-3">
                  {renderField(`documents.signed_consents.${idx}.name`, 'Form Name')}
                  {renderField(`documents.signed_consents.${idx}.date`, 'Date Signed', 'date')}
                </div>
                <button
                  onClick={() => {
                    const newList = data.documents.signed_consents.filter((_: any, i: number) => i !== idx);
                    updateNestedField('documents.signed_consents', newList);
                  }}
                  className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const current = data.documents?.signed_consents || [];
                updateNestedField('documents.signed_consents', [...current, { name: '', date: '' }]);
              }}
              className="w-full py-2 border border-dashed border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:border-blue-200 hover:text-blue-600 transition-colors"
            >
              + Add Signed Form
            </button>
          </CollapsibleCard>
        </div>

        {/* Right: upload + quick info */}
        {
          showUploads && (
            <div className="col-span-12 lg:col-span-4">
              <UploadPanel
                fileInputRef={fileInputRef}
                files={files}
                setFiles={setFiles}
                startExtraction={startExtraction}
                extracting={extracting}
                handleFileChange={handleFileChange}
                recentUploads={recentUploads}
                showAllUploads={showAllUploads}
                setShowAllUploads={setShowAllUploads}
              />
            </div>
          )
        }
      </div >

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
          {error}
        </div>
      )}
      <style>{`
        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div >
  );
};

export default PatientOnboarding;

