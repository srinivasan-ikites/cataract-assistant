import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { X, Calendar, AlertCircle, CheckCircle2, ChevronDown, Clock, Phone, ArrowRight, ShieldCheck, MapPin, Coffee, Utensils, Car, Shirt, Droplets, MessageCircle, FileText, Download, Eye } from 'lucide-react';
import { useTheme } from '../theme';
import { useToast } from './Toast';
import { Patient, api, patientAuthStorage, patientAuthApi, buildEyeContexts, normalizePreOpProgress, EyeContext } from '../services/api';
import { getAntibioticName, getFrequencyName } from '../constants/medications';
import { GeminiContentResponse } from '../types';
import ReactMarkdown from 'react-markdown';

interface BeforeSurgeryModalProps {
    onClose: () => void;
    patient: Patient | null;
    moduleContent: GeminiContentResponse | null;
    onOpenChat: (msg?: string) => void;
    isLoading?: boolean;
}

// Skeleton content component (inner content only, no wrapper - matches actual modal layout)
const BeforeSurgerySkeletonContent: React.FC = () => (
    <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8 animate-pulse">
        {/* Hero Section Skeleton - matches CircularProgress + Info Cards layout */}
        <div className="flex flex-col md:flex-row gap-8 items-stretch">
            {/* Left: Circular Progress placeholder */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-center min-w-[240px]">
                <div className="relative w-48 h-48">
                    <div className="w-48 h-48 bg-slate-100 rounded-full border-[12px] border-slate-200" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
                        <div className="h-12 w-16 bg-slate-200 rounded mb-1" />
                        <div className="h-4 w-10 bg-slate-200 rounded" />
                    </div>
                </div>
            </div>
            {/* Right: Info cards */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Action Required Card */}
                <div className="bg-violet-50 rounded-[24px] p-6 border border-violet-100 flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 bg-violet-200 rounded w-48" />
                        <div className="h-4 bg-violet-100 rounded w-64" />
                    </div>
                </div>
                {/* Date/Time Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-[24px] p-4 border border-slate-100">
                        <div className="h-3 bg-slate-200 rounded w-24 mb-2" />
                        <div className="h-5 bg-slate-300 rounded w-16" />
                    </div>
                    <div className="bg-white rounded-[24px] p-4 border border-slate-100">
                        <div className="h-3 bg-slate-200 rounded w-16 mb-2" />
                        <div className="h-5 bg-slate-300 rounded w-20" />
                    </div>
                </div>
            </div>
        </div>

        {/* Eye Drop Tracker Skeleton */}
        <div className="space-y-6">
            <div className="h-7 bg-slate-200 rounded w-44" />
            <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-6">
                        {/* Date Node */}
                        <div className="w-14 h-14 bg-slate-200 rounded-2xl shrink-0 flex flex-col items-center justify-center">
                            <div className="h-2 w-8 bg-slate-300 rounded mb-1" />
                            <div className="h-5 w-6 bg-slate-300 rounded" />
                        </div>
                        {/* Day Accordion */}
                        <div className="flex-1 bg-white rounded-[24px] border border-slate-100 overflow-hidden">
                            <div className="px-6 py-4 flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 bg-slate-200 rounded w-40" />
                                    <div className="h-3 bg-slate-100 rounded w-28" />
                                </div>
                                <div className="w-5 h-5 bg-slate-200 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Night Before Rules Skeleton */}
        <div className="space-y-6">
            <div className="h-7 bg-slate-200 rounded w-48" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-[24px] p-6 border border-slate-100 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 bg-violet-100 rounded-xl" />
                        <div className="space-y-2 w-full">
                            <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto" />
                            <div className="h-3 bg-slate-100 rounded w-5/6 mx-auto" />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* FAQ Skeleton */}
        <div className="space-y-6 pt-10 border-t border-slate-100">
            <div className="h-5 bg-slate-200 rounded w-56 mx-auto" />
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 flex justify-between items-center">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="w-8 h-8 bg-slate-100 rounded-full" />
                    </div>
                ))}
            </div>
        </div>

        {/* Chat CTA Skeleton */}
        <div className="p-6 rounded-[28px] bg-slate-50 border border-slate-200 text-center max-w-2xl mx-auto">
            <div className="h-5 bg-slate-200 rounded w-40 mx-auto mb-2" />
            <div className="h-4 bg-slate-100 rounded w-72 mx-auto mb-4" />
            <div className="h-12 bg-violet-200 rounded-full w-48 mx-auto" />
        </div>
    </div>
);

