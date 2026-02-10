import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  ArrowLeft,
  Hospital,
  Upload,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Users,
  FileText,
  Package,
  Pill,
  Eye,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Settings2,
  Sparkles,
  AlertCircle,
  Calendar,
  Clock,
  Award,
  LayoutDashboard,
  X,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { ClinicSetupSkeleton, ButtonLoader } from '../components/Loader';
import {
  ANTIBIOTIC_OPTIONS,
  POST_OP_NSAIDS,
  POST_OP_STEROIDS,
  GLAUCOMA_DROPS,
} from '../constants/medications';

interface ClinicSetupProps {
  clinicId: string;
  onBack: () => void;
}

type TabId = 'profile' | 'staff' | 'packages' | 'lenses' | 'medications' | 'billing' | 'documents';

// Memoized form field components - MUST be outside main component to prevent re-creation
interface TextFieldProps {
  value: string | number;
  onChange: (val: string | number) => void;
  label: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}

const TextField = memo(({ value, onChange, label, placeholder, type = 'text', disabled = false }: TextFieldProps) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      disabled={disabled}
      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50 disabled:text-slate-400"
      placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
    />
  </div>
));

interface TextAreaProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  placeholder?: string;
  rows?: number;
}

const TextArea = memo(({ value, onChange, label, placeholder, rows = 3 }: TextAreaProps) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
          <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
          />
      </div>
));

interface ArrayFieldProps {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (idx: number) => void;
  label: string;
}

const ArrayField = memo(({ items, onAdd, onRemove, label }: ArrayFieldProps) => {
  const [inputValue, setInputValue] = useState('');

    return (
      <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
        <div className="flex flex-wrap gap-2">
        {items.map((item: string, idx: number) => (
          <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-xs font-semibold text-blue-700">
              {item}
            <button onClick={() => onRemove(idx)} className="text-blue-400 hover:text-blue-600">×</button>
            </span>
          ))}
        </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputValue.trim()) {
              onAdd(inputValue.trim());
              setInputValue('');
            }
          }}
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
          placeholder={`Add ${label.toLowerCase()}...`}
        />
        <button
          onClick={() => {
            if (inputValue.trim()) {
              onAdd(inputValue.trim());
              setInputValue('');
            }
          }}
          className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100"
        >
          <Plus size={14} />
        </button>
      </div>
      </div>
    );
});

// Memoized medication item row - MUST be outside main component to prevent focus loss
interface MedItemProps {
  item: any;
  index: number;
  path: string;
  showCategory?: boolean;
  onUpdateField: (path: string, value: any) => void;
  onRemove: () => void;
}

const MedItem = memo(({
  item,
  index,
  path,
  showCategory = false,
  onUpdateField,
  onRemove
}: MedItemProps) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group">
    <input
      type="text"
      value={item.name || ''}
      onChange={(e) => onUpdateField(`${path}.${index}.name`, e.target.value)}
      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
      placeholder="Medication name..."
    />
    {showCategory && (
      <input
        type="text"
        value={item.category || ''}
        onChange={(e) => onUpdateField(`${path}.${index}.category`, e.target.value)}
        className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
        placeholder="Category..."
      />
    )}
    <button
      onClick={onRemove}
      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded opacity-0 group-hover:opacity-100 transition-all"
    >
      <Trash2 size={14} />
    </button>
  </div>
));

// Memoized medication list - MUST be outside main component to prevent focus loss
interface MedListProps {
  path: string;
  label: string;
  items: any[];
  template: any;
  showCategory?: boolean;
  onUpdateField: (path: string, value: any) => void;
}

const MedList = memo(({ path, label, items, template, showCategory = false, onUpdateField }: MedListProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
      <button
        onClick={() => onUpdateField(path, [...items, { ...template, id: Date.now() }])}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        + Add
      </button>
    </div>
    {items.length === 0 ? (
      <p className="text-xs text-slate-400 italic py-2">No {label.toLowerCase()} configured</p>
    ) : (
      items.map((item: any, idx: number) => (
        <MedItem
          key={item.id || `med-${idx}`}
          item={item}
          index={idx}
          path={path}
          showCategory={showCategory}
          onUpdateField={onUpdateField}
          onRemove={() => onUpdateField(path, items.filter((_: any, i: number) => i !== idx))}
        />
      ))
    )}
  </div>
));

