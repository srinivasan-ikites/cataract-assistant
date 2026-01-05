import React, { useState, Fragment } from 'react';
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Heart,
    ChevronDown,
    MessageCircle,
    Info,
    Calendar,
    X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Patient, api } from '../services/api';
import { useTheme } from '../theme';

interface AfterSurgeryModalProps {
    patient: Patient | null;
    onClose: () => void;
    moduleContent?: any;
    onOpenChat?: (question: string) => void;
}

const CircularProgress = ({ progress, size = 40, strokeWidth = 3, color = "text-blue-600" }: { progress: number, size?: number, strokeWidth?: number, color?: string }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                <circle
                    className="text-slate-100"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`${color} transition-all duration-500 ease-out`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <span className="absolute text-[10px] font-black text-slate-900">{Math.round(progress)}%</span>
        </div>
    );
};

const SESSIONS = [
    { label: 'Morning', time: '8:00 AM', icon: 'Sun' },
    { label: 'Noon', time: '12:00 PM', icon: 'CloudSun' },
    { label: 'Evening', time: '4:00 PM', icon: 'Sunset' },
    { label: 'Night', time: '8:00 PM', icon: 'Moon' }
];

const AfterSurgeryModal = ({ patient, onClose, moduleContent, onOpenChat }: AfterSurgeryModalProps) => {
    const { classes } = useTheme();
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [updating, setUpdating] = useState(false);

    // 1. Calculate Progress & Timing
    // const surgeryDateStr = patient?.surgical_recommendations_by_doctor?.scheduling?.surgery_date || "2025-12-23";
    const surgeryDateStr = "2026-1-1";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateKey = today.toISOString().split('T')[0];

    const surgeryDate = new Date(surgeryDateStr);
    surgeryDate.setHours(0, 0, 0, 0);

    const diffInTime = today.getTime() - surgeryDate.getTime();
    const diffInDays = Math.floor(diffInTime / (1000 * 3600 * 24));
    const currentWeekIndex = Math.floor(diffInDays / 7);

    const isSurgeryDay = diffInDays === 0;
    const isPostOp = diffInDays >= 0;

    // Healing Progress (Total recovery ~28 days)
    const totalRecoveryDays = 28;
    const healingProgress = Math.min(Math.max((diffInDays / totalRecoveryDays) * 100, 0), 100);

    // 2. Local State for Instant UI Feedback
    const initialProgress = patient?.medications?.post_op?.progress || {};
    const [localProgress, setLocalProgress] = useState(initialProgress);

    // Sync local state if patient prop changes significantly (e.g. from parent refresh)
    React.useEffect(() => {
        if (patient?.medications?.post_op?.progress) {
            setLocalProgress(patient.medications.post_op.progress);
        }
    }, [patient?.medications?.post_op?.progress]);

    const todaysLocalProgress = localProgress[dateKey] || {};

    // 3. Extract Medication Data
    const postOp = patient?.medications?.post_op;
    const isDropless = postOp?.is_dropless;
    const isCombination = postOp?.is_combination;

    // 4. Logic: What should show today?
    const medsToTrack: any[] = [];

    if (isPostOp && postOp && !isDropless) {
        // A. Antibiotic (Week 1 only)
        if (!isCombination && postOp.antibiotic?.name && diffInDays < ((postOp.antibiotic.weeks || 1) * 7)) {
            const freq = postOp.antibiotic.frequency || 0;
            let doneCount = 0;
            for (let i = 0; i < freq; i++) if (todaysLocalProgress[`antibiotic_${i}`]) doneCount++;

            medsToTrack.push({
                id: 'antibiotic',
                name: postOp.antibiotic.name,
                type: 'Antibiotic',
                frequency: freq,
                label: postOp.antibiotic.frequency_label || '',
                progress: freq > 0 ? (doneCount / freq) * 100 : 0
            });
        }

        // B. NSAID (Based on weeks)
        if (!isCombination && postOp.nsaid?.name && diffInDays < ((postOp.nsaid.weeks || 4) * 7)) {
            const freq = postOp.nsaid.frequency || 0;
            let doneCount = 0;
            for (let i = 0; i < freq; i++) if (todaysLocalProgress[`nsaid_${i}`]) doneCount++;

            medsToTrack.push({
                id: 'nsaid',
                name: postOp.nsaid.name,
                type: 'Anti-Inflammatory',
                frequency: freq,
                label: postOp.nsaid.frequency_label || '',
                progress: freq > 0 ? (doneCount / freq) * 100 : 0
            });
        }

        // C. Steroid / Combination (Tapering)
        const steroid = postOp.steroid;
        const taperSchedule = steroid?.taper_schedule || [];
        const todayFreq = taperSchedule[currentWeekIndex] || 0;

        if (steroid?.name || isCombination) {
            if (todayFreq > 0) {
                let doneCount = 0;
                for (let i = 0; i < todayFreq; i++) if (todaysLocalProgress[`steroid_${i}`]) doneCount++;

                medsToTrack.push({
                    id: 'steroid',
                    name: isCombination ? (postOp.combination_name || 'Combination Drop') : steroid?.name,
                    type: isCombination ? '3-in-1 Combo' : 'Steroid (Tapering)',
                    frequency: todayFreq,
                    label: `${todayFreq}x Daily (Week ${currentWeekIndex + 1})`,
                    progress: (doneCount / todayFreq) * 100
                });
            }
        }
    }

    const syncProgress = async (updatedProgress: any) => {
        if (!patient) return;
        setUpdating(true);
        try {
            const updatedPatient = {
                ...patient,
                medications: {
                    ...patient.medications,
                    post_op: {
                        ...patient.medications?.post_op,
                        progress: updatedProgress
                    }
                }
            };
            const clinicId = patient.clinic_id || 'VIC-MCLEAN-001';
            await api.saveReviewedPatient(clinicId, patient.patient_id, updatedPatient);
        } catch (err) {
            console.error("Failed to sync post-op progress:", err);
            // Optional: Revert local state on error
            setLocalProgress(patient?.medications?.post_op?.progress || {});
        } finally {
            setUpdating(false);
        }
    };

    const handleToggle = async (medId: string, doseIndex: number) => {
        if (!patient || updating) return;

        const dayProgress = localProgress[dateKey] || {};
        const slotKey = `${medId}_${doseIndex}`;
        const newVal = !dayProgress[slotKey];

        const updatedDayProgress = {
            ...dayProgress,
            [slotKey]: newVal
        };

        const updatedTotalProgress = {
            ...localProgress,
            [dateKey]: updatedDayProgress
        };

        // 1. Update UI Immediately
        setLocalProgress(updatedTotalProgress);

        // 2. Sync in Background
        await syncProgress(updatedTotalProgress);
    };

    const sanitizeQuestion = (q: string) => q.replace(/[#*`]/g, '').trim();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-50 rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]">
                {/* Header */}
                <div className="bg-white border-b border-slate-100 px-10 py-6 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Recovery Tracker</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Calendar size={14} className="text-blue-500" />
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                {isSurgeryDay
                                    ? 'Surgery Day'
                                    : diffInDays < 0
                                        ? `Surgery in ${Math.abs(diffInDays)} ${Math.abs(diffInDays) === 1 ? 'day' : 'days'}`
                                        : `Day ${diffInDays} of Recovery`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all shadow-sm"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Hero Section with Healing Progress */}
                    <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-violet-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
                        {/* Animated Mesh Gradients */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] animate-pulse" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px]" />

                        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                            <div className="flex-1">
                                <p className="text-blue-200 text-xs font-black uppercase tracking-[0.3em] mb-4">
                                    {diffInDays < 0 ? 'Countdown' : `Recovery Journey • Week ${currentWeekIndex + 1}`}
                                </p>
                                <h1 className="text-4xl font-black leading-tight mb-8 flex items-baseline gap-3">
                                    {diffInDays < 0
                                        ? "Preparing for surgery"
                                        : isDropless
                                            ? "Heal effortlessly"
                                            : medsToTrack.length > 0
                                                ? medsToTrack.every(m => m.progress === 100)
                                                    ? <><span className="text-blue-200 text-2xl font-bold italic tracking-normal">You're</span> All Set <span className="text-blue-200 text-2xl font-bold tracking-normal italic">Today!</span></>
                                                    : <>{medsToTrack.length} <span className="text-blue-200 text-2xl font-bold italic tracking-normal">Drops Today</span></>
                                                : "Completely on track"}
                                </h1>

                                {isPostOp && (
                                    <div className="space-y-4 max-w-sm">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-xs font-black text-blue-200 uppercase tracking-widest">Healing Progress</span>
                                            <span className="text-sm font-black text-white">{Math.round(healingProgress)}%</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                                                style={{ width: `${healingProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 shrink-0">
                                {diffInDays < 0 ? (
                                    <div className="bg-white/10 backdrop-blur-xl px-5 py-3 rounded-2xl flex items-center gap-3 border border-white/10 shadow-lg">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-200">
                                            <Info size={16} />
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-black text-blue-200 uppercase tracking-widest mb-0.5">Note</span>
                                            <span className="block text-xs font-bold text-white">Starts after procedure</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/10 backdrop-blur-xl px-5 py-3 rounded-2xl flex items-center gap-4 border border-white/10 shadow-lg group-hover:bg-white/20 transition-all">
                                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex flex-col items-center justify-center border border-white/10">
                                            <span className="text-xs font-black leading-none">{new Date().toLocaleDateString('en-US', { day: 'numeric' })}</span>
                                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">{new Date().toLocaleDateString('en-US', { month: 'short' })}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-black text-blue-200 uppercase tracking-widest mb-1">Today</span>
                                            <span className="block text-base font-black text-white">
                                                {isSurgeryDay ? 'Surgery Day' : `Day ${diffInDays} of Recovery`}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Medication Daily List */}
                    {!isDropless && medsToTrack.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Personalized Routine</h3>
                                <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 italic">
                                    Grouped by session
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {medsToTrack.map((med) => {
                                    const isCompleted = med.progress === 100;
                                    return (
                                        <div key={med.id} className={`
                                            relative bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm transition-all duration-300
                                            ${isCompleted ? 'bg-emerald-50/30 border-emerald-100 ring-2 ring-emerald-500/10' : 'hover:shadow-md hover:border-slate-200'}
                                        `}>
                                            <div className="flex items-start justify-between mb-8">
                                                <div className="flex gap-5">
                                                    <div className={`
                                                        w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                                                        ${isCompleted ? 'bg-emerald-500 text-white rotate-6 scale-110 shadow-lg shadow-emerald-200' : 'bg-blue-50 text-blue-600'}
                                                    `}>
                                                        {isCompleted ? <CheckCircle2 size={28} /> : <Activity size={28} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                                            {med.name}
                                                            {isCompleted && <span className="text-xs font-black px-3 py-1 bg-emerald-500 text-white rounded-full uppercase tracking-tighter shadow-sm animate-bounce">Perfect</span>}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-xs font-black px-3 py-1 bg-slate-200 text-slate-700 rounded-lg uppercase tracking-wider border border-slate-300">
                                                                {med.type}
                                                            </span>
                                                            <span className="text-sm font-extrabold text-blue-700">{med.label}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white/50 backdrop-blur-sm p-1 rounded-full border border-slate-100">
                                                    <CircularProgress progress={med.progress} color={isCompleted ? "text-emerald-500" : "text-blue-600"} />
                                                </div>
                                            </div>

                                            {/* Doses grid - Session Based */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {Array.from({ length: med.frequency }).map((_, idx) => {
                                                    const isChecked = !!todaysLocalProgress[`${med.id}_${idx}`];
                                                    const session = SESSIONS[idx] || { label: `Dose ${idx + 1}`, time: '', icon: 'Clock' };

                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleToggle(med.id, idx)}
                                                            className={`
                                                                relative p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all duration-300 group overflow-hidden
                                                                ${isChecked
                                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 translate-y-[-2px]'
                                                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-700 hover:shadow-xl hover:shadow-blue-100'
                                                                }
                                                            `}
                                                        >
                                                            {/* Ripple Effect for unchecked */}
                                                            {!isChecked && <div className="absolute inset-0 bg-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />}

                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`text-[13px] font-black uppercase tracking-[0.15em] ${isChecked ? 'text-white/90' : 'text-slate-500'}`}>
                                                                    {session.label}
                                                                </span>
                                                                {session.time && <span className={`text-[11px] font-extrabold italic ${isChecked ? 'text-white/70' : 'text-blue-500'}`}>@{session.time}</span>}
                                                            </div>

                                                            <div className={`
                                                                w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                                                                ${isChecked ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-blue-600 shadow-sm'}
                                                            `}>
                                                                {isChecked ? <CheckCircle2 size={28} /> : (idx + 1)}
                                                            </div>

                                                            <span className={`text-[14px] font-black uppercase tracking-widest leading-none ${isChecked ? 'text-white' : 'text-slate-800'}`}>
                                                                {isChecked ? 'Confirmed' : 'Take Drop'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Long-Term / Glaucoma Section */}
                    {postOp?.glaucoma?.resume && (
                        <div className="relative overflow-hidden bg-white/40 backdrop-blur-md rounded-[32px] p-8 border border-emerald-100/50 shadow-sm transition-all hover:bg-white/60">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-100 rotate-[-4deg]">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-emerald-900 uppercase tracking-[0.2em]">Maintenance Care</h3>
                                    <p className="text-xs font-bold text-emerald-700 mt-0.5">Long-term eye health</p>
                                </div>
                            </div>

                            <p className="text-sm text-emerald-800/80 font-semibold leading-relaxed mb-6 relative z-10 max-w-lg">
                                Please continue your prior routine as usual. These are vital for your long-term vision health alongside your new recovery drops.
                            </p>

                            <div className="flex flex-wrap gap-3 relative z-10">
                                {(postOp.glaucoma.medications || []).map((m: string, i: number) => (
                                    <div key={i} className="px-4 py-2 bg-white rounded-xl text-xs font-black text-emerald-700 shadow-sm border border-emerald-100/50 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        {m}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FAQ Section */}
                    {moduleContent?.faqs && moduleContent.faqs.length > 0 && (
                        <div className="space-y-6 pt-4">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] px-1">Common Questions</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {moduleContent.faqs.map((faq: any, index: number) => {
                                    const isOpen = openFaqIndex === index;
                                    return (
                                        <div key={index} className={`
                                            group rounded-[28px] border transition-all duration-500 overflow-hidden
                                            ${isOpen
                                                ? 'bg-white border-blue-200 shadow-xl shadow-blue-50'
                                                : 'bg-white/50 border-slate-100 hover:border-blue-200 hover:bg-white backdrop-blur-sm'
                                            }
                                        `}>
                                            <button
                                                onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                                className="w-full text-left p-6 flex justify-between items-center gap-4"
                                            >
                                                <div className={`font-black text-lg leading-snug transition-colors ${isOpen ? 'text-blue-900' : 'text-slate-800 group-hover:text-blue-600'}`}>
                                                    <ReactMarkdown components={{ p: Fragment }}>{faq.question}</ReactMarkdown>
                                                </div>
                                                <div className={`
                                                    shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500
                                                    ${isOpen ? 'bg-blue-600 text-white rotate-180 shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500'}
                                                `}>
                                                    <ChevronDown size={14} />
                                                </div>
                                            </button>
                                            <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="p-6 pt-0 text-base text-slate-700 leading-relaxed font-bold bg-gradient-to-b from-transparent to-slate-50/50">
                                                    <div className="h-[1px] w-full bg-slate-200 mb-6" />
                                                    <ReactMarkdown>{faq.answer}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Bot Action Section (Centered Consistency) */}
                    <div className="mt-12 p-10 rounded-[40px] bg-violet-50/50 border border-violet-100 text-center max-w-2xl mx-auto shadow-sm">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-violet-600 mx-auto mb-6 shadow-sm">
                            <MessageCircle size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                            Still have questions?
                        </h3>
                        <p className="text-slate-600 mb-8 text-base font-bold leading-relaxed max-w-sm mx-auto">
                            Our AI assistant can explain your recovery progress in more detail based on your personal records.
                        </p>
                        <button
                            onClick={() =>
                                onOpenChat?.(
                                    sanitizeQuestion(moduleContent?.botStarterPrompt || "Tell me more about my recovery")
                                )
                            }
                            className="inline-flex items-center gap-3 px-10 py-5 rounded-3xl bg-violet-600 text-white font-black text-lg shadow-xl shadow-violet-200 hover:shadow-2xl hover:bg-violet-700 hover:scale-105 transition-all"
                        >
                            <MessageCircle size={24} />
                            Chat with Assistant
                        </button>
                    </div>
                </div>

                <style>{`
                .animate-fadeIn {
                    animation: fadeIn 0.4s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
            </div>
        </div>
    );
};

export default AfterSurgeryModal;