// Hardcoded FAQs for "Before Surgery" module
const beforeSurgeryFaqs = [
    {
        question: "What medications should I stop taking before surgery?",
        answer: "**Blood thinners** (like Aspirin, Warfarin, Eliquis, Plavix) may need to be stopped 3-7 days before surgery, but **only if your prescribing doctor approves**. Never stop blood thinners without consulting the doctor who prescribed them. Continue all other medications as normal, including blood pressure and diabetes medications, unless specifically told otherwise."
    },
    {
        question: "Why do I need to fast before surgery? What if I accidentally eat or drink?",
        answer: "Fasting is required because the sedation used during surgery can cause nausea. If your stomach isn't empty, there's a risk of aspiration (inhaling stomach contents). If you accidentally eat or drink, **call the surgery center immediately** — your surgery may need to be rescheduled for your safety. Typically, no food for 8 hours and no clear liquids for 2 hours before surgery."
    },
    {
        question: "What if I get sick (cold, cough, fever) before my scheduled surgery?",
        answer: "**Contact your surgeon's office right away.** A minor cold may be okay, but fever, productive cough, or respiratory infection usually means the surgery should be postponed. Operating while sick increases the risk of complications and may affect your healing. It's better to reschedule than to risk a poor outcome."
    },
    {
        question: "Should I continue using my regular eye drops (like glaucoma drops) before surgery?",
        answer: "**Usually yes** — continue your glaucoma drops and other eye medications unless your doctor specifically tells you to stop. However, you'll be given special antibiotic drops to start 1-3 days before surgery. If you use multiple eye drops, wait at least 5 minutes between each drop to ensure proper absorption."
    }
];

const CircularProgress = ({ days, totalDays = 10 }: { days: number, totalDays?: number }) => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    // We want a semi-circle or roughly 3/4 circle like in the image
    const progress = Math.min(Math.max(days / totalDays, 0), 1);
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div className="relative flex items-center justify-center w-48 h-48">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                {/* Background Track */}
                <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    className="text-slate-100"
                />
                {/* Progress Bar */}
                <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="text-violet-600 transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">Until Surgery</span>
                <span className="text-5xl font-black text-slate-900 leading-none">{days}</span>
                <span className="text-base font-bold text-slate-700 mt-1">Days</span>
            </div>
            {/* Inner shadow effect from image */}
            <div className="absolute inset-4 rounded-full shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] pointer-events-none"></div>
        </div>
    );
};

