import React, { useState, Fragment, useCallback } from 'react';
import { X, ChevronDown, Clipboard, AlertCircle, ChevronLeft, Info, Eye, Volume2, VolumeX, Search, MapPin, HelpCircle, Lightbulb, Users } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Patient } from '../services/api';
import { GeminiContentResponse } from '../types';
import { useTheme } from '../theme';
import VisionSlider from './VisionSlider';
import CataractTypeCard from './CataractTypeCard';
import {
    getCataractTypeFromId,
    getOtherCataractTypes,
    getCataractVisionEffect,
    CataractType,
} from '../data/cataractTypes';

interface DiagnosisModalProps {
    patient: Patient | null;
    moduleContent: GeminiContentResponse | null;
    onClose: () => void;
    onOpenChat: (initialMessage?: string) => void;
    isLoading?: boolean;
}

type TabType = 'visual' | 'anatomical';

// Skeleton content component (inner content only, no wrapper)
const DiagnosisSkeletonContent: React.FC = () => (
    <div className="overflow-y-auto p-8">
        <div className="flex flex-col lg:flex-row gap-6 animate-pulse">
            {/* Left Column Skeleton */}
            <div className="flex-1 bg-slate-100 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-slate-200 rounded" />
                    <div className="h-4 bg-slate-200 rounded w-32" />
                </div>
                <div className="h-8 bg-slate-200 rounded w-3/4" />
                <div className="flex gap-2">
                    <div className="h-8 bg-slate-200 rounded-lg w-24" />
                    <div className="h-8 bg-slate-200 rounded-lg w-32" />
                </div>
                <div className="space-y-2 mt-4">
                    <div className="h-4 bg-slate-200 rounded w-full" />
                    <div className="h-4 bg-slate-200 rounded w-5/6" />
                    <div className="h-4 bg-slate-200 rounded w-4/5" />
                </div>
            </div>
            {/* Right Column Skeleton */}
            <div className="flex-1 space-y-4">
                <div className="flex gap-2">
                    <div className="h-10 bg-slate-200 rounded-full flex-1" />
                    <div className="h-10 bg-slate-200 rounded-full flex-1" />
                </div>
                <div className="h-[320px] bg-slate-200 rounded-2xl" />
            </div>
        </div>
        {/* Other Cataract Types Skeleton */}
        <div className="mt-8 space-y-4">
            <div className="h-6 bg-slate-200 rounded w-48" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 bg-slate-200 rounded-xl" />
                ))}
            </div>
        </div>
    </div>
);

