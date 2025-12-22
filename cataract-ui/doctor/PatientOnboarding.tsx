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
        console.log('No existing data for this patient');
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
            className={`p-3 rounded-xl shadow-sm transition-all ${
              deleting ? 'bg-rose-100 text-rose-300 cursor-not-allowed' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
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
            className={`p-3 rounded-xl shadow-sm transition-all ${
              !data || status === 'saved'
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
        {showUploads && (
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
        )}
      </div>

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
    </div>
  );
};

export default PatientOnboarding;

