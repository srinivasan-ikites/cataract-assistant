import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Hospital,
  Upload,
  Save,
  CheckCircle2,
  Loader2,
  Shield,
  CreditCard,
  Plus,
  Trash2,
  Users,
  Clock4,
  BookOpen,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import CollapsibleCard from './components/CollapsibleCard';

interface ClinicSetupProps {
  clinicId: string;
  onBack: () => void;
}

const ClinicSetup: React.FC<ClinicSetupProps> = ({ clinicId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'extracted' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    staff: true,
    catalog: true,
    pricing: true,
    sop: true,
    scheduling: true,
    faq: true,
    documents: true,
    billing: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clone = (obj: any) => (obj ? JSON.parse(JSON.stringify(obj)) : {});

  const getValue = (path: string) => path.split('.').reduce((acc: any, key) => acc?.[key], data);

  const updateNestedField = (path: string, value: any) => {
    setData((prev: any) => {
      const newData = clone(prev);
      const parts = path.split('.');
      let current = newData;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || current[part] === null) {
          current[part] = isNaN(Number(parts[i + 1])) ? {} : [];
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
      return newData;
    });
  };

  const renderField = (
    path: string,
    label: string,
    type: 'text' | 'number' | 'textarea' = 'text',
    placeholder?: string,
  ) => {
    const val = getValue(path) ?? '';
    const base =
      'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 transition-all';
    return (
      <div className="group/field space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight group-focus-within/field:text-blue-600">
            {label}
          </label>
        </div>
        {type === 'textarea' ? (
          <textarea
            value={val}
            onChange={(e) => updateNestedField(path, e.target.value)}
            className={`${base} min-h-[96px] resize-none`}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          />
        ) : (
          <input
            type={type}
            value={val}
            onChange={(e) => updateNestedField(path, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
            className={base}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          />
        )}
      </div>
    );
  };

  const renderTagList = (path: string, label: string, placeholder = '') => {
    const list = getValue(path);
    const arr: string[] = Array.isArray(list) ? list : [];
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
        <div className="flex flex-wrap gap-2">
          {arr.map((item, idx) => (
            <span
              key={idx}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-2"
            >
              {item}
              <button
                onClick={() => updateNestedField(path, arr.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
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

  const addToArray = (path: string, template: any) => {
    const list = getValue(path);
    const arr = Array.isArray(list) ? list : [];
    updateNestedField(path, [...arr, template]);
  };

  const removeFromArray = (path: string, index: number) => {
    const list = getValue(path);
    const arr = Array.isArray(list) ? list : [];
    updateNestedField(path, arr.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        setLoading(true);
        const reviewed = await api.getReviewedClinic(clinicId);
        if (reviewed && reviewed.reviewed) {
          setData(reviewed.reviewed);
          setStatus('saved');
        } else {
          const extracted = await api.getExtractedClinic(clinicId);
          if (extracted && extracted.extracted) {
            setData(extracted.extracted);
            setStatus('extracted');
          } else {
            setData({});
          }
        }
      } catch (err) {
        setData({});
        console.log('No clinic data found');
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [clinicId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const startExtraction = async () => {
    if (files.length === 0) return;
    try {
      setExtracting(true);
      setError(null);
      const res = await api.uploadClinicDocs(clinicId, files);
      setData(res.extracted ?? res.data ?? res);
      setStatus('extracted');
    } catch (err: any) {
      setError(err?.message || 'Extraction failed');
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
          return arr.length ? arr : null;
        } else if (obj && typeof obj === 'object') {
          const next: any = {};
          Object.keys(obj).forEach((k) => {
            const cleaned = cleanData(obj[k]);
            if (cleaned !== null && cleaned !== '' && (Array.isArray(cleaned) ? cleaned.length > 0 : typeof cleaned === 'object' ? Object.keys(cleaned).length > 0 : true)) {
              next[k] = cleaned;
            }
          });
          return Object.keys(next).length ? next : null;
        }
        return obj;
      };

      const payload = cleanData(data) || {};
      await api.saveReviewedClinic(clinicId, payload);
      setStatus('saved');
      alert('Clinic settings saved successfully! Empty values were stripped.');
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading && data === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-40">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="font-medium">Syncing clinic intelligence...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-[fadeIn_0.4s_ease-out] max-w-[1200px] mx-auto h-full pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 bg-white shadow-sm transition-all"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Clinic Data</h1>
              {status === 'saved' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 uppercase tracking-tight border border-emerald-100">
                  <CheckCircle2 size={12} />
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 font-medium">Populate from uploads or edit manually, then save.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!data}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-sm transition-all ${
            !data ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Save size={18} />
          Save
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left rail: identity + upload */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <Hospital size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Clinic Identity</p>
                <p className="text-xs text-slate-400">Basics & branding</p>
              </div>
            </div>
            <div className="space-y-3">
              {renderField('clinic_identity.clinic_id', 'Clinic ID')}
              {renderField('clinic_identity.name', 'Clinic Name')}
              {renderField('clinic_identity.location_name', 'Location Name')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {renderField('clinic_identity.address.street', 'Street')}
              {renderField('clinic_identity.address.city', 'City')}
              {renderField('clinic_identity.address.state', 'State')}
              {renderField('clinic_identity.address.zip_code', 'ZIP Code')}
            </div>
            <div className="space-y-3">
              {renderField('clinic_identity.contact_info.phone_main', 'Main Phone')}
              {renderField('clinic_identity.contact_info.phone_surgical_coordinator', 'Surgical Coordinator Phone')}
              {renderField('clinic_identity.contact_info.website', 'Website')}
              {renderField('clinic_identity.contact_info.logo_url', 'Logo URL')}
              {renderField('clinic_identity.contact_info.primary_color_hex', 'Primary Color (Hex)')}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-50 text-blue-600">
                <Upload size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Upload & Extract</p>
                <p className="text-xs text-slate-400">Pricing, SOPs, brochures</p>
              </div>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all"
            >
              <p className="text-sm font-semibold text-slate-700">Drop PDFs/images or click to pick</p>
              <p className="text-xs text-slate-400">We extract into the form</p>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
            </div>
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="max-h-32 overflow-y-auto pr-1 custom-scrollbar space-y-1 text-xs text-slate-600">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="truncate">{f.name}</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={startExtraction}
                  disabled={extracting}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition-all disabled:opacity-70"
                >
                  {extracting ? 'Uploading & extracting...' : 'Run Extraction'}
                </button>
              </div>
            )}
            {extracting && (
              <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-blue-600">
                <Loader2 className="animate-spin" size={22} />
                <p className="text-sm font-semibold text-slate-600">Processing...</p>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <CollapsibleCard
            title="Staff Directory"
            subtitle="Roles and short bios"
            icon={<Users size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
            expanded={expanded.staff}
            onToggle={() => setExpanded((p) => ({ ...p, staff: !p.staff }))}
            maxHeight="1000px"
          >
            <div className="space-y-3">
              {(getValue('staff_directory') || []).map((staff: any, idx: number) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50/60 relative">
                  <button
                    onClick={() => removeFromArray('staff_directory', idx)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(`staff_directory.${idx}.staff_id`, 'Staff ID')}
                    {renderField(`staff_directory.${idx}.role`, 'Role')}
                    {renderField(`staff_directory.${idx}.display_name`, 'Display Name')}
                    {renderField(`staff_directory.${idx}.bio_short`, 'Bio', 'textarea')}
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  addToArray('staff_directory', { staff_id: '', role: '', display_name: '', bio_short: '' })
                }
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <Plus size={14} /> Add Staff
              </button>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Surgical Catalog"
            subtitle="Lens packages, methods, mandatory fees"
            icon={<CreditCard size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center"
            expanded={expanded.catalog}
            onToggle={() => setExpanded((p) => ({ ...p, catalog: !p.catalog }))}
            maxHeight="1600px"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Lens Packages</p>
                <button
                  onClick={() =>
                    addToArray('surgical_catalog.lens_packages', {
                      package_id: '',
                      name: '',
                      marketing_description: '',
                      category: '',
                      default_upgrade_price: null,
                      features: [],
                      tradeoffs_plain_language: [],
                      eligibility_notes: [],
                      insurance_coverage: '',
                    })
                  }
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Package
                </button>
              </div>
              {(getValue('surgical_catalog.lens_packages') || []).map((pkg: any, idx: number) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50/70 relative space-y-3">
                  <button
                    onClick={() => removeFromArray('surgical_catalog.lens_packages', idx)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(`surgical_catalog.lens_packages.${idx}.package_id`, 'Package ID')}
                    {renderField(`surgical_catalog.lens_packages.${idx}.name`, 'Name')}
                    {renderField(`surgical_catalog.lens_packages.${idx}.category`, 'Category')}
                    {renderField(`surgical_catalog.lens_packages.${idx}.default_upgrade_price`, 'Upgrade Price', 'number')}
                  </div>
                  {renderField(`surgical_catalog.lens_packages.${idx}.marketing_description`, 'Marketing Description', 'textarea')}
                  <div className="grid grid-cols-2 gap-3">
                    {renderTagList(`surgical_catalog.lens_packages.${idx}.features`, 'Features')}
                    {renderTagList(`surgical_catalog.lens_packages.${idx}.tradeoffs_plain_language`, 'Tradeoffs')}
                  </div>
                  {renderTagList(`surgical_catalog.lens_packages.${idx}.eligibility_notes`, 'Eligibility Notes')}
                  {renderField(`surgical_catalog.lens_packages.${idx}.insurance_coverage`, 'Insurance Coverage')}
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Surgery Methods</p>
                <button
                  onClick={() =>
                    addToArray('surgical_catalog.surgery_methods', {
                      method_id: '',
                      name: '',
                      description: '',
                      upgrade_cost: null,
                    })
                  }
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Method
                </button>
              </div>
              {(getValue('surgical_catalog.surgery_methods') || []).map((m: any, idx: number) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-white relative space-y-3">
                  <button
                    onClick={() => removeFromArray('surgical_catalog.surgery_methods', idx)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(`surgical_catalog.surgery_methods.${idx}.method_id`, 'Method ID')}
                    {renderField(`surgical_catalog.surgery_methods.${idx}.name`, 'Name')}
                    {renderField(`surgical_catalog.surgery_methods.${idx}.upgrade_cost`, 'Upgrade Cost', 'number')}
                    {renderField(`surgical_catalog.surgery_methods.${idx}.description`, 'Description', 'textarea')}
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Mandatory Fees</p>
                <div className="grid grid-cols-3 gap-3">
                  {renderField('surgical_catalog.mandatory_fees.refraction_fee.amount', 'Refraction Fee Amount', 'number')}
                  {renderField('surgical_catalog.mandatory_fees.refraction_fee.description', 'Description')}
                  {renderField('surgical_catalog.mandatory_fees.refraction_fee.is_optional', 'Is Optional')}
                </div>
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Packages & Pricing"
            subtitle="Estimates and financing"
            icon={<CreditCard size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center"
            expanded={expanded.pricing}
            onToggle={() => setExpanded((p) => ({ ...p, pricing: !p.pricing }))}
            maxHeight="1600px"
          >
            <div className="grid grid-cols-2 gap-3">
              {renderField('packages_and_pricing.currency', 'Currency')}
              {renderField('packages_and_pricing.estimate_disclaimer', 'Estimate Disclaimer')}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Packages</p>
              <button
                onClick={() =>
                  addToArray('packages_and_pricing.packages', {
                    package_id: '',
                    name: '',
                    surgery_type_id: '',
                    includes: [],
                    excludes: [],
                    patient_cost_estimate: { self_pay_range: { min: null, max: null }, notes: '' },
                    financing: { available: null, providers: [], min_months: null, max_months: null },
                    status: '',
                  })
                }
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add Package
              </button>
            </div>
            {(getValue('packages_and_pricing.packages') || []).map((pkg: any, idx: number) => (
              <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50/60 relative space-y-3">
                <button
                  onClick={() => removeFromArray('packages_and_pricing.packages', idx)}
                  className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"
                >
                  <Trash2 size={14} />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  {renderField(`packages_and_pricing.packages.${idx}.package_id`, 'Package ID')}
                  {renderField(`packages_and_pricing.packages.${idx}.name`, 'Name')}
                  {renderField(`packages_and_pricing.packages.${idx}.surgery_type_id`, 'Surgery Type ID')}
                  {renderField(`packages_and_pricing.packages.${idx}.status`, 'Status')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {renderTagList(`packages_and_pricing.packages.${idx}.includes`, 'Includes')}
                  {renderTagList(`packages_and_pricing.packages.${idx}.excludes`, 'Excludes')}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {renderField(`packages_and_pricing.packages.${idx}.patient_cost_estimate.self_pay_range.min`, 'Self-Pay Min', 'number')}
                  {renderField(`packages_and_pricing.packages.${idx}.patient_cost_estimate.self_pay_range.max`, 'Self-Pay Max', 'number')}
                  {renderField(`packages_and_pricing.packages.${idx}.patient_cost_estimate.notes`, 'Estimate Notes')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {renderField(`packages_and_pricing.packages.${idx}.financing.available`, 'Financing Available')}
                  {renderTagList(`packages_and_pricing.packages.${idx}.financing.providers`, 'Financing Providers')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {renderField(`packages_and_pricing.packages.${idx}.financing.min_months`, 'Min Months', 'number')}
                  {renderField(`packages_and_pricing.packages.${idx}.financing.max_months`, 'Max Months', 'number')}
                </div>
              </div>
            ))}

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Refund & Change Policy</p>
              {renderTagList('packages_and_pricing.refund_and_change_policy.upgrade_refund_conditions', 'Upgrade Refund Conditions')}
              {renderField('packages_and_pricing.refund_and_change_policy.cancellation_policy', 'Cancellation Policy', 'textarea')}
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Standard Operating Procedures"
            subtitle="Pre-op, meds, post-op cadence"
            icon={<Shield size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center"
            expanded={expanded.sop}
            onToggle={() => setExpanded((p) => ({ ...p, sop: !p.sop }))}
            maxHeight="1400px"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Pre-Op Instructions</p>
                <button
                  onClick={() => addToArray('standard_operating_procedures.pre_op_instructions', { id: '', title: '', text: '' })}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Instruction
                </button>
              </div>
              {(getValue('standard_operating_procedures.pre_op_instructions') || []).map((item: any, idx: number) => (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-white relative space-y-3">
                  <button
                    onClick={() => removeFromArray('standard_operating_procedures.pre_op_instructions', idx)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(`standard_operating_procedures.pre_op_instructions.${idx}.id`, 'ID')}
                    {renderField(`standard_operating_procedures.pre_op_instructions.${idx}.title`, 'Title')}
                  </div>
                  {renderField(`standard_operating_procedures.pre_op_instructions.${idx}.text`, 'Instruction', 'textarea')}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                {renderField('standard_operating_procedures.medication_schedule_template.start_days_before_surgery', 'Start Days Before Surgery', 'number')}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Default Drops</p>
                <button
                  onClick={() =>
                    addToArray('standard_operating_procedures.medication_schedule_template.default_drops', { name: '', frequency: '' })
                  }
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Drop
                </button>
              </div>
              {(getValue('standard_operating_procedures.medication_schedule_template.default_drops') || []).map((drop: any, idx: number) => (
                <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-slate-50/70 relative grid grid-cols-2 gap-3">
                  <button
                    onClick={() => removeFromArray('standard_operating_procedures.medication_schedule_template.default_drops', idx)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={12} />
                  </button>
                  {renderField(`standard_operating_procedures.medication_schedule_template.default_drops.${idx}.name`, 'Name')}
                  {renderField(`standard_operating_procedures.medication_schedule_template.default_drops.${idx}.frequency`, 'Frequency')}
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Post-Op Visit Cadence</p>
                <button
                  onClick={() =>
                    addToArray('standard_operating_procedures.post_op_visit_cadence', { visit_name: '', days_after_surgery: null })
                  }
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Visit
                </button>
              </div>
              {(getValue('standard_operating_procedures.post_op_visit_cadence') || []).map((visit: any, idx: number) => (
                <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-white relative grid grid-cols-2 gap-3">
                  <button
                    onClick={() => removeFromArray('standard_operating_procedures.post_op_visit_cadence', idx)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={12} />
                  </button>
                  {renderField(`standard_operating_procedures.post_op_visit_cadence.${idx}.visit_name`, 'Visit Name')}
                  {renderField(`standard_operating_procedures.post_op_visit_cadence.${idx}.days_after_surgery`, 'Days After Surgery', 'number')}
                </div>
              ))}
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Scheduling & Workflow"
            subtitle="Pre-op requirements and day-of rules"
            icon={<Clock4 size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
            expanded={expanded.scheduling}
            onToggle={() => setExpanded((p) => ({ ...p, scheduling: !p.scheduling }))}
            maxHeight="1400px"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Pre-Op Requirements</p>
                <button
                  onClick={() => addToArray('scheduling_and_workflow.preop_requirements', { id: '', name: '', mandatory: null })}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Requirement
                </button>
              </div>
              {(getValue('scheduling_and_workflow.preop_requirements') || []).map((req: any, idx: number) => (
                <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-slate-50/70 relative grid grid-cols-3 gap-3">
                  <button
                    onClick={() => removeFromArray('scheduling_and_workflow.preop_requirements', idx)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={12} />
                  </button>
                  {renderField(`scheduling_and_workflow.preop_requirements.${idx}.id`, 'ID')}
                  {renderField(`scheduling_and_workflow.preop_requirements.${idx}.name`, 'Name')}
                  {renderField(`scheduling_and_workflow.preop_requirements.${idx}.mandatory`, 'Mandatory')}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                {renderField('scheduling_and_workflow.typical_timeline.preop_window_days', 'Pre-Op Window (days)', 'number')}
                {renderTagList('scheduling_and_workflow.typical_timeline.postop_visit_days', 'Post-Op Visit Days')}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {renderField('scheduling_and_workflow.arrival_and_day_of_surgery.arrival_lead_minutes', 'Arrival Lead (mins)', 'number')}
                {renderField('scheduling_and_workflow.arrival_and_day_of_surgery.driver_required', 'Driver Required')}
              </div>
              {renderField('scheduling_and_workflow.arrival_and_day_of_surgery.fasting_instructions_template', 'Fasting Instructions', 'textarea')}
              {renderTagList('scheduling_and_workflow.arrival_and_day_of_surgery.what_to_bring', 'What to Bring')}

              <div className="grid grid-cols-2 gap-3">
                {renderField('scheduling_and_workflow.reschedule_rules.minimum_notice_hours', 'Minimum Notice (hours)', 'number')}
                {renderField('scheduling_and_workflow.reschedule_rules.how_to_reschedule', 'How to Reschedule', 'textarea')}
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="FAQs & Patient Education"
            subtitle="Topics and handoff rules"
            icon={<BookOpen size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"
            expanded={expanded.faq}
            onToggle={() => setExpanded((p) => ({ ...p, faq: !p.faq }))}
            maxHeight="1000px"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Topics</p>
                <button
                  onClick={() => addToArray('faqs_and_patient_education.topics', { id: '', title: '' })}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Topic
                </button>
              </div>
              {(getValue('faqs_and_patient_education.topics') || []).map((t: any, idx: number) => (
                <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-white relative grid grid-cols-2 gap-3">
                  <button
                    onClick={() => removeFromArray('faqs_and_patient_education.topics', idx)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={12} />
                  </button>
                  {renderField(`faqs_and_patient_education.topics.${idx}.id`, 'ID')}
                  {renderField(`faqs_and_patient_education.topics.${idx}.title`, 'Title')}
                </div>
              ))}

              {renderTagList('faqs_and_patient_education.handoff_rules.requires_human_if', 'Requires Human If')}
              {renderTagList('faqs_and_patient_education.handoff_rules.handoff_contacts', 'Handoff Contacts')}
            </div>
          </CollapsibleCard>

          <CollapsibleCard
            title="Documents"
            subtitle="Standard forms and links"
            icon={<FileText size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center"
            expanded={expanded.documents}
            onToggle={() => setExpanded((p) => ({ ...p, documents: !p.documents }))}
            maxHeight="800px"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Standard Forms</p>
              <button
                onClick={() => addToArray('documents.standard_forms', { doc_id: '', name: '', url: '' })}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add Form
              </button>
            </div>
            {(getValue('documents.standard_forms') || []).map((doc: any, idx: number) => (
              <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-slate-50/70 relative grid grid-cols-3 gap-3">
                <button
                  onClick={() => removeFromArray('documents.standard_forms', idx)}
                  className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                >
                  <Trash2 size={12} />
                </button>
                {renderField(`documents.standard_forms.${idx}.doc_id`, 'Doc ID')}
                {renderField(`documents.standard_forms.${idx}.name`, 'Name')}
                {renderField(`documents.standard_forms.${idx}.url`, 'URL')}
              </div>
            ))}
          </CollapsibleCard>

          <CollapsibleCard
            title="Billing & Insurance"
            subtitle="Accepted payors and estimate flow"
            icon={<CreditCard size={16} />}
            iconClassName="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center"
            expanded={expanded.billing}
            onToggle={() => setExpanded((p) => ({ ...p, billing: !p.billing }))}
            maxHeight="800px"
          >
            <div className="space-y-3">
              {renderField('billing_and_insurance.accepted_insurance_notes', 'Accepted Insurance Notes', 'textarea')}
              {renderTagList('billing_and_insurance.payment_methods', 'Payment Methods')}
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Estimate Process Steps</p>
                <button
                  onClick={() => addToArray('billing_and_insurance.estimate_process.steps', '')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  + Add Step
                </button>
              </div>
              {(getValue('billing_and_insurance.estimate_process.steps') || []).map((step: any, idx: number) => (
                <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-white relative">
                  <button
                    onClick={() => removeFromArray('billing_and_insurance.estimate_process.steps', idx)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={12} />
                  </button>
                  {renderField(`billing_and_insurance.estimate_process.steps.${idx}`, `Step ${idx + 1}`, 'textarea')}
                </div>
              ))}
            </div>
          </CollapsibleCard>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default ClinicSetup;