// Preset package templates that clinics can quickly add
const PRESET_PACKAGES = [
  // === STANDARD (Insurance Covered) ===
  {
    package_id: 'PKG_STD',
    display_name: 'Standard Monofocal',
    description: 'Basic cataract surgery with standard monofocal IOL. Covered by most insurance plans.',
    price_cash: 0,
    includes_laser: false,
    allowed_lens_codes: ['MONOFOCAL'],
    insurance_coverage: 'Fully covered by Medicare/most insurances',
  },
  {
    package_id: 'PKG_LASER_LRI',
    display_name: 'Monofocal + Laser',
    description: 'Femtosecond laser-assisted surgery with limbal relaxing incisions for minor astigmatism.',
    price_cash: 1900,
    includes_laser: true,
    allowed_lens_codes: ['MONOFOCAL'],
    insurance_coverage: 'Laser portion is out-of-pocket',
  },
  // === PREMIUM - EDOF ===
  {
    package_id: 'PKG_EDOF',
    display_name: 'EDOF (Extended Depth)',
    description: 'Extended Depth of Focus lens for excellent intermediate vision with minimal halos.',
    price_cash: 2500,
    includes_laser: false,
    allowed_lens_codes: ['EDOF', 'EDOF_TORIC'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
  {
    package_id: 'PKG_EDOF_LASER',
    display_name: 'EDOF + Laser',
    description: 'Extended Depth of Focus lens with femtosecond laser precision for enhanced results.',
    price_cash: 3000,
    includes_laser: true,
    allowed_lens_codes: ['EDOF', 'EDOF_TORIC'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
  // === PREMIUM - MULTIFOCAL ===
  {
    package_id: 'PKG_MULTIFOCAL',
    display_name: 'Multifocal',
    description: 'Multifocal IOL for near, intermediate, and distance vision with reduced glasses dependence.',
    price_cash: 3500,
    includes_laser: false,
    allowed_lens_codes: ['MULTIFOCAL', 'MULTIFOCAL_TORIC'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
  {
    package_id: 'PKG_MULTIFOCAL_LASER',
    display_name: 'Multifocal + Laser',
    description: 'Multifocal IOL with femtosecond laser precision for optimal visual outcomes.',
    price_cash: 4000,
    includes_laser: true,
    allowed_lens_codes: ['MULTIFOCAL', 'MULTIFOCAL_TORIC'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
  // === PREMIUM - LAL ===
  {
    package_id: 'PKG_LAL',
    display_name: 'Light Adjustable Lens',
    description: 'RxSight LAL - vision fine-tuned after surgery using UV light treatments.',
    price_cash: 4900,
    includes_laser: true,
    allowed_lens_codes: ['LAL'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
  // === ASTIGMATISM ADD-ON (Toric) ===
  // Note: Toric is an add-on that can be combined with Monofocal, EDOF, or Multifocal
  {
    package_id: 'PKG_TORIC',
    display_name: 'Toric (Astigmatism)',
    description: 'Toric IOL for patients with significant corneal astigmatism. Can be combined with any base lens type.',
    price_cash: 1800,
    includes_laser: false,
    allowed_lens_codes: ['MONOFOCAL_TORIC', 'EDOF_TORIC', 'MULTIFOCAL_TORIC'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
  {
    package_id: 'PKG_TORIC_LASER',
    display_name: 'Toric + Laser',
    description: 'Toric IOL with femtosecond laser precision for enhanced astigmatism correction.',
    price_cash: 2200,
    includes_laser: true,
    allowed_lens_codes: ['MONOFOCAL_TORIC', 'EDOF_TORIC', 'MULTIFOCAL_TORIC'],
    insurance_coverage: 'Premium portion out-of-pocket',
  },
];

// Validation helper - checks for missing fields
interface MissingField {
  section: string;
  fields: string[];
}

const validateClinicData = (data: any): MissingField[] => {
  const missing: MissingField[] = [];

  // Profile validation
  const profileFields: string[] = [];
  if (!data?.clinic_profile?.name) profileFields.push('Clinic Name');
  if (!data?.clinic_profile?.address?.street) profileFields.push('Street Address');
  if (!data?.clinic_profile?.address?.city) profileFields.push('City');
  if (!data?.clinic_profile?.address?.state) profileFields.push('State');
  if (!data?.clinic_profile?.contact_info?.phone_main) profileFields.push('Main Phone');
  if (profileFields.length > 0) missing.push({ section: 'Profile', fields: profileFields });

  // Staff validation
  const staff = data?.staff_directory || [];
  if (staff.length === 0) {
    missing.push({ section: 'Staff Directory', fields: ['No staff members added'] });
  } else {
    const staffIssues: string[] = [];
    staff.forEach((s: any, idx: number) => {
      if (!s.name) staffIssues.push(`Staff #${idx + 1}: Missing name`);
      if (!s.role) staffIssues.push(`Staff #${idx + 1}: Missing role`);
    });
    if (staffIssues.length > 0) missing.push({ section: 'Staff Directory', fields: staffIssues });
  }

  // Packages validation
  const packages = data?.surgical_packages || [];
  if (packages.length === 0) {
    missing.push({ section: 'Surgical Packages', fields: ['No packages configured'] });
  }

  // Lens inventory validation
  const lensInventory = data?.lens_inventory || {};
  const lensCategories = Object.keys(lensInventory).filter(k => !k.startsWith('_'));
  if (lensCategories.length === 0) {
    missing.push({ section: 'Lens Inventory', fields: ['No lens categories configured'] });
  }

  // Medications validation
  const meds = data?.medications || {};
  const medFields: string[] = [];
  if (!meds.pre_op?.antibiotics?.length) medFields.push('Pre-op antibiotics not configured');
  if (!meds.post_op?.antibiotics?.length) medFields.push('Post-op antibiotics not configured');
  if (medFields.length > 0) missing.push({ section: 'Medications', fields: medFields });

  return missing;
};

const ClinicSetup: React.FC<ClinicSetupProps> = ({ clinicId, onBack }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [expandedLensCategory, setExpandedLensCategory] = useState<string | null>(null);
  const [hasUserInteractedWithLens, setHasUserInteractedWithLens] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [expandedMedSection, setExpandedMedSection] = useState<string | null>('pre_op'); // Default expand pre-op
  const fileInputRef = useRef<HTMLInputElement>(null);
  const packagesEndRef = useRef<HTMLDivElement>(null);
  const lensInventoryEndRef = useRef<HTMLDivElement>(null);
  const newLensCategoryRef = useRef<HTMLDivElement>(null);

  const clone = useCallback((obj: any) => (obj ? JSON.parse(JSON.stringify(obj)) : {}), []);

  const getValue = useCallback((path: string) => path.split('.').reduce((acc: any, key) => acc?.[key], data), [data]);

  const updateNestedField = useCallback((path: string, value: any) => {
    setData((prev: any) => {
      const newData = JSON.parse(JSON.stringify(prev || {}));
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
  }, []);

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        setLoading(true);
        // First try to get reviewed clinic data
        const reviewed = await api.getReviewedClinic(clinicId);
        if (reviewed && reviewed.reviewed) {
          setData(reviewed.reviewed);
          setStatus('saved');
        } else {
          // Fall back to base clinic config
          const config = await api.getClinicConfig(clinicId);
          if (config) {
            setData(config);
            setStatus('idle');
          } else {
            // Initialize empty structure
            setData({
              clinic_profile: { clinic_id: clinicId },
              staff_directory: [],
              surgical_packages: [],
              lens_inventory: {},
              medications: { pre_op: {}, post_op: {} },
              billing_and_insurance: {},
              documents: { standard_forms: [] },
            });
          }
        }
      } catch (err) {
        console.log('No clinic data found - starting fresh');
        setData({
          clinic_profile: { clinic_id: clinicId },
          staff_directory: [],
          surgical_packages: [],
          lens_inventory: {},
          medications: { pre_op: {}, post_op: {} },
          billing_and_insurance: {},
          documents: { standard_forms: [] },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [clinicId]);

  // Actual save operation
  const performSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.saveReviewedClinic(clinicId, data);
      setStatus('saved');
      toast.success('Configuration Saved', 'Clinic settings have been updated successfully.');
    } catch (err: any) {
      const errorMsg = err?.message || 'Save failed';
      setError(errorMsg);
      toast.error('Save Failed', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Save initiation with validation
  const handleSave = () => {
    const missing = validateClinicData(data);
    
    if (missing.length > 0) {
      // Show confirmation modal with missing fields
      setMissingFields(missing);
      setShowConfirmModal(true);
    } else {
      // All fields complete, save directly
      performSave();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      toast.info('Files Added', `${e.target.files.length} file(s) ready for extraction.`);
    }
  };

  const startExtraction = async () => {
    if (files.length === 0) return;
    try {
      setExtracting(true);
      setError(null);
      toast.info('Extracting...', 'Processing your documents.');
      const res = await api.uploadClinicDocs(clinicId, files);
      if (res.extracted) {
        setData((prev: any) => ({ ...prev, ...res.extracted }));
        toast.success('Extraction Complete', 'Document data has been extracted.');
      }
      setFiles([]);
    } catch (err: any) {
      const errorMsg = err?.message || 'Extraction failed';
      setError(errorMsg);
      toast.error('Extraction Failed', errorMsg);
    } finally {
      setExtracting(false);
    }
  };

  // Helper functions to render form fields with path-based binding
  const renderTextField = (path: string, label: string, options?: { placeholder?: string; type?: string; disabled?: boolean }) => (
    <TextField
      value={getValue(path) ?? ''}
      onChange={(val) => updateNestedField(path, val)}
      label={label}
      placeholder={options?.placeholder}
      type={options?.type}
      disabled={options?.disabled}
    />
  );

  const renderTextArea = (path: string, label: string, options?: { placeholder?: string; rows?: number }) => (
    <TextArea
      value={getValue(path) ?? ''}
      onChange={(val) => updateNestedField(path, val)}
      label={label}
      placeholder={options?.placeholder}
      rows={options?.rows}
    />
  );

  const renderArrayField = (path: string, label: string) => {
    const items = getValue(path) || [];
    return (
      <ArrayField
        items={items}
        onAdd={(item) => updateNestedField(path, [...items, item])}
        onRemove={(idx) => updateNestedField(path, items.filter((_: any, i: number) => i !== idx))}
        label={label}
      />
    );
  };

  // Navigation tabs
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <Hospital size={18} /> },
    { id: 'staff', label: 'Staff', icon: <Users size={18} /> },
    { id: 'packages', label: 'Packages', icon: <Package size={18} /> },
    { id: 'lenses', label: 'Lens Inventory', icon: <Eye size={18} /> },
    { id: 'medications', label: 'Medications', icon: <Pill size={18} /> },
    { id: 'billing', label: 'Billing', icon: <DollarSign size={18} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={18} /> },
  ];

  // Render sections
  const renderProfileSection = () => (
    <div className="space-y-6">
      {/* Clinic Identity - Primary section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Hospital size={16} className="text-blue-500" />
          Clinic Identity
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {renderTextField("clinic_profile.clinic_id", "Clinic ID", { disabled: true })}
          {renderTextField("clinic_profile.name", "Clinic Name")}
            </div>
        {renderTextField("clinic_profile.parent_organization", "Parent Organization")}
        <div className="grid grid-cols-2 gap-4">
          {renderTextField("clinic_profile.address.street", "Street Address")}
          {renderTextField("clinic_profile.address.city", "City")}
          </div>
        <div className="grid grid-cols-2 gap-4">
          {renderTextField("clinic_profile.address.state", "State")}
          {renderTextField("clinic_profile.address.zip", "ZIP Code")}
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          {renderTextField("clinic_profile.contact_info.phone_main", "Main Phone")}
          {renderTextField("clinic_profile.contact_info.phone_surgical_coordinator", "Surgical Coordinator")}
              </div>
        <div className="grid grid-cols-2 gap-4">
          {renderTextField("clinic_profile.contact_info.fax", "Fax")}
          {renderTextField("clinic_profile.contact_info.emergency_hotline", "Emergency Hotline")}
              </div>
        {renderTextField("clinic_profile.contact_info.website", "Website")}
          </div>

      {/* Document Import - Compact Card */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Upload size={18} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Quick Import</h3>
                <p className="text-xs text-slate-500">Upload documents to auto-fill fields</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold uppercase tracking-wide">Coming Soon</span>
          </div>
          
          {/* Compact drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-400', 'bg-white'); }}
            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-400', 'bg-white'); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-indigo-400', 'bg-white');
              const droppedFiles = Array.from(e.dataTransfer.files);
              setFiles(prev => [...prev, ...droppedFiles]);
              toast.info('Files Added', `${droppedFiles.length} file(s) ready for extraction.`);
            }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-400 hover:bg-white transition-all"
          >
            <p className="text-xs font-medium text-slate-500">
              <span className="text-indigo-600 font-semibold">Click to upload</span> or drag & drop
            </p>
            <p className="text-[10px] text-slate-400 mt-1">PDF, Images, Word documents</p>
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" />
            </div>

          {/* File list - compact */}
            {files.length > 0 && (
            <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-100 text-xs">
                  <FileText size={12} className="text-indigo-500" />
                  <span className="flex-1 truncate text-slate-600">{f.name}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }} 
                    className="text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                <button
                  onClick={startExtraction}
                  disabled={extracting}
                className="w-full mt-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                {extracting ? <ButtonLoader /> : <Sparkles size={14} />}
                {extracting ? 'Processing...' : 'Extract Data'}
                </button>
              </div>
            )}
              </div>
          </div>
        </div>
  );

  const renderStaffSection = () => {
    const staff = getValue('staff_directory') || [];
    const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const toggleDay = (path: string, day: string) => {
      const currentDays = getValue(path) || [];
      if (currentDays.includes(day)) {
        updateNestedField(path, currentDays.filter((d: string) => d !== day));
      } else {
        updateNestedField(path, [...currentDays, day]);
      }
    };

    const addStaff = () => {
      updateNestedField('staff_directory', [...staff, {
        provider_id: '',
        name: '',
        role: '',
        specialty: '',
        qualifications: [],
        experience_years: null,
        availability: {
          surgery_days: [],
          consultation_days: [],
          consultation_hours: ''
        }
      }]);
      toast.info('Staff Added', 'New staff member entry created.');
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Staff Directory</h3>
                  <button
            onClick={addStaff}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 flex items-center gap-1"
                  >
            <Plus size={14} /> Add Staff
                  </button>
                  </div>
        {staff.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No staff members added yet</p>
                </div>
        ) : (
          staff.map((s: any, idx: number) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden relative group">
              {/* Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Users size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{s.name || `Staff Member #${idx + 1}`}</p>
                    <p className="text-xs text-slate-400">{s.role || 'Role not set'}</p>
                  </div>
                </div>
              <button
                  onClick={() => {
                    updateNestedField('staff_directory', staff.filter((_: any, i: number) => i !== idx));
                    toast.warning('Staff Removed', 'Staff member has been removed.');
                  }}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
              </button>
            </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  {renderTextField(`staff_directory.${idx}.provider_id`, "Provider ID")}
                  {renderTextField(`staff_directory.${idx}.name`, "Full Name")}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {renderTextField(`staff_directory.${idx}.role`, "Role", { placeholder: "e.g., Surgeon, Counselor, Optometrist" })}
                  {renderTextField(`staff_directory.${idx}.specialty`, "Specialty")}
                </div>

                {/* Experience & Qualifications */}
                <div className="grid grid-cols-3 gap-4">
                  {renderTextField(`staff_directory.${idx}.experience_years`, "Years of Experience", { type: "number" })}
                  <div className="col-span-2">
                    {renderArrayField(`staff_directory.${idx}.qualifications`, "Qualifications (e.g., MD, FACS, Board Certified)")}
                  </div>
                </div>

                {/* Availability */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-500" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Availability</p>
                  </div>

                  {/* Surgery Days */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">Surgery Days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const selected = (s.availability?.surgery_days || []).includes(day);
                        return (
                <button
                            key={day}
                            onClick={() => toggleDay(`staff_directory.${idx}.availability.surgery_days`, day)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              selected
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-300'
                            }`}
                          >
                            {day.slice(0, 3)}
                </button>
                        );
                      })}
              </div>
                  </div>

                  {/* Consultation Days */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">Consultation Days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const selected = (s.availability?.consultation_days || []).includes(day);
                        return (
                  <button
                            key={day}
                            onClick={() => toggleDay(`staff_directory.${idx}.availability.consultation_days`, day)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              selected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300'
                            }`}
                          >
                            {day.slice(0, 3)}
                  </button>
                        );
                      })}
                  </div>
                  </div>

                  {/* Consultation Hours */}
                  <div className="flex items-center gap-3">
                    <Clock size={14} className="text-slate-400" />
                    {renderTextField(`staff_directory.${idx}.availability.consultation_hours`, "Consultation Hours", { placeholder: "e.g., 9am-5pm ET" })}
                </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderPackagesSection = () => {
    const packages = getValue('surgical_packages') || [];
    const existingIds = packages.map((p: any) => p.package_id);
    const availablePresets = PRESET_PACKAGES.filter(p => !existingIds.includes(p.package_id));

    const addPackageAndScroll = (pkg: any) => {
      updateNestedField('surgical_packages', [...packages, pkg]);
      // Scroll to the new package after a brief delay for DOM update
      setTimeout(() => {
        packagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    };

    const addCustomPackage = () => {
      const timestamp = Date.now();
      addPackageAndScroll({
        package_id: `PKG_CUSTOM_${timestamp}`,
        display_name: '',
                      description: '',
        price_cash: 0,
        includes_laser: false,
        allowed_lens_codes: [],
        insurance_coverage: '',
      });
    };

    return (
      <div className="space-y-6">
        {/* Quick Add Presets */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-blue-500" />
            <h4 className="text-sm font-bold text-slate-800">Quick Add Standard Packages</h4>
          </div>
          <p className="text-xs text-slate-500 mb-4">Click to add common surgery packages. You can customize them after adding.</p>
          
          {availablePresets.length === 0 ? (
            <p className="text-xs text-slate-400 italic">All standard packages have been added</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availablePresets.map((preset) => (
                <button
                  key={preset.package_id}
                  onClick={() => addPackageAndScroll({ ...preset })}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus size={12} />
                  {preset.display_name}
                  {preset.includes_laser && <span className="px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded text-[10px]">Laser</span>}
                </button>
              ))}
              </div>
          )}
        </div>

        {/* Existing Packages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Your Packages ({packages.length})</h3>
                  <button
              onClick={addCustomPackage}
              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 flex items-center gap-1"
                  >
              <Plus size={14} /> Add Custom
                  </button>
                  </div>
          
          {packages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Package size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No packages configured yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the quick add buttons above or add a custom package</p>
                </div>
          ) : (
            packages.map((pkg: any, idx: number) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 relative group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pkg.includes_laser ? 'bg-violet-100' : 'bg-slate-100'}`}>
                      <Package size={18} className={pkg.includes_laser ? 'text-violet-600' : 'text-slate-500'} />
              </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{pkg.display_name || 'Unnamed Package'}</p>
                      <p className="text-xs text-slate-400">{pkg.package_id}</p>
            </div>
                  </div>
                  <button
                    onClick={() => updateNestedField('surgical_packages', packages.filter((_: any, i: number) => i !== idx))}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
            </div>

                <div className="grid grid-cols-3 gap-4">
                  {renderTextField(`surgical_packages.${idx}.package_id`, "Package ID")}
                  {renderTextField(`surgical_packages.${idx}.display_name`, "Display Name")}
                  {renderTextField(`surgical_packages.${idx}.price_cash`, "Price ($)", { type: "number" })}
                </div>
                {renderTextArea(`surgical_packages.${idx}.description`, "Description", { rows: 2 })}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Includes Laser</label>
                    <div className="flex items-center gap-2">
              <button
                        onClick={() => updateNestedField(`surgical_packages.${idx}.includes_laser`, true)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${pkg.includes_laser ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        Yes
              </button>
                <button
                        onClick={() => updateNestedField(`surgical_packages.${idx}.includes_laser`, false)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${!pkg.includes_laser ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                        No
                </button>
                </div>
                </div>
                  {renderTextField(`surgical_packages.${idx}.insurance_coverage`, "Insurance Coverage")}
                </div>
                {renderArrayField(`surgical_packages.${idx}.allowed_lens_codes`, "Allowed Lens Categories")}
                </div>
            ))
          )}
          <div ref={packagesEndRef} />
                </div>
              </div>
    );
  };

  const renderLensInventorySection = () => {
    const inventory = getValue('lens_inventory') || {};
    const categories = Object.keys(inventory).filter(k => !k.startsWith('_'));

    // Handle accordion toggle - allow all to close
    const handleAccordionToggle = (catKey: string) => {
      setHasUserInteractedWithLens(true);
      if (expandedLensCategory === catKey) {
        setExpandedLensCategory(null);
      } else {
        setExpandedLensCategory(catKey);
        // Scroll the clicked accordion header into view (not to top, just ensure visible)
        setTimeout(() => {
          const element = document.getElementById(`lens-cat-${catKey}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      }
    };

    // Add new category with scroll
    const addNewCategory = () => {
      const newCat = `NEW_CATEGORY_${Date.now()}`;
      updateNestedField(`lens_inventory.${newCat}`, { display_name: 'New Category', description: '', models: [] });
      setExpandedLensCategory(newCat);
      setHasUserInteractedWithLens(true);
      // Scroll to new category after DOM update
      setTimeout(() => {
        lensInventoryEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    };

    // Determine which category to expand
    const getEffectiveExpanded = () => {
      // If user has interacted, respect their choice (including null = all closed)
      if (hasUserInteractedWithLens) {
        return expandedLensCategory;
      }
      // Default: expand first category only on initial load
      return categories.length > 0 ? categories[0] : null;
    };

    const effectiveExpanded = getEffectiveExpanded();

    return (
      <div className="space-y-4">
              <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Lens Inventory</h3>
                <button
            onClick={addNewCategory}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 flex items-center gap-1"
                >
            <Plus size={14} /> Add Category
                </button>
              </div>
        
        {categories.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Eye size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No lens categories configured</p>
          </div>
        ) : (
          categories.map((catKey) => {
            const cat = inventory[catKey];
            const isExpanded = effectiveExpanded === catKey;
            const models = cat?.models || [];
            const isToric = catKey.includes('TORIC');

            return (
              <div key={catKey} id={`lens-cat-${catKey}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                  onClick={() => handleAccordionToggle(catKey)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isToric ? 'bg-amber-50' : 'bg-violet-50'}`}>
                      <Eye size={18} className={isToric ? 'text-amber-500' : 'text-violet-500'} />
                  </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{cat?.display_name || catKey}</p>
                        {isToric && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase tracking-wide">TORIC</span>}
                </div>
                      <p className="text-xs text-slate-400">{models.length} lens model{models.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {renderTextField(`lens_inventory.${catKey}.display_name`, "Category Name")}
                      {renderTextField(`lens_inventory.${catKey}.description`, "Description")}
              </div>

                    <div className="space-y-3">
              <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500 uppercase">Lens Models ({models.length})</p>
                <button
                          onClick={() => updateNestedField(`lens_inventory.${catKey}.models`, [...models, { manufacturer: '', model: '', model_code: '', description: '' }])}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          + Add Model
                </button>
              </div>
                      
                      {models.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <p className="text-xs">No models added yet</p>
                        </div>
                      ) : (
                        models.map((model: any, mIdx: number) => (
                          <div key={mIdx} className="p-4 bg-slate-50 rounded-xl space-y-3 relative group">
                  <button
                              onClick={() => updateNestedField(`lens_inventory.${catKey}.models`, models.filter((_: any, i: number) => i !== mIdx))}
                              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-white rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                            <div className="grid grid-cols-2 gap-3">
                              {renderTextField(`lens_inventory.${catKey}.models.${mIdx}.manufacturer`, "Manufacturer")}
                              {renderTextField(`lens_inventory.${catKey}.models.${mIdx}.model`, "Model Name")}
                </div>
                            <div className="grid grid-cols-2 gap-3">
                              {renderTextField(`lens_inventory.${catKey}.models.${mIdx}.model_code`, "Model Code")}
                              {renderTextField(`lens_inventory.${catKey}.models.${mIdx}.description`, "Description")}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Delete Category Button */}
                    <div className="pt-3 border-t border-slate-100">
                <button
                        onClick={() => {
                          const newInventory = { ...inventory };
                          delete newInventory[catKey];
                          updateNestedField('lens_inventory', newInventory);
                          setExpandedLensCategory(null);
                        }}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete Category
                </button>
              </div>
                </div>
                )}
            </div>
            );
          })
        )}
        <div ref={lensInventoryEndRef} />
      </div>
    );
  };

  const renderMedicationsSection = () => {
    const preOpAntibiotics = getValue('medications.pre_op.antibiotics') || [];
    const postOpAntibiotics = getValue('medications.post_op.antibiotics') || [];
    const nsaids = getValue('medications.post_op.nsaids') || [];
    const steroids = getValue('medications.post_op.steroids') || [];
    const glaucomaDrops = getValue('medications.post_op.glaucoma_drops') || [];
    const combinationDrops = getValue('medications.post_op.combination_drops') || [];

    // Get existing medication names for filtering available presets
    const existingPreOpAntibioticNames = preOpAntibiotics.map((m: any) => m.name?.toLowerCase());
    const existingPostOpAntibioticNames = postOpAntibiotics.map((m: any) => m.name?.toLowerCase());
    const existingNsaidNames = nsaids.map((m: any) => m.name?.toLowerCase());
    const existingSteroidNames = steroids.map((m: any) => m.name?.toLowerCase());
    const existingGlaucomaNames = glaucomaDrops.map((m: any) => m.name?.toLowerCase());

    // Available presets (filter out already added ones)
    const availablePreOpAntibiotics = ANTIBIOTIC_OPTIONS.filter(
      a => !existingPreOpAntibioticNames.includes(a.name.toLowerCase())
    );
    const availablePostOpAntibiotics = ANTIBIOTIC_OPTIONS.filter(
      a => !existingPostOpAntibioticNames.includes(a.name.toLowerCase())
    );
    const availableNsaids = POST_OP_NSAIDS.filter(
      n => !existingNsaidNames.includes(n.name.toLowerCase())
    );
    const availableSteroids = POST_OP_STEROIDS.filter(
      s => !existingSteroidNames.includes(s.toLowerCase())
    );
    const availableGlaucoma = GLAUCOMA_DROPS.filter(
      g => !existingGlaucomaNames.includes(g.toLowerCase())
    );

    // Helper to add medication
    const addMedication = (path: string, currentItems: any[], newItem: any) => {
      updateNestedField(path, [...currentItems, { ...newItem, id: Date.now() }]);
    };

    // Render medication items with input fields (editable) + quick add defaults
    const renderMedicationSection = (
      label: string,
      path: string,
      items: any[],
      availableDefaults: any[],
      defaultTemplate: any,
      accentColor: string,
      formatDefault?: (item: any) => any
    ) => (
      <div className="space-y-3">
        {/* Header with Add button */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
          <button
            onClick={() => addMedication(path, items, defaultTemplate)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            + Add
          </button>
        </div>

        {/* Quick add defaults - FIXED AT TOP */}
        {availableDefaults.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles size={12} className={accentColor} />
              <p className="text-[10px] font-semibold text-slate-500 uppercase">Quick Add Defaults</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableDefaults.map((item: any, idx: number) => {
                const displayName = typeof item === 'string' ? item : item.name;
                const itemToAdd = formatDefault ? formatDefault(item) : { name: displayName };
                return (
                  <button
                    key={idx}
                    onClick={() => addMedication(path, items, itemToAdd)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all"
                  >
                    <Plus size={10} />
                    {displayName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Added medications with input fields - BELOW quick add defaults */}
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No {label.toLowerCase()} configured</p>
        ) : (
          <div className="space-y-2">
            {items.map((item: any, idx: number) => (
              <div key={item.id || `med-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group">
                <input
                  type="text"
                  value={item.name || ''}
                  onChange={(e) => updateNestedField(`${path}.${idx}.name`, e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
                  placeholder="Medication name..."
                />
                <button
                  onClick={() => updateNestedField(path, items.filter((_: any, i: number) => i !== idx))}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // Helper to render accordion header
    const renderAccordionHeader = (id: string, title: string, icon: React.ReactNode, bgColor: string, itemCount: number) => (
      <button
        onClick={() => setExpandedMedSection(expandedMedSection === id ? null : id)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}>
            {icon}
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">{title}</p>
            <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} configured</p>
          </div>
        </div>
        {expandedMedSection === id ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
      </button>
    );

    return (
      <div className="space-y-3">
        {/* Pre-Op Medications */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {renderAccordionHeader('pre_op', 'Pre-Op Medications', <Pill size={18} className="text-emerald-500" />, 'bg-emerald-50', preOpAntibiotics.length)}
          {expandedMedSection === 'pre_op' && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              {renderMedicationSection(
                'Antibiotics',
                'medications.pre_op.antibiotics',
                preOpAntibiotics,
                availablePreOpAntibiotics,
                { name: '' },
                'text-emerald-500'
              )}
              {renderTextField("medications.pre_op.default_start_days_before_surgery", "Start Days Before Surgery", { type: "number" })}
            </div>
          )}
        </div>

        {/* Post-Op Medications - Single accordion with Antibiotics, NSAIDs, Steroids inside */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {renderAccordionHeader('post_op', 'Post-Op Medications', <Pill size={18} className="text-blue-500" />, 'bg-blue-50', postOpAntibiotics.length + nsaids.length + steroids.length)}
          {expandedMedSection === 'post_op' && (
            <div className="px-5 pb-5 space-y-6 border-t border-slate-100 pt-4">
              {/* Antibiotics */}
              {renderMedicationSection(
                'Antibiotics',
                'medications.post_op.antibiotics',
                postOpAntibiotics,
                availablePostOpAntibiotics,
                { name: '', default_frequency: 4, default_weeks: 1 },
                'text-blue-500'
              )}

              <hr className="border-slate-100" />

              {/* NSAIDs */}
              {renderMedicationSection(
                'NSAIDs',
                'medications.post_op.nsaids',
                nsaids,
                availableNsaids,
                { name: '', default_frequency: 4, frequency_label: '4x Daily', default_weeks: 4 },
                'text-orange-500',
                (item) => ({
                  name: item.name,
                  default_frequency: item.defaultFrequency,
                  frequency_label: item.label,
                  default_weeks: 4
                })
              )}

              <hr className="border-slate-100" />

              {/* Steroids */}
              {renderMedicationSection(
                'Steroids',
                'medications.post_op.steroids',
                steroids,
                availableSteroids,
                { name: '', default_taper: [4, 3, 2, 1], default_weeks: 4 },
                'text-purple-500',
                (item) => ({
                  name: typeof item === 'string' ? item : item.name,
                  default_taper: [4, 3, 2, 1],
                  default_weeks: 4
                })
              )}
            </div>
          )}
        </div>

        {/* Glaucoma Medications */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {renderAccordionHeader('glaucoma', 'Glaucoma Medications', <Eye size={18} className="text-violet-500" />, 'bg-violet-50', glaucomaDrops.length)}
          {expandedMedSection === 'glaucoma' && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 mb-3">Configure available glaucoma drops for patients with pre-existing glaucoma.</p>
              {renderMedicationSection(
                'Glaucoma Drops',
                'medications.post_op.glaucoma_drops',
                glaucomaDrops,
                availableGlaucoma.slice(0, 10), // Show first 10 defaults
                { name: '', category: '' },
                'text-violet-500',
                (item) => ({ name: typeof item === 'string' ? item : item.name, category: '' })
              )}
              {availableGlaucoma.length > 10 && (
                <p className="text-xs text-slate-400 italic">+{availableGlaucoma.length - 10} more defaults available</p>
              )}
            </div>
          )}
        </div>

        {/* Combination Drops */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {renderAccordionHeader('combination', 'Combination Drops', <Sparkles size={18} className="text-amber-500" />, 'bg-amber-50', combinationDrops.length)}
          {expandedMedSection === 'combination' && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 mb-3">Pre-mixed combination drops available at your clinic.</p>
              <MedList
                path="medications.post_op.combination_drops"
                label="Combination Drops"
                items={combinationDrops}
                template={{ name: '', components: [] }}
                onUpdateField={updateNestedField}
              />
            </div>
          )}
        </div>

        {/* Dropless Option */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {renderAccordionHeader('dropless', 'Dropless Surgery Option', <CheckCircle2 size={18} className="text-teal-500" />, 'bg-teal-50', getValue('medications.post_op.dropless_option.available') ? 1 : 0)}
          {expandedMedSection === 'dropless' && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-4 mb-4">
                <label className="text-xs font-semibold text-slate-500">Available</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateNestedField('medications.post_op.dropless_option.available', true)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      getValue('medications.post_op.dropless_option.available')
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => updateNestedField('medications.post_op.dropless_option.available', false)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      !getValue('medications.post_op.dropless_option.available')
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              {renderTextArea("medications.post_op.dropless_option.description", "Description", { rows: 2 })}
              {renderArrayField("medications.post_op.dropless_option.medications", "Available Dropless Medications")}
            </div>
          )}
        </div>

        {/* Default Frequency Options - Always visible as it's a general setting */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-700">Default Frequency Options</h3>
          </div>
          <p className="text-xs text-slate-500">Configure default frequency labels. Doctors will select these per patient.</p>
          <div className="grid grid-cols-2 gap-3">
            {(getValue('medications.frequency_options') || []).map((opt: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200">
                <input
                  type="text"
                  value={opt.label || ''}
                  onChange={(e) => updateNestedField(`medications.frequency_options.${idx}.label`, e.target.value)}
                  className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-400"
                  placeholder="Label..."
                />
                <input
                  type="number"
                  value={opt.times_per_day || ''}
                  onChange={(e) => updateNestedField(`medications.frequency_options.${idx}.times_per_day`, Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-400 text-center"
                  placeholder="x/day"
                />
                  <button
                  onClick={() => {
                    const opts = getValue('medications.frequency_options') || [];
                    updateNestedField('medications.frequency_options', opts.filter((_: any, i: number) => i !== idx));
                  }}
                  className="p-1 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
          <button
            onClick={() => {
              const opts = getValue('medications.frequency_options') || [];
              updateNestedField('medications.frequency_options', [...opts, { id: Date.now(), label: '', times_per_day: 4 }]);
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            + Add Frequency Option
          </button>
        </div>
      </div>
    );
  };

  const renderBillingSection = () => (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <DollarSign size={16} className="text-green-500" />
          Payment & Insurance
        </h3>
        {renderTextArea("billing_and_insurance.payment_policy", "Payment Policy", { rows: 2 })}
        <div className="grid grid-cols-2 gap-4">
          {renderTextField("billing_and_insurance.post_op_refraction_fee.amount", "Refraction Fee ($)", { type: "number" })}
          {renderTextField("billing_and_insurance.post_op_refraction_fee.description", "Fee Description")}
            </div>
        {renderTextArea("billing_and_insurance.accepted_insurance_notes", "Insurance Notes", { rows: 2 })}
        {renderArrayField("billing_and_insurance.payment_methods", "Accepted Payment Methods")}
            </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Financing Options</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Financing Available</label>
            <div className="flex items-center gap-2">
                <button
                onClick={() => updateNestedField('billing_and_insurance.financing.available', true)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${getValue('billing_and_insurance.financing.available') ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                Yes
                </button>
                  <button
                onClick={() => updateNestedField('billing_and_insurance.financing.available', false)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${!getValue('billing_and_insurance.financing.available') ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                No
                  </button>
                </div>
            </div>
          {renderTextField("billing_and_insurance.financing.zero_interest_months", "0% Interest Months", { type: "number" })}
        </div>
        {renderArrayField("billing_and_insurance.financing.providers", "Financing Providers")}
      </div>
    </div>
  );

  // ── Form Templates State (separate from main clinic data) ──
  const [formTemplates, setFormTemplates] = useState<Record<string, any>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [uploadingForm, setUploadingForm] = useState<string | null>(null);
  const formFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const FORM_TYPES = [
    { id: 'medical_clearance', label: 'Medical Clearance', description: 'Confirms the patient is medically fit for surgery. Completed by the patient\'s primary care physician.', icon: <ShieldCheck size={20} /> },
    { id: 'iol_selection', label: 'IOL Selection', description: 'Documents the patient\'s chosen intraocular lens type and confirms understanding of the options.', icon: <Eye size={20} /> },
    { id: 'consent', label: 'Consent Form', description: 'Informed consent for the cataract surgery procedure, including risks, benefits, and alternatives.', icon: <FileText size={20} /> },
  ];

  const loadFormTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const result = await api.getFormTemplates(clinicId);
      if (result?.templates) setFormTemplates(result.templates);
    } catch (err) {
      console.error('Failed to load form templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [clinicId]);

  // Load templates when Documents tab is activated
  useEffect(() => {
    if (activeTab === 'documents') {
      loadFormTemplates();
    }
  }, [activeTab, loadFormTemplates]);

  const handleFormTemplateUpload = async (formType: string, file: File) => {
    try {
      setUploadingForm(formType);
      await api.uploadFormTemplate(clinicId, formType, file);
      toast.success('Uploaded', `${FORM_TYPES.find(f => f.id === formType)?.label} template uploaded successfully.`);
      await loadFormTemplates();
    } catch (err: any) {
      toast.error('Upload failed', err.message || 'Could not upload the form template.');
    } finally {
      setUploadingForm(null);
    }
  };

  const handleFormTemplateDelete = async (formType: string) => {
    try {
      setUploadingForm(formType);
      await api.deleteFormTemplate(clinicId, formType);
      toast.success('Deleted', 'Form template removed.');
      await loadFormTemplates();
    } catch (err: any) {
      toast.error('Delete failed', err.message || 'Could not delete the template.');
    } finally {
      setUploadingForm(null);
    }
  };

  const renderDocumentsSection = () => {
    if (loadingTemplates) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-40" />
                  <div className="h-3 bg-slate-100 rounded w-72" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-xl p-4 flex gap-3 items-start">
          <AlertCircle className="flex-shrink-0 text-blue-600 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-0.5">Form Templates</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload blank form PDFs here once. These will be available for all patients to download, sign, and bring to their appointment. You can replace a template by uploading a new file.
            </p>
          </div>
        </div>

        {FORM_TYPES.map(formDef => {
          const template = formTemplates[formDef.id];
          const isUploaded = template?.uploaded;
          const isProcessing = uploadingForm === formDef.id;

          return (
            <div key={formDef.id} className={`bg-white border rounded-2xl p-5 transition-all ${isUploaded ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUploaded ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {formDef.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-800">{formDef.label}</h4>
                    {isUploaded && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        Uploaded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{formDef.description}</p>

                  {isUploaded ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                        <FileText size={14} className="text-slate-400" />
                        <span className="text-slate-700 font-medium truncate max-w-[200px]">{template.file_name}</span>
                      </div>
                      <button
                        onClick={() => formFileInputRefs.current[formDef.id]?.click()}
                        disabled={isProcessing}
                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => handleFormTemplateDelete(formDef.id)}
                        disabled={isProcessing}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => formFileInputRefs.current[formDef.id]?.click()}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <><div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload size={14} /> Upload PDF</>
                      )}
                    </button>
                  )}

                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={(el) => { formFileInputRefs.current[formDef.id] = el; }}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFormTemplateUpload(formDef.id, file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileSection();
      case 'staff': return renderStaffSection();
      case 'packages': return renderPackagesSection();
      case 'lenses': return renderLensInventorySection();
      case 'medications': return renderMedicationsSection();
      case 'billing': return renderBillingSection();
      case 'documents': return renderDocumentsSection();
      default: return null;
    }
  };

  if (loading) {
    return <ClinicSetupSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto pb-12">
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
        <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
          <Hospital size={14} className="text-blue-500" />
          Clinic Configuration
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 bg-white shadow-sm transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Clinic Configuration</h1>
              {status === 'saved' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 uppercase tracking-wide border border-emerald-100">
                  <CheckCircle2 size={12} /> Saved
                </span>
              )}
              </div>
            <p className="text-sm text-slate-500 font-medium mt-0.5">{data?.clinic_profile?.name || clinicId}</p>
          </div>
        </div>
                  <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
          {saving ? <ButtonLoader /> : <Save size={16} />}
          Save
                  </button>
                </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 shrink-0">
          <nav className="bg-white border border-slate-200 rounded-2xl p-2 sticky top-6 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
            </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>

      {/* Confirmation Modal for Save */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={performSave}
        title="Incomplete Configuration"
        message="Some fields are missing or incomplete. Do you want to save anyway?"
        missingFields={missingFields}
        confirmText="Yes, Save Anyway"
        cancelText="Go Back & Complete"
        type="warning"
      />
    </div>
  );
};

export default ClinicSetup;