const DiagnosisModal: React.FC<DiagnosisModalProps> = ({
    patient,
    moduleContent,
    onClose,
    onOpenChat,
    isLoading = false,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('visual');
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [selectedOtherCataract, setSelectedOtherCataract] = useState<CataractType | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const { classes } = useTheme();

    // Text-to-Speech functionality
    const handleSpeak = useCallback((text: string) => {
        if (isSpeaking) {
            // Stop speaking
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            // Start speaking
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    }, [isSpeaking]);

    // Extract patient clinical data from per-eye structure (v2 schema)
    const odRight = patient?.clinical_context?.od_right;
    const osLeft = patient?.clinical_context?.os_left;

    // Get primary_cataract_type from per-eye data
    const odCataractType = odRight?.primary_cataract_type;
    const osCataractType = osLeft?.primary_cataract_type;

    // Determine the primary cataract type to display
    // Logic: Use OD (right eye) if available, otherwise OS (left eye)
    // If both are different, we'll show both in the UI
    const primaryCataractType = odCataractType || osCataractType || '';
    const hasDifferentCataractTypes = odCataractType && osCataractType && odCataractType !== osCataractType;

    // Get pathology text for display
    const odPathology = odRight?.pathology || '';
    const osPathology = osLeft?.pathology || '';

    // Legacy fallbacks
    const diagnosis = patient?.clinical_context?.diagnosis;
    const patientDiagnosisType = diagnosis?.type || 'Cataract';
    const comorbidities = patient?.clinical_context?.ocular_comorbidities || patient?.clinical_context?.comorbidities || [];
    const symptoms = patient?.clinical_context?.symptoms_reported_by_patient || [];
    const examDate = patient?.surgical_recommendations_by_doctor?.decision_date || '';

    // Debug: Log cataract type data
    console.log('[DiagnosisModal] OD cataract type:', odCataractType);
    console.log('[DiagnosisModal] OS cataract type:', osCataractType);
    console.log('[DiagnosisModal] Primary cataract type:', primaryCataractType);

    // Use LLM-generated structured fields (with fallbacks to patient data)
    // Priority: moduleContent fields > patient data fields > defaults
    const diagnosisType = moduleContent?.primary_diagnosis_type || moduleContent?.title || patientDiagnosisType;
    const cataractTypeTags = moduleContent?.cataract_types || [];
    const additionalConditions = moduleContent?.additional_conditions || comorbidities;
    const eyesSameCondition = moduleContent?.eyes_same_condition ?? !hasDifferentCataractTypes;
    const rightEyeDetails = moduleContent?.right_eye;
    const leftEyeDetails = moduleContent?.left_eye;

    // Check if we have per-eye data to display
    const hasPerEyeData = !!(rightEyeDetails || leftEyeDetails);

    // Use structured field for cataract type lookup (visual simulation)
    const patientCataractType = getCataractTypeFromId(primaryCataractType);
    const otherCataractTypes = getOtherCataractTypes(primaryCataractType);
    const visionEffect = getCataractVisionEffect(primaryCataractType);

    // Get per-eye cataract type info for display
    const odCataractTypeInfo = getCataractTypeFromId(odCataractType);
    const osCataractTypeInfo = getCataractTypeFromId(osCataractType);

    // Get the primary cataract image from structured field
    const primaryCataractImage = patientCataractType?.eyeImage || '/assets/diagnosis/eye_healthy.png';

    // Fallback to parsing pathology if LLM tags not available
    const pathologyTags = cataractTypeTags.length > 0
        ? cataractTypeTags
        : [odPathology, osPathology].filter(Boolean).join(' and ').split(' and ').map(t => t.trim()).filter(Boolean);

    // Patient name - use the correct Patient interface fields
    const patientName = patient?.name
        ? `${patient.name.first} ${patient.name.last?.charAt(0) || ''}.`
        : 'Patient';


    // Format exam date
    const formattedExamDate = examDate
        ? new Date(examDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

    // Use summary from module content (generated by AI)
    const descriptionText = moduleContent?.summary || '';

    const sanitizeQuestion = (q?: string) =>
        (q || '')
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/`+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    // Single persistent modal wrapper - only inner content changes
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container - stays mounted, no re-animation */}
            <div className="relative w-full max-w-[85vw] max-h-[96vh] bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-10 p-2.5 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white hover:text-white"
                >
                    <X size={22} />
                </button>

                {/* Header */}
                <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-violet-600 to-purple-600 shrink-0">
                    <h1 className="text-2xl font-bold mb-1 text-white">My Diagnosis</h1>
                    <p className="text-base text-white/80">
                        Understanding your cataract diagnosis and what it means for your vision
                    </p>
                </div>

                {/* Content Area - shows skeleton or actual content */}
                {isLoading ? (
                    <DiagnosisSkeletonContent />
                ) : (
                <div className="overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>

                    {/* Main Content - Two Column Layout */}
                    <div className="px-8 pt-6 pb-6">
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Left Column - Diagnosis Info */}
                            <div className={`flex-1 ${classes.surfaceVariant} rounded-2xl p-6 border ${classes.cube.rightBorder}`}>
                                {/* Primary Diagnosis Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <Clipboard size={20} className={classes.primaryText} />
                                        <span className={`text-base font-semibold ${classes.primaryText} uppercase tracking-wide`}>
                                            Primary Diagnosis
                                        </span>
                                        {/* Audio Button */}
                                        <button
                                            onClick={() => handleSpeak(descriptionText)}
                                            className={`p-2 rounded-full transition-all ${
                                                isSpeaking
                                                    ? 'bg-violet-100 text-violet-600'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                            }`}
                                            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                                        >
                                            {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                        </button>
                                    </div>
                                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-bold uppercase tracking-wide rounded-full">
                                        Confirmed
                                    </span>
                                </div>

                                {/* Diagnosis Title */}
                                <h2 className={`text-3xl font-bold ${classes.cube.rightTitle} mb-3`}>
                                    {diagnosisType}
                                </h2>

                                {/* Pathology Tags */}
                                <div className="flex flex-wrap gap-2 mb-5">
                                    {pathologyTags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className={`px-4 py-2 bg-white border ${classes.cube.rightBorder} rounded-lg text-base font-medium ${classes.primaryText}`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Description from Module Content */}
                                <div className="text-slate-700 leading-relaxed mb-5 text-base [&>p]:mb-3 last:[&>p]:mb-0">
                                    <ReactMarkdown>{descriptionText}</ReactMarkdown>
                                </div>

                                {/* Per-Eye Details - Show whenever we have eye data */}
                                {hasPerEyeData && (
                                    <div className="mb-4">
                                        {/* Optional note when both eyes have similar conditions */}
                                        {eyesSameCondition && rightEyeDetails && leftEyeDetails && (
                                            <p className="text-base text-slate-700 mb-3 italic">
                                                Both eyes have similar conditions with slight variations:
                                            </p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {rightEyeDetails && (
                                                <div className="bg-white rounded-xl p-4 border border-slate-200">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Eye size={18} className="text-blue-600" />
                                                        <h4 className="text-base font-bold text-slate-700 uppercase tracking-wide">
                                                            Right Eye (OD)
                                                        </h4>
                                                    </div>
                                                    <p className="text-base font-semibold text-slate-800 mb-1">
                                                        {rightEyeDetails.condition}
                                                    </p>
                                                    <p className="text-sm text-slate-600 leading-relaxed">
                                                        <ReactMarkdown>{rightEyeDetails.description}</ReactMarkdown>
                                                    </p>
                                                </div>
                                            )}
                                            {leftEyeDetails && (
                                                <div className="bg-white rounded-xl p-4 border border-slate-200">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Eye size={18} className="text-green-600" />
                                                        <h4 className="text-base font-bold text-slate-700 uppercase tracking-wide">
                                                            Left Eye (OS)
                                                        </h4>
                                                    </div>
                                                    <p className="text-base font-semibold text-slate-800 mb-1">
                                                        {leftEyeDetails.condition}
                                                    </p>
                                                    <p className="text-sm text-slate-600 leading-relaxed">
                                                        <ReactMarkdown>{leftEyeDetails.description}</ReactMarkdown>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Additional Conditions (conditional rendering) */}
                                {additionalConditions.length > 0 && (
                                    <div className="bg-white rounded-xl p-4 border border-slate-200">
                                        <h4 className="text-base font-bold text-slate-700 uppercase tracking-wide mb-3">
                                            Additional Conditions
                                        </h4>
                                        <ul className="space-y-2">
                                            {additionalConditions.map((condition, i) => (
                                                <li key={i} className="flex items-center gap-2 text-base text-slate-700">
                                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                    {condition}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Visual Tabs */}
                            <div className="lg:w-[480px] flex flex-col">
                                {/* Tab Headers */}
                                <div className="flex border-b border-slate-200 mb-4">
                                    <button
                                        onClick={() => setActiveTab('visual')}
                                        className={`flex-1 py-3 text-base font-semibold transition-colors relative ${activeTab === 'visual'
                                            ? 'text-violet-600'
                                            : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                    >
                                        Visual Simulation
                                        {activeTab === 'visual' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('anatomical')}
                                        className={`flex-1 py-3 text-base font-semibold transition-colors relative ${activeTab === 'anatomical'
                                            ? 'text-violet-600'
                                            : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                    >
                                        Anatomical View
                                        {activeTab === 'anatomical' && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" />
                                        )}
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="h-[320px] shrink-0 rounded-2xl overflow-hidden bg-slate-100">
                                    {activeTab === 'visual' ? (
                                        <VisionSlider
                                            leftImage="/assets/diagnosis/landscape_scene.jpg"
                                            rightImage="/assets/diagnosis/landscape_scene.jpg"
                                            leftLabel="Healthy Vision"
                                            rightLabel="Your Vision"
                                            rightFilter={visionEffect}
                                            caption={`Effect of ${patientCataractType?.name || 'Cataract'} on clarity`}
                                        />
                                    ) : (
                                        <VisionSlider
                                            leftImage="/assets/diagnosis/eye_healthy.png"
                                            rightImage={primaryCataractImage}
                                            leftLabel="Healthy Eye"
                                            rightLabel="Your Eye"
                                            caption={`${diagnosisType} - Anatomical comparison`}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Other Cataract Types Section */}
                    {otherCataractTypes.length > 0 && (
                        <div className="px-8 pb-6">
                            <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${classes.primaryText}`}>
                                <Info size={22} />
                                Other Cataract Types
                            </h3>

                            {/* Animated Container */}
                            <div className="relative min-h-[300px]">
                                {/* List View */}
                                {!selectedOtherCataract ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
                                        {otherCataractTypes.map((cataract) => (
                                            <CataractTypeCard
                                                key={cataract.id}
                                                cataract={cataract}
                                                onClick={() => setSelectedOtherCataract(cataract)}
                                                className="h-full"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    /* Detail View Overlay - Structured Patient Education Layout */
                                    <div className="animate-slideIn relative bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                        {/* Header */}
                                        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4 flex items-center gap-3 sticky top-0 z-10">
                                            <button
                                                onClick={() => setSelectedOtherCataract(null)}
                                                className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
                                            >
                                                <ChevronLeft size={24} />
                                            </button>
                                            <div>
                                                <h3 className="text-2xl font-bold text-white">{selectedOtherCataract.name}</h3>
                                                <p className="text-base text-white/80">{selectedOtherCataract.tagline}</p>
                                            </div>
                                        </div>

                                        <div className="p-6 overflow-y-auto max-h-[600px]">
                                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                                {/* Left Column - Main Content (3/5) */}
                                                <div className="lg:col-span-3 space-y-5">
                                                    {/* What is it? */}
                                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-violet-700 mb-3 uppercase tracking-wide">
                                                            <Search size={16} className="text-violet-500" />
                                                            What is it?
                                                        </h4>
                                                        <p className="text-slate-700 leading-relaxed text-base">
                                                            {selectedOtherCataract.whatItIs}
                                                        </p>
                                                    </div>

                                                    {/* Where it Forms */}
                                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-700 mb-3 uppercase tracking-wide">
                                                            <MapPin size={16} className="text-blue-500" />
                                                            Where it forms
                                                        </h4>
                                                        <p className="text-slate-700 leading-relaxed text-base">
                                                            {selectedOtherCataract.whereItForms}
                                                        </p>
                                                    </div>

                                                    {/* Why it Happens */}
                                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-amber-700 mb-3 uppercase tracking-wide">
                                                            <HelpCircle size={16} className="text-amber-500" />
                                                            Why it happens
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {selectedOtherCataract.whyItHappens.map((reason, idx) => (
                                                                <li key={idx} className="flex items-baseline gap-3 text-slate-700 text-base">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2" />
                                                                    <span>{reason}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* How it Affects Vision */}
                                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-purple-700 mb-3 uppercase tracking-wide">
                                                            <Eye size={16} className="text-purple-500" />
                                                            How it affects your vision
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {selectedOtherCataract.howItAffectsVision.map((effect, idx) => (
                                                                <li key={idx} className="flex items-baseline gap-3 text-slate-700 text-base">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-2" />
                                                                    <span>{effect}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>

                                                {/* Right Column - Sidebar (2/5) */}
                                                <div className="lg:col-span-2 space-y-5">
                                                    {/* Anatomical View */}
                                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                                                            <Eye size={16} className="text-slate-500" />
                                                            Anatomical View
                                                        </h4>
                                                        <div className="bg-slate-900 rounded-lg overflow-hidden h-[200px] relative">
                                                            <VisionSlider
                                                                leftImage="/assets/diagnosis/eye_healthy.png"
                                                                rightImage={selectedOtherCataract.eyeImage}
                                                                leftLabel="Healthy"
                                                                rightLabel={selectedOtherCataract.shortName}
                                                                caption=""
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-2 text-center">
                                                            Slide to compare healthy vs affected lens
                                                        </p>
                                                    </div>

                                                    {/* Common Symptoms */}
                                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-rose-700 mb-3 uppercase tracking-wide">
                                                            <AlertCircle size={16} className="text-rose-500" />
                                                            Common Symptoms
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedOtherCataract.symptoms.map((symptom, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-3 py-1.5 bg-rose-50 text-rose-700 text-sm font-medium rounded-full border border-rose-100"
                                                                >
                                                                    {symptom}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Risk Factors (if available) */}
                                                    {selectedOtherCataract.riskFactors && selectedOtherCataract.riskFactors.length > 0 && (
                                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                                                                <Users size={16} className="text-slate-500" />
                                                                Risk Factors
                                                            </h4>
                                                            <ul className="space-y-1.5">
                                                                {selectedOtherCataract.riskFactors.map((factor, idx) => (
                                                                    <li key={idx} className="flex items-baseline gap-2 text-slate-600 text-sm">
                                                                        <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                                                                        <span>{factor}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Good to Know */}
                                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-700 mb-3 uppercase tracking-wide">
                                                            <Lightbulb size={16} className="text-emerald-500" />
                                                            Good to Know
                                                        </h4>
                                                        <p className="text-emerald-800 leading-relaxed text-sm">
                                                            {selectedOtherCataract.goodToKnow}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}        {/* FAQs Section */}
                    {moduleContent?.faqs && moduleContent.faqs.length > 0 && (
                        <div className="px-8 pb-6">
                            <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider mb-4">
                                Frequently Asked Questions
                            </h3>
                            <div className="space-y-3">
                                {moduleContent.faqs.map((faq, index) => {
                                    const isOpen = openFaqIndex === index;
                                    return (
                                        <div
                                            key={index}
                                            className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen
                                                ? 'bg-violet-50/50 border-violet-200 shadow-sm'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            <button
                                                onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                                className="w-full text-left p-5 flex justify-between items-start gap-4"
                                            >
                                                <div
                                                    className={`font-medium text-base transition-colors ${isOpen ? 'text-violet-800' : 'text-slate-700'
                                                        }`}
                                                >
                                                    <ReactMarkdown components={{ p: Fragment }}>{faq.question}</ReactMarkdown>
                                                </div>
                                                <span
                                                    className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 ${isOpen
                                                        ? 'rotate-180 bg-violet-200 text-violet-700'
                                                        : 'bg-slate-100 text-slate-400'
                                                        }`}
                                                >
                                                    <ChevronDown size={18} />
                                                </span>
                                            </button>

                                            <div
                                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                                    }`}
                                            >
                                                <div className="p-5 pt-0 text-slate-600 leading-relaxed text-base">
                                                    <div className="h-px w-full bg-slate-200/60 mb-4" />
                                                    <ReactMarkdown>{faq.answer || ''}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Chat CTA Footer */}
                    <div className="px-8 pb-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div>
                                <h4 className="text-violet-600 font-semibold mb-1">Still have questions?</h4>
                                <p className="text-sm text-slate-600">
                                    Our AI assistant can explain your charts based on your records.
                                </p>
                            </div>
                            <button
                                onClick={() =>
                                    onOpenChat(
                                        sanitizeQuestion(moduleContent?.botStarterPrompt) ||
                                        `Tell me more about my ${diagnosisType} diagnosis`
                                    )
                                }
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-violet-600 text-white font-medium shadow-lg hover:bg-violet-700 hover:shadow-xl hover:scale-105 transition-all whitespace-nowrap"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Chat with Assistant
                            </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default DiagnosisModal;
