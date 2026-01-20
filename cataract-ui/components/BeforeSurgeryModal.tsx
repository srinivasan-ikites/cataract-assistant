import React, { useState, useEffect, Fragment } from 'react';
import { X, Calendar, AlertCircle, CheckCircle2, ChevronDown, Clock, Phone, ArrowRight, ShieldCheck, MapPin, Coffee, Utensils, Car, Shirt, Droplets, MessageCircle } from 'lucide-react';
import { useTheme } from '../theme';
import { Patient, api } from '../services/api';
import { getAntibioticName, getFrequencyName } from '../constants/medications';
import { GeminiContentResponse } from '../types';
import ReactMarkdown from 'react-markdown';

interface BeforeSurgeryModalProps {
    onClose: () => void;
    patient: Patient | null;
    moduleContent: GeminiContentResponse | null;
    onOpenChat: (msg?: string) => void;
}

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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Until Surgery</span>
                <span className="text-5xl font-black text-slate-900 leading-none">{days}</span>
                <span className="text-sm font-bold text-slate-500 mt-1">Days</span>
            </div>
            {/* Inner shadow effect from image */}
            <div className="absolute inset-4 rounded-full shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)] pointer-events-none"></div>
        </div>
    );
};

const BeforeSurgeryModal: React.FC<BeforeSurgeryModalProps> = ({ onClose, patient, moduleContent, onOpenChat }) => {
    const { classes } = useTheme();
    const [checklist, setChecklist] = useState<Record<string, Record<string, boolean>>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [lockedMessageDate, setLockedMessageDate] = useState<string | null>(null);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    // const surgeryDateStr = "2026-01-07"
    // const surgeryDateStr = patient?.surgical_recommendations_by_doctor?.scheduling?.surgery_date;
    const surgeryDateStr = "2026-01-19"
    const arrivalTime = patient?.surgical_recommendations_by_doctor?.scheduling?.arrival_time || "7:00 AM";

    // Use fallback lookups if strings are missing
    const antibioticName = patient?.medications?.pre_op?.antibiotic_name || getAntibioticName(patient?.medications?.pre_op?.antibiotic_id);
    const frequency = patient?.medications?.pre_op?.frequency || getFrequencyName(patient?.medications?.pre_op?.frequency_id);

    // Load initial progress and set initial expanded day
    useEffect(() => {
        if (patient?.medications?.pre_op?.progress) {
            const initialChecklist: Record<string, Record<string, boolean>> = {};
            Object.entries(patient.medications.pre_op.progress).forEach(([d, items]) => {
                initialChecklist[d] = {};
                items.forEach(id => {
                    initialChecklist[d][id] = true;
                });
            });
            setChecklist(initialChecklist);
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

    const getFrequencyItems = (freq?: string) => {
        const lower = (freq || '').toLowerCase();
        if (lower.includes('4 times') || lower.includes('qid')) {
            return [
                { id: 'morning', label: 'Morning Drop', sub: '1 drop in ' + (patient?.clinical_context?.diagnosis?.anatomical_status?.includes('Right') ? 'Right eye' : 'target eye'), time: '8:00 AM' },
                { id: 'noon', label: 'Noon Drop', sub: '1 drop in target eye', time: '12:00 PM' },
                { id: 'afternoon', label: 'Afternoon Drop', sub: '1 drop in target eye', time: '4:00 PM' },
                { id: 'bedtime', label: 'Bedtime Drop', sub: '1 drop in target eye', time: '9:00 PM' },
            ];
        }
        // Default to 3 times if something is set, or if it explicitly says 3 times
        return [
            { id: 'morning', label: 'Morning Drop', sub: '1 drop in ' + (patient?.clinical_context?.diagnosis?.anatomical_status?.includes('Right') ? 'Right eye' : 'target eye'), time: '8:00 AM' },
            { id: 'afternoon', label: 'Afternoon Drop', sub: '1 drop in target eye', time: '2:00 PM' },
            { id: 'evening', label: 'Evening Drop', sub: '1 drop in target eye', time: '8:00 PM' },
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
            const progressRecord: Record<string, string[]> = {};
            Object.entries(newChecklist).forEach(([d, items]) => {
                progressRecord[d] = Object.entries(items)
                    .filter(([_, checked]) => checked)
                    .map(([id, _]) => id);
            });

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
        } catch (err) {
            console.error("Failed to save progress:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const trackerItems = getFrequencyItems(frequency);

    const toggleItem = async (dateKey: string, itemId: string) => {
        // Only allow toggling for Today or Past days
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

        trackerItems.forEach(item => {
            newChecklist[todayKey][item.id] = true;
        });

        setChecklist(newChecklist);
        await syncChecklist(newChecklist);
    };

    // No longer need a duplicate local definition
    // Case 1: 3-Day Window Logic
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-4xl h-[90vh] bg-[#f8f9fc] rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
                {/* Dynamic Header */}
                <div className="flex items-center justify-between px-10 py-6 bg-white shrink-0">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                            {activeCase === 'SURGERY_DAY' ? 'Surgery Day Dashboard' :
                                activeCase === 'POST_SURGERY' ? 'Preparation Complete' :
                                    'Before Surgery Preparation'}
                        </h1>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400">
                        <X size={24} />
                    </button>
                </div>

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
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Arrival</span>
                                        </div>
                                        <p className="text-xl font-black mt-1">{arrivalTime}</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                                        <div className="flex items-center gap-3">
                                            <MapPin size={20} className="text-blue-200" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Location</span>
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
                                <p className="text-emerald-100 font-bold">You've successfully completed your pre-op routine.</p>
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
                                            <h3 className="font-black text-slate-900 text-lg">Next Step: Pharmacy</h3>
                                            <p className="text-slate-500 text-sm">
                                                Ensure you have picked up your <strong className="text-slate-700">{antibioticName}</strong> drops from the pharmacy.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-violet-50 rounded-[24px] p-6 border border-violet-100 flex items-start gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <AlertCircle size={20} className="text-violet-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-black text-slate-900 text-lg">Action Required: Drops</h3>
                                            <p className="text-slate-500 text-sm">Please follow your {antibioticName} schedule below.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-[24px] p-4 border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">SURGERY DATE</span>
                                        <p className="font-black text-slate-900">{new Date(surgeryDateStr!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                    </div>
                                    <div className="bg-white rounded-[24px] p-4 border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">TIME</span>
                                        <p className="font-black text-slate-900">{arrivalTime}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dynamic Tracker: Timeline vs Upcoming */}
                    {(activeCase === 'TIMELINE' || activeCase === 'PHARMACY') && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-black text-slate-900">Eye Drop Tracker</h2>
                            <div className="space-y-6">
                                {timelineDays.map((date, index) => {
                                    const dateKey = formatDateKey(date);
                                    const isFuture = date.getTime() > new Date().setHours(0, 0, 0, 0);
                                    const isPast = date.getTime() < new Date().setHours(0, 0, 0, 0);
                                    const isTodayDay = date.getTime() === new Date().setHours(0, 0, 0, 0);
                                    const dayProgress = checklist[dateKey] ? Object.values(checklist[dateKey]).filter(v => v).length : 0;
                                    const dayCompleted = dayProgress === trackerItems.length;

                                    return (
                                        <div key={dateKey} className={`relative flex gap-6 transition-all duration-300 ${isFuture ? 'hover:translate-x-1' : ''}`}>
                                            {/* Vertical Line */}
                                            {index < 2 && <div className="absolute left-[27px] top-14 bottom-[-24px] w-0.5 bg-slate-200" />}

                                            {/* Date Node */}
                                            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 transition-all ${isTodayDay && activeCase !== 'PHARMACY' ? 'bg-violet-600 border-violet-600 text-white' :
                                                dayCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white border-slate-100 text-slate-400'
                                                }`}>
                                                <span className="text-[10px] font-black uppercase leading-none mb-1">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                <span className="text-xl font-black leading-none">{date.getDate()}</span>
                                            </div>

                                            {/* Day Accordion */}
                                            <div className={`flex-1 bg-white rounded-[24px] border ${isTodayDay && activeCase !== 'PHARMACY' ? 'border-violet-200 shadow-lg' : 'border-slate-100'} overflow-hidden transition-all duration-300`}>
                                                <button
                                                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                                                    className={`w-full px-6 py-4 flex items-center justify-between text-left transition-colors ${isFuture ? 'bg-slate-50/50 hover:bg-slate-100' : 'hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div>
                                                        <span className={`text-sm font-black ${isFuture ? 'text-slate-400' : 'text-slate-900'}`}>
                                                            Day {3 - index} before Surgery {isTodayDay ? '(Today)' : isPast ? '(Past Day)' : '(Upcoming)'}
                                                        </span>
                                                        <p className="text-xs font-bold text-slate-400">{dayProgress}/{trackerItems.length} drops taken</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {isPast && dayCompleted && <CheckCircle2 className="text-emerald-500" size={20} />}
                                                        <ChevronDown className={`text-slate-400 transition-transform duration-300 ${expandedIndex === index ? 'rotate-180' : ''}`} size={20} />
                                                    </div>
                                                </button>

                                                {/* Locked Status Message */}
                                                {lockedMessageDate === dateKey && (
                                                    <div className="px-6 py-2 bg-amber-50 border-y border-amber-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                                        <AlertCircle size={14} className="text-amber-600" />
                                                        <p className="text-[11px] font-bold text-amber-700">
                                                            This tracker starts 3 days before surgery on {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.
                                                        </p>
                                                    </div>
                                                )}

                                                {expandedIndex === index && (
                                                    <div className="px-6 pb-6 pt-2 divide-y divide-slate-50">
                                                        {trackerItems.length > 0 ? (
                                                            trackerItems.map(item => (
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
                                                                            <p className="text-sm font-bold text-slate-900">{item.label}</p>
                                                                            <p className="text-xs text-slate-400">{item.time} • {item.sub}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-4">
                                                                <p className="text-sm text-slate-400 italic">No medication frequency set.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

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
                            <h3 className="text-xl font-black text-slate-900">Night Before Rules</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <RuleCard icon={<Utensils />} title="Fast after Midnight" desc="No food or water after 12:00 AM." />
                                <RuleCard icon={<Car />} title="Arrange a Driver" desc="Ensure a ride is confirmed for home." />
                                <RuleCard icon={<ShieldCheck />} title="Regular Meds" desc="Take heart meds with a sip of water." />
                            </div>
                        </div>
                    )}

                    {/* FAQ Section */}
                    {moduleContent?.faqs && moduleContent.faqs.length > 0 && (
                        <div className="space-y-6 pt-10 border-t border-slate-100">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider text-center">Frequently Asked Questions</h3>
                            <div className="space-y-3">
                                {moduleContent.faqs.map((faq, index) => {
                                    const isOpen = openFaqIndex === index;
                                    return (
                                        <div key={index} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                            <button
                                                onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                                className="w-full text-left p-5 flex justify-between items-start gap-4 transition-colors"
                                            >
                                                <div className={`font-medium text-base transition-colors ${isOpen ? 'text-blue-800' : 'text-slate-700'}`}>
                                                    <ReactMarkdown components={{ p: Fragment }}>{faq.question}</ReactMarkdown>
                                                </div>
                                                <span className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 ${isOpen ? 'rotate-180 bg-blue-200 text-blue-700' : 'bg-slate-50 text-slate-400 shadow-sm'}`}>
                                                    <ChevronDown size={18} />
                                                </span>
                                            </button>

                                            <div
                                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                                    }`}
                                            >
                                                <div className="p-5 pt-0 text-slate-600 leading-relaxed text-sm">
                                                    <div className="h-px w-full bg-slate-200/60 mb-4"></div>
                                                    <ReactMarkdown>{faq.answer || ""}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Bot Action Section */}
                    <div className={`mt-8 p-6 rounded-[28px] ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                        <h3 className={`text-lg font-semibold ${classes.primaryText} mb-2`}>
                            Still have questions?
                        </h3>
                        <p className="text-slate-600 mb-4 text-sm">
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
            </div>
        </div>
    );
};

const RuleCard = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
        <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">{icon}</div>
        <div>
            <h4 className="font-black text-slate-900 text-sm">{title}</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed mt-1 font-bold">{desc}</p>
        </div>
    </div>
);

export default BeforeSurgeryModal;