const BeforeSurgeryModal: React.FC<BeforeSurgeryModalProps> = ({ onClose, patient, moduleContent, onOpenChat, isLoading = false }) => {
    const { classes } = useTheme();
    const toast = useToast();
    const [checklist, setChecklist] = useState<Record<string, Record<string, boolean>>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [lockedMessageDate, setLockedMessageDate] = useState<string | null>(null);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'forms' | 'medications'>('forms');
    const [formsData, setFormsData] = useState<Record<string, any> | null>(null);
    const [loadingForms, setLoadingForms] = useState(false);

    // ── Per-Eye Context ──────────────────────────────────────────────
    const eyeContexts = buildEyeContexts(patient);
    const isSingleEye = eyeContexts.length <= 1;
    const primaryEye = eyeContexts[0] || null;

    // Pre-op: eyes whose surgery is upcoming (not yet post-op)
    const preOpEyes = eyeContexts.filter(e => !e.isPostOp);

    // The soonest upcoming surgery for countdown/case logic
    const nextSurgeryEye = preOpEyes[0] || null;
    const rightEyeLogistics = patient?.surgical_plan?.operative_logistics?.od_right;
    const leftEyeLogistics = patient?.surgical_plan?.operative_logistics?.os_left;
    const surgeryDateStr = nextSurgeryEye?.surgeryDateStr
        || rightEyeLogistics?.surgery_date || leftEyeLogistics?.surgery_date;
    const arrivalTime = rightEyeLogistics?.arrival_time || leftEyeLogistics?.arrival_time || "7:00 AM";

    // Use fallback lookups if strings are missing
    const antibioticName = patient?.medications?.pre_op?.antibiotic_name || getAntibioticName(patient?.medications?.pre_op?.antibiotic_id);
    const frequency = patient?.medications?.pre_op?.frequency || getFrequencyName(patient?.medications?.pre_op?.frequency_id);

    // Eye color scheme
    const EYE_COLORS: Record<string, { border: string; text: string; accent: string; badge: string }> = {
        od: { border: 'border-blue-500', text: 'text-blue-700', accent: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
        os: { border: 'border-emerald-500', text: 'text-emerald-700', accent: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
    };

    // Helper to convert progress record to checklist format
    const progressToChecklist = (progress: Record<string, string[]>) => {
        const checklist: Record<string, Record<string, boolean>> = {};
        Object.entries(progress).forEach(([d, items]) => {
            checklist[d] = {};
            items.forEach(id => {
                checklist[d][id] = true;
            });
        });
        return checklist;
    };

    // Helper: normalize pre-op progress if multi-eye
    const normalizeProgress = (progress: Record<string, string[]>) => {
        return (!isSingleEye && primaryEye)
            ? normalizePreOpProgress(progress, primaryEye.eyeKey)
            : progress;
    };

    // Load initial progress from prop
    useEffect(() => {
        if (patient?.medications?.pre_op?.progress) {
            setChecklist(progressToChecklist(normalizeProgress(patient.medications.pre_op.progress)));
        }

        // Set today as expanded by default
        const surgery = surgeryDateStr ? new Date(surgeryDateStr) : null;
        if (surgery) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysToSurg = Math.ceil((surgery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysToSurg >= 1 && daysToSurg <= 3) {
                setExpandedIndex(3 - daysToSurg);
            }
        }
    }, [patient, surgeryDateStr]);

    // Fetch fresh medication data when modal opens
    useEffect(() => {
        const fetchFreshData = async () => {
            if (patientAuthStorage.isAuthenticated() && patient?.patient_id) {
                try {
                    const freshPatient = await patientAuthApi.getMyData();
                    if (freshPatient?.medications?.pre_op?.progress) {
                        setChecklist(progressToChecklist(normalizeProgress(freshPatient.medications.pre_op.progress)));
                    }
                } catch (err) {
                    console.error("Failed to fetch fresh medication data:", err);
                }
            }
        };
        fetchFreshData();
    }, []); // Only run on mount

    // Derived states
    const hasSurgeryScheduled = !!surgeryDateStr;

    const calculateDaysLeft = () => {
        if (!surgeryDateStr) return null;
        const surgery = new Date(surgeryDateStr);
        surgery.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diff = Math.ceil((surgery.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff; // Can be negative for Case 4
    };

    const daysLeft = calculateDaysLeft();

    // Determine Case
    const getActiveCase = () => {
        if (!hasSurgeryScheduled) return 'PENDING';
        if (daysLeft === 0) return 'SURGERY_DAY';
        if (daysLeft! < 0) return 'POST_SURGERY';
        if (daysLeft! <= 3) return 'TIMELINE';
        return 'PHARMACY';
    };

    const activeCase = getActiveCase();

    const getFrequencyItems = (freq?: string, eyeKey?: string, eyeLabel?: string) => {
        const prefix = (!isSingleEye && eyeKey) ? `${eyeKey}_` : '';
        const eyeDesc = eyeLabel || (patient?.clinical_context?.diagnosis?.anatomical_status?.includes('Right') ? 'Right eye' : 'target eye');
        const lower = (freq || '').toLowerCase();
        if (lower.includes('4 times') || lower.includes('qid')) {
            return [
                { id: `${prefix}morning`, label: 'Morning Drop', sub: `1 drop in ${eyeDesc}`, time: '8:00 AM' },
                { id: `${prefix}noon`, label: 'Noon Drop', sub: `1 drop in ${eyeDesc}`, time: '12:00 PM' },
                { id: `${prefix}afternoon`, label: 'Afternoon Drop', sub: `1 drop in ${eyeDesc}`, time: '4:00 PM' },
                { id: `${prefix}bedtime`, label: 'Bedtime Drop', sub: `1 drop in ${eyeDesc}`, time: '9:00 PM' },
            ];
        }
        return [
            { id: `${prefix}morning`, label: 'Morning Drop', sub: `1 drop in ${eyeDesc}`, time: '8:00 AM' },
            { id: `${prefix}afternoon`, label: 'Afternoon Drop', sub: `1 drop in ${eyeDesc}`, time: '2:00 PM' },
            { id: `${prefix}evening`, label: 'Evening Drop', sub: `1 drop in ${eyeDesc}`, time: '8:00 PM' },
        ];
    };

    const formatDateKey = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const sanitizeQuestion = (q?: string) =>
        (q || "")
            .replace(/\*\*/g, "")
            .replace(/__/g, "")
            .replace(/`+/g, "")
            .replace(/\s+/g, " ")
            .trim();

    const syncChecklist = async (newChecklist: Record<string, Record<string, boolean>>) => {
        if (!patient) return;
        setIsSaving(true);
        try {
            // Convert checklist format to progress record (array of IDs per date)
            const progressRecord: Record<string, string[]> = {};
            Object.entries(newChecklist).forEach(([d, items]) => {
                progressRecord[d] = Object.entries(items)
                    .filter(([_, checked]) => checked)
                    .map(([id, _]) => id);
            });

            // Check if patient is logged in (patient portal) vs doctor viewing
            if (patientAuthStorage.isAuthenticated()) {
                // Patient is logged in - use patient API
                await patientAuthApi.updateMedicationProgress('pre_op', progressRecord);
            } else {
                // Doctor is viewing - use doctor API (requires doctor auth)
                const updatedPatient = {
                    ...patient,
                    medications: {
                        ...patient.medications,
                        pre_op: {
                            ...patient.medications?.pre_op,
                            progress: progressRecord
                        }
                    }
                };
                await api.saveReviewedPatient(patient.clinic_id || 'VIC-MCLEAN-001', patient.patient_id, updatedPatient);
            }
        } catch (err: any) {
            console.error("Failed to save progress:", err);
            toast.error(
                "Failed to save",
                err?.message || "Could not save your medication progress. Please try again."
            );
        } finally {
            setIsSaving(false);
        }
    };

    // Build per-eye pre-op data
    const eyePreOps = preOpEyes.map(eye => {
        if (!eye.surgeryDate) return null;
        const surgery = new Date(eye.surgeryDate);
        surgery.setHours(0, 0, 0, 0);
        const timelineDays = [3, 2, 1].map(offset => {
            const date = new Date(surgery);
            date.setDate(surgery.getDate() - offset);
            return date;
        });
        const eyeLabel = eye.eyeKey === 'od' ? 'Right eye' : 'Left eye';
        return {
            eye,
            timelineDays,
            trackerItems: getFrequencyItems(frequency, eye.eyeKey, eyeLabel),
            colors: EYE_COLORS[eye.eyeKey],
        };
    }).filter(Boolean) as { eye: EyeContext; timelineDays: Date[]; trackerItems: any[]; colors: any }[];

    // For single-eye fallback and progress counting
    const trackerItems = isSingleEye
        ? getFrequencyItems(frequency)
        : eyePreOps.flatMap(ep => ep.trackerItems);

    const toggleItem = async (dateKey: string, itemId: string) => {
        const itemDate = new Date(dateKey + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (itemDate.getTime() > today.getTime() || activeCase === 'PHARMACY') {
            setLockedMessageDate(dateKey);
            setTimeout(() => setLockedMessageDate(null), 4000);
            return;
        }

        const newChecklist = { ...checklist };
        if (!newChecklist[dateKey]) newChecklist[dateKey] = {};
        newChecklist[dateKey][itemId] = !newChecklist[dateKey][itemId];

        setChecklist(newChecklist);
        await syncChecklist(newChecklist);
    };

    const markAllComplete = async () => {
        const todayKey = formatDateKey(new Date());
        const newChecklist = { ...checklist };
        if (!newChecklist[todayKey]) newChecklist[todayKey] = {};

        // Mark all items for all pre-op eyes
        trackerItems.forEach(item => {
            newChecklist[todayKey][item.id] = true;
        });

        setChecklist(newChecklist);
        await syncChecklist(newChecklist);
    };

    // Single-eye fallback timeline
    const getTimelineDays = () => {
        if (!surgeryDateStr) return [];
        const surgery = new Date(surgeryDateStr);
        surgery.setHours(0, 0, 0, 0);
        return [3, 2, 1].map(offset => {
            const date = new Date(surgery);
            date.setDate(surgery.getDate() - offset);
            return date;
        });
    };

    const timelineDays = getTimelineDays();

    // Form descriptions for display
    const FORM_DESCRIPTIONS: Record<string, string> = {
        medical_clearance: 'Confirms you are medically fit for surgery. This form must be completed by your primary care physician.',
        iol_selection: 'Documents your chosen intraocular lens type and confirms your understanding of the options.',
        consent: 'Your informed consent for the cataract surgery procedure, including risks and benefits.',
    };

    // Load forms data from backend
    const loadForms = useCallback(async () => {
        try {
            setLoadingForms(true);
            const result = await patientAuthApi.getMyForms();
            if (result?.forms) setFormsData(result.forms);
        } catch (err) {
            console.error('Failed to load forms:', err);
        } finally {
            setLoadingForms(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'forms' && !formsData) {
            loadForms();
        }
    }, [activeTab, formsData, loadForms]);

    // Transform backend data to UI format
    const formGroups = formsData ? Object.entries(formsData).map(([formType, formInfo]: [string, any]) => {
        const eyeEntries = Object.entries(formInfo.eyes || {}) as [string, any][];
        return {
            id: formType,
            title: formInfo.label || formType,
            description: FORM_DESCRIPTIONS[formType] || '',
            forms: eyeEntries.map(([eyeKey, eyeData]) => ({
                eye: eyeKey === 'od_right' ? 'OD (Right Eye)' : 'OS (Left Eye)',
                eyeKey,
                eyeColor: eyeKey === 'od_right' ? 'blue' : 'green',
                status: (eyeData.status || 'not_available') as 'signed' | 'ready' | 'not_available',
                signedDate: eyeData.signed_date || null,
            })),
        };
    }) : [];

    const handleFormDownload = async (formType: string, docType: 'blank' | 'signed', eye?: string) => {
        try {
            const url = await patientAuthApi.getFormDownloadUrl(formType, docType, eye);
            if (url) window.open(url, '_blank');
        } catch (err: any) {
            console.error('Download failed:', err);
        }
    };

    const getFormStatusConfig = (status: 'signed' | 'ready' | 'not_available') => {
        switch (status) {
            case 'signed':
                return {
                    badge: 'Signed',
                    badgeClass: 'bg-emerald-100 text-emerald-700',
                    borderClass: 'border-l-emerald-500',
                    bgClass: 'bg-white',
                    icon: <CheckCircle2 size={20} className="text-emerald-500" />,
                };
            case 'ready':
                return {
                    badge: 'Ready to Sign',
                    badgeClass: 'bg-blue-100 text-blue-700',
                    borderClass: 'border-l-blue-500',
                    bgClass: 'bg-white',
                    icon: <Download size={20} className="text-blue-500" />,
                };
            case 'not_available':
                return {
                    badge: 'Pending',
                    badgeClass: 'bg-slate-100 text-slate-500',
                    borderClass: 'border-l-slate-300',
                    bgClass: 'bg-slate-50',
                    icon: <Clock size={20} className="text-slate-400" />,
                };
        }
    };

    // UI Render Helpers
    if (activeCase === 'PENDING') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
                <div className="relative w-full max-w-6xl h-[90vh] bg-[#f8f9fc] rounded-[40px] shadow-2xl overflow-hidden flex">
                    <div className="w-64 bg-white border-r border-slate-200 p-8 hidden lg:flex flex-col gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                                <ShieldCheck size={24} />
                            </div>
                            <div className="font-black text-slate-900 leading-tight">
                                Cataract Care<br /><span className="text-slate-400 text-xs font-bold">Patient Portal</span>
                            </div>
                        </div>
                        <nav className="flex flex-col gap-2">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm flex items-center gap-3"><Calendar size={18} /> Surgery Status</div>
                        </nav>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-10 py-8 flex justify-between items-center">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Surgery Status</h1>
                                <p className="text-slate-500 font-medium mt-1">Current scheduling details & preparation</p>
                            </div>
                            <button onClick={onClose} className="p-3 bg-white rounded-2xl shadow-sm text-slate-400"><X size={24} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-10">
                            <div className="grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[32px] overflow-hidden shadow-sm border border-slate-100">
                                <div className="bg-blue-50 flex items-center justify-center p-12">
                                    <div className="w-48 h-48 bg-white rounded-2xl shadow-lg border-t-[12px] border-blue-600 flex items-center justify-center">
                                        <Calendar size={64} className="text-blue-100" />
                                    </div>
                                </div>
                                <div className="p-12 space-y-6">
                                    <h2 className="text-4xl font-black text-slate-900">Your Surgery Date is Pending</h2>
                                    <p className="text-slate-500 text-lg">Please contact our scheduling team to finalize your appointment date.</p>
                                    <button className="flex items-center gap-3 px-8 py-5 bg-blue-600 text-white rounded-[20px] font-bold text-lg shadow-lg">
                                        <Phone size={24} /> (555) 123-4567
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Single persistent modal wrapper - only inner content changes
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-5xl max-h-[96vh] bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-10 p-2.5 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white hover:text-white"
                >
                    <X size={22} />
                </button>

                {/* Header */}
                <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-violet-600 to-purple-600 shrink-0">
                    <h1 className="text-2xl font-bold mb-1 text-white">
                        {activeCase === 'SURGERY_DAY' ? 'Surgery Day Dashboard' :
                            activeCase === 'POST_SURGERY' ? 'Preparation Complete' :
                                'Before Surgery Preparation'}
                    </h1>
                    <p className="text-base text-white/80">
                        {activeCase === 'SURGERY_DAY' ? 'Everything you need for today' :
                            activeCase === 'POST_SURGERY' ? 'You\'re ready for your procedure' :
                                'Get ready for your upcoming cataract surgery'}
                    </p>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-slate-200 px-8 bg-white shrink-0">
                    <button
                        onClick={() => setActiveTab('forms')}
                        className={`flex-1 py-3.5 text-base font-semibold transition-colors relative ${activeTab === 'forms' ? 'text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Forms & Documents
                        {activeTab === 'forms' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('medications')}
                        className={`flex-1 py-3.5 text-base font-semibold transition-colors relative ${activeTab === 'medications' ? 'text-violet-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Medications & Preparation
                        {activeTab === 'medications' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />}
                    </button>
                </div>

                {/* Content Area - shows skeleton or actual content */}
                {isLoading ? (
                    <BeforeSurgerySkeletonContent />
                ) : (
                <>
                {/* === FORMS TAB === */}
                {activeTab === 'forms' && (
                <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8">
                    {/* Overview */}
                    <div className="bg-violet-50 border-l-4 border-violet-500 rounded-r-xl p-6 flex gap-4 items-start">
                        <FileText className="flex-shrink-0 text-violet-600 mt-0.5" size={24} />
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Your Surgery Documents</h3>
                            <p className="text-slate-700 leading-relaxed text-base">
                                These forms need to be completed before your surgery. Download the forms that are ready, sign them, and bring them to your next appointment. Your doctor will upload the signed copies here for your records.
                            </p>
                        </div>
                    </div>

                    {loadingForms ? (
                        <div className="space-y-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse">
                                    <div className="h-5 bg-slate-200 rounded w-40 mb-2" />
                                    <div className="h-3 bg-slate-100 rounded w-64 mb-4" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white rounded-2xl p-5 border border-slate-200 border-l-4 border-l-slate-300 h-28" />
                                        <div className="bg-white rounded-2xl p-5 border border-slate-200 border-l-4 border-l-slate-300 h-28" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : formGroups.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700 mb-2">No Forms Available Yet</h3>
                            <p className="text-base text-slate-500">Your doctor will make forms available as your surgery date approaches.</p>
                        </div>
                    ) : (
                    <>
                    {/* Form Groups */}
                    {formGroups.map((group) => (
                        <div key={group.id}>
                            <div className="mb-3">
                                <h3 className="text-xl font-bold text-slate-900">{group.title}</h3>
                                <p className="text-base text-slate-500 mt-1">{group.description}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {group.forms.map((form) => {
                                    const config = getFormStatusConfig(form.status);
                                    return (
                                        <div
                                            key={`${group.id}-${form.eye}`}
                                            className={`${config.bgClass} rounded-2xl p-5 border border-slate-200 border-l-4 ${config.borderClass} flex flex-col gap-4`}
                                        >
                                            {/* Top row: eye label + status badge */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <Eye size={18} className={form.eyeColor === 'blue' ? 'text-blue-600' : 'text-green-600'} />
                                                    <span className="text-base font-bold text-slate-800">{form.eye}</span>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${config.badgeClass}`}>
                                                    {config.badge}
                                                </span>
                                            </div>

                                            {/* Status-specific content */}
                                            {form.status === 'signed' && (
                                                <div>
                                                    <p className="text-base text-emerald-700 font-medium mb-3">
                                                        Signed on {form.signedDate ? new Date(form.signedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                    </p>
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handleFormDownload(group.id, 'signed', form.eyeKey)}
                                                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                                                        >
                                                            <Eye size={16} /> View
                                                        </button>
                                                        <button
                                                            onClick={() => handleFormDownload(group.id, 'signed', form.eyeKey)}
                                                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                                                        >
                                                            <Download size={16} /> Download
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {form.status === 'ready' && (
                                                <div>
                                                    <p className="text-base text-slate-600 mb-3">
                                                        Download this form, sign it, and bring it to your next visit.
                                                    </p>
                                                    <button
                                                        onClick={() => handleFormDownload(group.id, 'blank')}
                                                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                                                    >
                                                        <Download size={16} /> Download Form
                                                    </button>
                                                </div>
                                            )}

                                            {form.status === 'not_available' && (
                                                <p className="text-base text-slate-500 italic">
                                                    Your doctor will provide this form at your next appointment.
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Progress Summary */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Completion Status</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {(() => {
                                const allForms = formGroups.flatMap(g => g.forms);
                                const signed = allForms.filter(f => f.status === 'signed').length;
                                const ready = allForms.filter(f => f.status === 'ready').length;
                                const pending = allForms.filter(f => f.status === 'not_available').length;
                                return (
                                    <>
                                        <div className="text-center">
                                            <div className="text-3xl font-black text-emerald-600">{signed}</div>
                                            <div className="text-sm font-semibold text-slate-500 mt-1">Completed</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-black text-blue-600">{ready}</div>
                                            <div className="text-sm font-semibold text-slate-500 mt-1">Ready to Sign</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-black text-slate-400">{pending}</div>
                                            <div className="text-sm font-semibold text-slate-500 mt-1">Pending</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Chat CTA */}
                    <div className={`p-6 rounded-2xl ${classes.surfaceVariant} border border-slate-200 text-center`}>
                        <h3 className={`text-lg font-semibold ${classes.primaryText} mb-2`}>Have questions about your forms?</h3>
                        <p className="text-slate-600 mb-4">Our AI assistant can help you understand what each form is for.</p>
                        <button
                            onClick={() => onOpenChat('Can you explain the forms I need to complete before surgery?')}
                            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${classes.fabBg} text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
                        >
                            <MessageCircle size={20} />
                            Chat with Assistant
                        </button>
                    </div>
                    </>
                    )}
                </div>
                )}

                {/* === MEDICATIONS TAB === */}
                {activeTab === 'medications' && (
                <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8">
                    {/* Case 3: Surgery Day Banner */}
                    {activeCase === 'SURGERY_DAY' && (
                        <div className="bg-blue-600 rounded-[32px] p-8 text-white flex items-center justify-between overflow-hidden relative">
                            <div className="space-y-4 relative z-10 w-full max-w-xl">
                                <h2 className="text-4xl font-black">Today is Surgery Day!</h2>
                                <p className="text-blue-100 text-lg font-bold">Good luck today, {patient?.name?.first || 'Patient'}! Your journey to clearer vision reached its destination.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                                        <div className="flex items-center gap-3">
                                            <Clock size={20} className="text-blue-200" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Arrival</span>
                                        </div>
                                        <p className="text-xl font-black mt-1">{arrivalTime}</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                                        <div className="flex items-center gap-3">
                                            <MapPin size={20} className="text-blue-200" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-blue-100">Location</span>
                                        </div>
                                        <p className="text-xl font-black mt-1">Surgery Center</p>
                                    </div>
                                </div>
                            </div>
                            <MapPin size={160} className="text-blue-500 absolute -right-8 -bottom-8 opacity-20 rotate-12" />
                        </div>
                    )}

                    {/* Case 4: Post-Surgery Banner */}
                    {activeCase === 'POST_SURGERY' && (
                        <div className="bg-emerald-600 rounded-[32px] p-8 text-white flex items-center justify-between overflow-hidden relative">
                            <div className="space-y-4 relative z-10">
                                <h2 className="text-4xl font-black">Preparation Complete</h2>
                                <p className="text-emerald-50 font-bold text-lg">You've successfully completed your pre-op routine.</p>
                                <button className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg">
                                    Go to After Surgery Module <ArrowRight size={20} />
                                </button>
                            </div>
                            <CheckCircle2 size={160} className="text-emerald-500 absolute -right-8 -bottom-8 opacity-20" />
                        </div>
                    )}

                    {/* Standard Hero for TIMELINE and PHARMACY */}
                    {(activeCase === 'TIMELINE' || activeCase === 'PHARMACY') && (
                        <div className="flex flex-col md:flex-row gap-8 items-stretch">
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-center min-w-[240px]">
                                <CircularProgress days={daysLeft || 0} />
                            </div>
                            <div className="flex-1 flex flex-col gap-4">
                                {activeCase === 'PHARMACY' ? (
                                    <div className="bg-amber-50 rounded-[24px] p-6 border border-amber-100 flex items-start gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <ShieldCheck size={20} className="text-amber-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-black text-slate-900 text-xl">Next Step: Pharmacy</h3>
                                            <p className="text-slate-700 text-base">
                                                Ensure you have picked up your <strong className="text-slate-900">{antibioticName}</strong> drops from the pharmacy.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-violet-50 rounded-[24px] p-6 border border-violet-100 flex items-start gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <AlertCircle size={20} className="text-violet-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-black text-slate-900 text-xl">Action Required: Drops</h3>
                                            <p className="text-slate-700 text-base">Please follow your {antibioticName} schedule below.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-[24px] p-5 border border-slate-100">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-1">SURGERY DATE</span>
                                        <p className="font-black text-slate-900 text-lg">{new Date(surgeryDateStr!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                    </div>
                                    <div className="bg-white rounded-[24px] p-5 border border-slate-100">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-1">TIME</span>
                                        <p className="font-black text-slate-900 text-lg">{arrivalTime}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dynamic Tracker: Timeline vs Upcoming */}
                    {(activeCase === 'TIMELINE' || activeCase === 'PHARMACY') && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black text-slate-900">Eye Drop Tracker</h2>

                            {/* Per-eye sections (or single-eye fallback) */}
                            {(isSingleEye ? [{ eye: null, timelineDays, trackerItems: getFrequencyItems(frequency), colors: null }] : eyePreOps).map((section, sectionIdx) => {
                                const sectionKey = section.eye?.eyeKey || 'single';
                                const sectionItems = section.trackerItems;
                                const sectionColors = section.colors;
                                return (
                                    <div key={sectionKey} className={`space-y-6 ${!isSingleEye && sectionColors ? `rounded-[28px] border-2 ${sectionColors.border} p-5` : ''}`}>
                                        {/* Eye header (multi-eye only) */}
                                        {!isSingleEye && section.eye && sectionColors && (
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${sectionColors.accent}`} />
                                                <h3 className={`text-lg font-black ${sectionColors.text} tracking-tight`}>{section.eye.label}</h3>
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${sectionColors.badge}`}>
                                                    Surgery: {section.eye.surgeryDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        )}

                                        <div className="space-y-6">
                                            {section.timelineDays.map((date, index) => {
                                                // Use unique expandedIndex per section for multi-eye
                                                const globalIndex = sectionIdx * 10 + index;
                                                const dateKey = formatDateKey(date);
                                                const isFuture = date.getTime() > new Date().setHours(0, 0, 0, 0);
                                                const isPast = date.getTime() < new Date().setHours(0, 0, 0, 0);
                                                const isTodayDay = date.getTime() === new Date().setHours(0, 0, 0, 0);
                                                const dayProgress = checklist[dateKey] ? Object.entries(checklist[dateKey]).filter(([k, v]) => v && sectionItems.some(si => si.id === k)).length : 0;
                                                const dayCompleted = dayProgress === sectionItems.length;

                                                return (
                                                    <div key={`${sectionKey}-${dateKey}`} className={`relative flex gap-6 transition-all duration-300 ${isFuture ? 'hover:translate-x-1' : ''}`}>
                                                        {index < 2 && <div className="absolute left-[31px] top-16 bottom-[-24px] w-0.5 bg-slate-200 z-0" />}

                                                        {/* Date Node */}
                                                        <div className={`relative z-10 w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 transition-all ${isTodayDay && activeCase !== 'PHARMACY' ? 'bg-violet-600 border-violet-600 text-white' :
                                                            dayCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white border-slate-200 text-slate-700'
                                                            }`}>
                                                            <span className="text-xs font-black uppercase leading-none mb-1">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                            <span className="text-2xl font-black leading-none">{date.getDate()}</span>
                                                        </div>

                                                        {/* Day Accordion */}
                                                        <div className={`flex-1 bg-white rounded-[24px] border ${isTodayDay && activeCase !== 'PHARMACY' ? 'border-violet-200 shadow-lg' : 'border-slate-100'} overflow-hidden transition-all duration-300`}>
                                                            <button
                                                                onClick={() => setExpandedIndex(expandedIndex === globalIndex ? null : globalIndex)}
                                                                className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${isFuture ? 'bg-slate-50/50 hover:bg-slate-100' : 'hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                <div>
                                                                    <span className={`text-base font-black ${isFuture ? 'text-slate-500' : 'text-slate-900'}`}>
                                                                        Day {3 - index} before Surgery {isTodayDay ? '(Today)' : isPast ? '(Past Day)' : '(Upcoming)'}
                                                                    </span>
                                                                    <p className="text-sm font-bold text-slate-600">{dayProgress}/{sectionItems.length} drops taken</p>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {isPast && dayCompleted && <CheckCircle2 className="text-emerald-500" size={20} />}
                                                                    <ChevronDown className={`text-slate-400 transition-transform duration-300 ${expandedIndex === globalIndex ? 'rotate-180' : ''}`} size={20} />
                                                                </div>
                                                            </button>

                                                            {lockedMessageDate === dateKey && (
                                                                <div className="px-6 py-3 bg-amber-50 border-y border-amber-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                                                    <AlertCircle size={16} className="text-amber-600" />
                                                                    <p className="text-sm font-bold text-amber-800">
                                                                        This tracker starts 3 days before surgery on {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {expandedIndex === globalIndex && (
                                                                <div className="px-6 pb-6 pt-2 divide-y divide-slate-50">
                                                                    {sectionItems.length > 0 ? (
                                                                        sectionItems.map(item => (
                                                                            <div key={item.id} className="py-4 flex items-center justify-between">
                                                                                <div className="flex items-center gap-4">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            toggleItem(dateKey, item.id);
                                                                                        }}
                                                                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${checklist[dateKey]?.[item.id] ? 'bg-violet-600 border-violet-600 text-white' :
                                                                                            isFuture || activeCase === 'PHARMACY' ? 'border-slate-200 bg-slate-50' : 'border-slate-200'
                                                                                            }`}
                                                                                    >
                                                                                        {checklist[dateKey]?.[item.id] && <CheckCircle2 size={14} />}
                                                                                    </button>
                                                                                    <div>
                                                                                        <p className="text-base font-bold text-slate-900">{item.label}</p>
                                                                                        <p className="text-sm text-slate-600">{item.time} • {item.sub}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="py-4">
                                                                            <p className="text-base text-slate-600 italic">No medication frequency set.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            {activeCase === 'TIMELINE' && (
                                <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-10">
                                    <button
                                        onClick={markAllComplete}
                                        disabled={isSaving}
                                        className="px-6 py-3 bg-violet-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : 'Mark Today Complete'}
                                    </button>
                                    <button className="flex items-center gap-2 text-slate-400 font-bold hover:text-slate-600 transition-colors">
                                        View Full Guide <ArrowRight size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Night Before: Visible for Surgery Day and Timeline */}
                    {(activeCase === 'TIMELINE' || activeCase === 'SURGERY_DAY') && (
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-slate-900">Night Before Rules</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <RuleCard icon={<Utensils />} title="Fast after Midnight" desc="No food or water after 12:00 AM." />
                                <RuleCard icon={<Car />} title="Arrange a Driver" desc="Ensure a ride is confirmed for home." />
                                <RuleCard icon={<ShieldCheck />} title="Regular Meds" desc="Take heart meds with a sip of water." />
                            </div>
                        </div>
                    )}

                    {/* FAQ Section - Always render with hardcoded FAQs */}
                    <div className="space-y-6 pt-10 border-t border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider text-center">Frequently Asked Questions</h3>
                        <div className="space-y-3">
                            {beforeSurgeryFaqs.map((faq, index) => {
                                const isOpen = openFaqIndex === index;
                                return (
                                    <div key={index} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                        <button
                                            onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                            className="w-full text-left p-5 flex justify-between items-start gap-4 transition-colors"
                                        >
                                            <div className={`font-medium text-base transition-colors ${isOpen ? 'text-blue-800' : 'text-slate-700'}`}>
                                                {faq.question}
                                            </div>
                                            <span className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 ${isOpen ? 'rotate-180 bg-blue-200 text-blue-700' : 'bg-slate-50 text-slate-400 shadow-sm'}`}>
                                                <ChevronDown size={18} />
                                            </span>
                                        </button>

                                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="p-5 pt-0 text-slate-600 leading-relaxed text-base">
                                                <div className="h-px w-full bg-slate-200/60 mb-4"></div>
                                                <ReactMarkdown>{faq.answer}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bot Action Section */}
                    <div className={`mt-8 p-8 rounded-[28px] ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                        <h3 className={`text-xl font-semibold ${classes.primaryText} mb-2`}>
                            Still have questions?
                        </h3>
                        <p className="text-slate-700 mb-4 text-base">
                            Our AI assistant can explain pre-operative instructions in more detail based on your personal medical records.
                        </p>
                        <button
                            onClick={() =>
                                onOpenChat(
                                    sanitizeQuestion(moduleContent?.botStarterPrompt) ||
                                    `Tell me more about what to do before my surgery`
                                )
                            }
                            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${classes.fabBg} text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
                        >
                            <MessageCircle size={20} />
                            Chat with Assistant
                        </button>
                    </div>
                </div>
                )}
                </>
                )}
            </div>
        </div>
    );
};

const RuleCard = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
        <div className="w-14 h-14 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">{icon}</div>
        <div>
            <h4 className="font-black text-slate-900 text-base">{title}</h4>
            <p className="text-slate-700 text-sm leading-relaxed mt-1 font-semibold">{desc}</p>
        </div>
    </div>
);

export default BeforeSurgeryModal;
