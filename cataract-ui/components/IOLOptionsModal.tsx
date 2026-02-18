import React, { useState, Fragment, useMemo } from 'react';
import { X, ChevronDown, Eye, Check, Info, DollarSign, Sparkles, Zap, Star, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Patient } from '../services/api';
import { GeminiContentResponse } from '../types';
import { useTheme } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

interface SurgicalPackage {
    package_id: string;
    display_name: string;
    description: string;
    price_cash: number;
    includes_laser: boolean;
    allowed_lens_codes: string[];
    insurance_coverage?: string;
}

interface CandidacyProfile {
    is_candidate_multifocal?: boolean;
    is_candidate_edof?: boolean;
    is_candidate_toric?: boolean;
    is_candidate_lal?: boolean;
}

interface IOLOptionsModalProps {
    patient: Patient | null;
    surgicalPackages: SurgicalPackage[];
    moduleContent: GeminiContentResponse | null;
    onClose: () => void;
    onOpenChat: (initialMessage?: string) => void;
    isLoading?: boolean;
}

// Skeleton content component for IOL Options Modal
const IOLOptionsSkeletonContent: React.FC = () => (
    <div className="overflow-y-auto animate-pulse">
        {/* Main Content */}
        <div className="px-8 pt-6 pb-6 space-y-6">
            {/* About Your Eyes Section Skeleton */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-violet-100 to-blue-100 px-6 py-4 border-b border-violet-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white rounded-xl w-11 h-11" />
                        <div className="space-y-2">
                            <div className="h-5 bg-violet-200 rounded w-36" />
                            <div className="h-4 bg-violet-100 rounded w-56" />
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                            <div className="w-2 h-2 rounded-full bg-slate-300 mt-2" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-1/3" />
                                <div className="h-4 bg-slate-100 rounded w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Standard Options Section Skeleton */}
            <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                    <div className="p-2 bg-emerald-100 rounded-lg w-9 h-9" />
                    <div className="h-6 bg-slate-200 rounded w-40" />
                </div>
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 border-l-4 border-l-emerald-500">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1 space-y-3">
                                    <div className="h-6 bg-slate-200 rounded w-56" />
                                    <div className="flex gap-2">
                                        <div className="h-7 bg-emerald-100 rounded-full w-36" />
                                        <div className="h-7 bg-blue-100 rounded-full w-28" />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="h-7 bg-emerald-100 rounded w-40" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 bg-slate-100 rounded w-full" />
                                <div className="h-4 bg-slate-100 rounded w-5/6" />
                            </div>
                            <div className="h-5 bg-violet-100 rounded w-24 mt-4" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Premium Options Section Skeleton */}
            <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                    <div className="p-2 bg-amber-100 rounded-lg w-9 h-9" />
                    <div className="h-6 bg-slate-200 rounded w-40" />
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-4 h-16" />
                <div className="space-y-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 border-l-4 border-l-amber-500">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1 space-y-3">
                                    <div className="h-6 bg-slate-200 rounded w-48" />
                                    <div className="flex gap-2">
                                        <div className="h-7 bg-amber-100 rounded-full w-24" />
                                        <div className="h-7 bg-blue-100 rounded-full w-28" />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="h-7 bg-slate-200 rounded w-24" />
                                    <div className="h-4 bg-slate-100 rounded w-20 mt-1" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 bg-slate-100 rounded w-full" />
                                <div className="h-4 bg-slate-100 rounded w-4/5" />
                            </div>
                            <div className="h-5 bg-violet-100 rounded w-24 mt-4" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Cost Disclaimer Skeleton */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-amber-100 rounded-xl w-11 h-11" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 bg-amber-200 rounded w-32" />
                        <div className="h-4 bg-amber-100 rounded w-full" />
                        <div className="h-4 bg-amber-100 rounded w-3/4" />
                    </div>
                </div>
            </div>
        </div>

        {/* FAQs Section Skeleton */}
        <div className="px-8 pb-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                <div className="p-2 bg-blue-100 rounded-lg w-9 h-9" />
                <div className="h-6 bg-slate-200 rounded w-56" />
            </div>
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex justify-between items-center">
                        <div className="h-5 bg-slate-200 rounded w-3/4" />
                        <div className="w-9 h-9 bg-slate-100 rounded-full" />
                    </div>
                ))}
            </div>
        </div>

        {/* Chat CTA Skeleton */}
        <div className="px-8 pb-8">
            <div className="p-6 bg-violet-50 rounded-2xl border border-violet-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-5 bg-violet-200 rounded w-56" />
                    <div className="h-4 bg-violet-100 rounded w-72" />
                </div>
                <div className="h-12 bg-violet-300 rounded-full w-48" />
            </div>
        </div>
    </div>
);

// ============================================================================
// HARDCODED FAQs FOR MY IOL OPTIONS
// ============================================================================

const iolOptionsFaqs = [
    {
        question: "How do I choose the right IOL for me?",
        answer: "The best IOL depends on your **lifestyle, visual goals, and eye health**. Consider: Do you want to minimize glasses use? How important is night driving? Do you have astigmatism? Your doctor has already evaluated your candidacy for each lens type based on your eye exam. Discuss your daily activities and priorities with your doctor to make the best choice."
    },
    {
        question: "What if I'm not satisfied with my IOL choice?",
        answer: "While IOL exchange is possible, it's a more complex procedure than the original surgery. That's why it's important to **discuss your expectations thoroughly** before surgery. Most patients adapt well to their new lens within a few weeks. If you experience persistent issues, talk to your doctor about options."
    },
    {
        question: "Can I have different IOLs in each eye?",
        answer: "Yes! This is called **\"blended vision\" or \"monovision\"** and is a common strategy. For example, one eye might have a lens optimized for distance while the other is set for intermediate or near vision. Your brain learns to use both eyes together. This can reduce dependence on glasses."
    },
    {
        question: "Are premium IOLs worth the extra cost?",
        answer: "It depends on your priorities. **Premium IOLs** (multifocal, EDOF, Toric) offer benefits like reduced glasses dependence or astigmatism correction, but come with additional out-of-pocket costs. If being glasses-free is important to you and you're a good candidate, premium lenses can significantly improve your quality of life."
    }
];

// ============================================================================
// PATIENT-FRIENDLY CONTENT (Hardcoded)
// ============================================================================

const PACKAGE_INFO: Record<string, {
    patientTitle: string;
    patientDescription: string;
    benefits: string[];
    considerations: string[];
    category: 'standard' | 'premium' | 'toric';
}> = {
    PKG_STD: {
        patientTitle: 'Standard / Monofocal Lens',
        patientDescription: 'A reliable lens that gives you clear vision at one range of vision (usually far away). This is the most common choice and is fully covered by insurance. If you have astigmatism, you may still need glasses for far away vision.',
        benefits: [
            'Fully covered by insurance - no out-of-pocket cost',
            'Excellent far away vision for driving, watching TV',
            'Proven technology with decades of success',
        ],
        considerations: [
            'You will need reading glasses for close-up tasks',
            'May need glasses for computer and intermediate range',
            'May need glasses for far away vision if you have astigmatism',
        ],
        category: 'standard',
    },
    PKG_LASER_LRI: {
        patientTitle: 'Standard / Monofocal Lens + Laser Assisted',
        patientDescription: 'The same reliable lens with added laser technology for more precise incisions. The laser can also help correct minor astigmatism.',
        benefits: [
            'Minimal dependence on glasses for far away vision',
            'Can correct minor astigmatism during surgery',
            'More precise surgical incisions',
            'Potentially faster healing',
        ],
        considerations: [
            'Additional out-of-pocket cost for laser portion',
            'You will need reading glasses for close-up tasks',
            'May need glasses for computer and intermediate range',
        ],
        category: 'standard',
    },
    PKG_EDOF: {
        patientTitle: 'Extended Vision Lens (EDOF)',
        patientDescription: 'See clearly for distance range (far away/driving) and also intermediate range (arm\'s length/computer). A great choice if you spend time driving, watching TV, or using the computer.',
        benefits: [
            'Clear vision from distance to intermediate (computer)',
            'Fewer halos and glare at night than multifocal',
            'Reduced dependence on glasses for most activities',
            'Astigmatism correction can be built into the lens',
        ],
        considerations: [
            'May still need reading glasses for very small print',
            'Premium cost not covered by insurance',
        ],
        category: 'premium',
    },
    PKG_EDOF_LASER: {
        patientTitle: 'Extended Vision Lens + Laser Assisted',
        patientDescription: 'Extended vision lens combined with laser precision. Best for patients who want the most advanced cataract surgery.',
        benefits: [
            'All benefits of EDOF lens',
            'Enhanced precision with laser technology',
            'Can address minor astigmatism',
            'Astigmatism correction can be built into the lens',
        ],
        considerations: [
            'Higher premium cost',
            'May still need reading glasses for very small print',
        ],
        category: 'premium',
    },
    PKG_MULTIFOCAL: {
        patientTitle: 'Multifocal Lens',
        patientDescription: 'See clearly at all ranges of vision - far, intermediate, and near. The closest option to being glasses-free after surgery.',
        benefits: [
            'Clear vision at all ranges of vision (driving, watching TV, using computer, reading fine print)',
            'Greatest freedom from glasses',
            'Excellent for active lifestyles',
            'Astigmatism correction can be built into the lens',
        ],
        considerations: [
            'Some patients notice glare and halos around lights at night',
            'Brain needs time to adapt (usually 3-6 months)',
            'Premium cost not covered by insurance',
        ],
        category: 'premium',
    },
    PKG_MULTIFOCAL_LASER: {
        patientTitle: 'Multifocal Lens + Laser Assisted',
        patientDescription: 'Multifocal lens with laser precision. Best for patients who want the most advanced cataract surgery at all ranges of vision.',
        benefits: [
            'All benefits of multifocal lens',
            'Maximum surgical precision',
            'Optimal lens positioning',
            'Astigmatism correction can be built into the lens',
        ],
        considerations: [
            'Highest premium cost',
            'Some patients notice glare and halos around lights at night',
            'Brain needs time to adapt (usually 3-6 months)',
        ],
        category: 'premium',
    },
    PKG_LAL: {
        patientTitle: 'Light Adjustable Lens (LAL)',
        patientDescription: 'The only lens that can be fine-tuned AFTER surgery using special UV light treatments. Precise vision at one range of vision chosen by you. The clearest vision is achieved in only one range based on your choice - the other ranges will require glasses.',
        benefits: [
            'Vision can be adjusted after surgery',
            'Highest level of customization',
            'Can fine-tune for your exact needs',
        ],
        considerations: [
            'Requires UV-protective glasses for 2-3 weeks',
            'Multiple follow-up visits for light treatments',
            'Glasses needed for ranges of vision not selected',
            'Highest premium cost',
        ],
        category: 'premium',
    },
    PKG_TORIC: {
        patientTitle: 'Astigmatism Correction with Toric IOL',
        patientDescription: 'A special lens designed to correct astigmatism - the irregular curve in your cornea that causes blurry vision at all ranges.',
        benefits: [
            'Most accurate astigmatism correction',
            'Minimal dependence on glasses for one range of vision (usually far away)',
            'Corrects astigmatism during cataract surgery',
        ],
        considerations: [
            'Additional out-of-pocket cost — not covered by insurance',
            'Lens will be precisely positioned manually without laser incision',
            'Will still need glasses for reading and intermediate range',
        ],
        category: 'toric',
    },
    PKG_TORIC_LASER: {
        patientTitle: 'Astigmatism Correction with Toric IOL + Laser',
        patientDescription: 'Toric lens with laser technology for the most precise astigmatism correction. The laser helps ensure perfect lens alignment.',
        benefits: [
            'Most accurate astigmatism correction',
            'Minimal dependence on glasses for one range of vision (usually far away)',
            'Laser-guided precision for optimal lens alignment',
        ],
        considerations: [
            'Additional out-of-pocket cost — not covered by insurance',
            'Will still need glasses for reading and intermediate range',
        ],
        category: 'toric',
    },
};

// Default info for custom packages
const DEFAULT_PACKAGE_INFO = {
    patientTitle: '',
    patientDescription: '',
    benefits: [],
    considerations: [],
    category: 'standard' as const,
};

// ============================================================================
// COMPONENT
// ============================================================================

const IOLOptionsModal: React.FC<IOLOptionsModalProps> = ({
    patient,
    surgicalPackages,
    moduleContent,
    onClose,
    onOpenChat,
    isLoading = false,
}) => {
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
    const { classes } = useTheme();

    // Extract surgical plan data from patient
    const surgicalPlan = patient?.surgical_plan;
    const samePlanBothEyes = surgicalPlan?.same_plan_both_eyes ?? true;

    // Unified packages (when same plan for both eyes)
    const offeredPackageIds: string[] = surgicalPlan?.offered_packages || [];
    const selectedPackageId = surgicalPlan?.patient_selection?.selected_package_id || '';

    // Per-eye packages (when different plans)
    const offeredPackageIdsOD: string[] = surgicalPlan?.offered_packages_od || [];
    const offeredPackageIdsOS: string[] = surgicalPlan?.offered_packages_os || [];
    const selectedPackageIdOD = surgicalPlan?.patient_selection_od?.selected_package_id || '';
    const selectedPackageIdOS = surgicalPlan?.patient_selection_os?.selected_package_id || '';

    // Candidacy profile per eye
    const candidacyOD: CandidacyProfile = surgicalPlan?.candidacy_profile?.od_right || {};
    const candidacyOS: CandidacyProfile = surgicalPlan?.candidacy_profile?.os_left || {};

    // Patient name
    const patientName = patient?.name?.first || 'there';

    // Check eligibility flags
    const hasAstigmatism = candidacyOD.is_candidate_toric || candidacyOS.is_candidate_toric;
    const isMultifocalCandidate = candidacyOD.is_candidate_multifocal || candidacyOS.is_candidate_multifocal;
    const isEdofCandidate = candidacyOD.is_candidate_edof || candidacyOS.is_candidate_edof;
    const isLALCandidate = candidacyOD.is_candidate_lal || candidacyOS.is_candidate_lal;

    // Categorize offered packages
    const categorizedPackages = useMemo(() => {
        const standard: SurgicalPackage[] = [];
        const premium: SurgicalPackage[] = [];
        const toric: SurgicalPackage[] = [];

        offeredPackageIds.forEach(id => {
            const pkg = surgicalPackages.find(p => p.package_id === id);
            if (!pkg) return;

            const info = PACKAGE_INFO[id] || DEFAULT_PACKAGE_INFO;
            if (info.category === 'toric') {
                toric.push(pkg);
            } else if (info.category === 'premium') {
                premium.push(pkg);
            } else {
                standard.push(pkg);
            }
        });

        return { standard, premium, toric };
    }, [offeredPackageIds, surgicalPackages]);

    // Determine what to show based on doctor's selections
    const hasStandardOnly = categorizedPackages.standard.length > 0 &&
                           categorizedPackages.premium.length === 0;
    const hasPremiumOptions = categorizedPackages.premium.length > 0;
    const hasToricOptions = categorizedPackages.toric.length > 0;

    // Helper functions
    const formatPrice = (price: number) => {
        if (price === 0) return 'Covered by Insurance';
        return `$${price.toLocaleString()}`;
    };

    const getPackageInfo = (packageId: string) => {
        return PACKAGE_INFO[packageId] || DEFAULT_PACKAGE_INFO;
    };

    const sanitizeQuestion = (q?: string) =>
        (q || '')
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/`+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    // Render a package card with optional eye indicator for per-eye mode
    const renderPackageCard = (pkg: SurgicalPackage, highlight: boolean = false, eyeIndicator?: { forOD: boolean; forOS: boolean; selectedOD: boolean; selectedOS: boolean }) => {
        const info = getPackageInfo(pkg.package_id);
        const isExpanded = expandedPackage === pkg.package_id;
        // For per-eye mode, check if selected for either eye; for unified mode, use the regular check
        const isSelected = eyeIndicator
            ? (eyeIndicator.selectedOD || eyeIndicator.selectedOS)
            : selectedPackageId === pkg.package_id;
        const isInsuranceCovered = pkg.price_cash === 0;

        return (
            <div
                key={pkg.package_id}
                className={`rounded-2xl overflow-hidden transition-all duration-200 ${
                    isSelected
                        ? 'border-2 border-violet-500 bg-gradient-to-br from-violet-50 to-white shadow-lg shadow-violet-100'
                        : highlight
                        ? 'border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-white shadow-md shadow-emerald-100'
                        : 'border border-slate-200 bg-white hover:border-violet-300 hover:shadow-lg hover:shadow-slate-100'
                }`}
            >
                {/* Header with gradient accent */}
                <div className={`p-6 ${isInsuranceCovered ? 'border-l-4 border-l-emerald-500' : pkg.includes_laser ? 'border-l-4 border-l-blue-500' : info.category === 'premium' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-violet-500'}`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-2">
                                <h4 className="font-bold text-slate-900 text-xl">
                                    {info.patientTitle || pkg.display_name}
                                </h4>
                                {isSelected && (
                                    <span className="px-3 py-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold rounded-full shadow-sm">
                                        Your Selection
                                    </span>
                                )}
                            </div>
                            {/* Eye indicator badges for per-eye mode */}
                            {eyeIndicator && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {eyeIndicator.forOD && (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-semibold rounded-full ${
                                            eyeIndicator.selectedOD
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                                        }`}>
                                            <span className="w-2 h-2 rounded-full bg-current opacity-60"></span>
                                            Right Eye {eyeIndicator.selectedOD && '✓'}
                                        </span>
                                    )}
                                    {eyeIndicator.forOS && (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-semibold rounded-full ${
                                            eyeIndicator.selectedOS
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                        }`}>
                                            <span className="w-2 h-2 rounded-full bg-current opacity-60"></span>
                                            Left Eye {eyeIndicator.selectedOS && '✓'}
                                        </span>
                                    )}
                                </div>
                            )}
                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                {isInsuranceCovered && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 text-sm font-semibold rounded-full border border-emerald-200">
                                        <Check size={14} className="text-emerald-600" />
                                        Insurance Covered
                                    </span>
                                )}
                                {pkg.includes_laser && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 text-sm font-semibold rounded-full border border-blue-200">
                                        <Zap size={14} className="text-blue-600" />
                                        Laser Assisted
                                    </span>
                                )}
                                {info.category === 'premium' && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 text-sm font-semibold rounded-full border border-amber-200">
                                        <Star size={14} className="text-amber-600" />
                                        Premium
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className={`text-2xl font-bold ${isInsuranceCovered ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {formatPrice(pkg.price_cash)}
                            </p>
                            {!isInsuranceCovered && (
                                <p className="text-sm text-slate-600 font-medium">out-of-pocket</p>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-base text-slate-700 leading-relaxed">
                        {info.patientDescription || pkg.description}
                    </p>

                    {/* Expand/Collapse Button */}
                    {(info.benefits.length > 0 || info.considerations.length > 0) && (
                        <button
                            onClick={() => setExpandedPackage(isExpanded ? null : pkg.package_id)}
                            className="mt-4 text-base font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1.5 group"
                        >
                            {isExpanded ? 'Show less' : 'View details'}
                            <ChevronDown size={18} className={`transition-transform duration-200 group-hover:translate-y-0.5 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="px-6 pb-6 pt-0 border-t border-slate-100 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                            {info.benefits.length > 0 && (
                                <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-5 border border-emerald-100 shadow-sm">
                                    <h5 className="text-sm font-bold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <Check size={14} className="text-emerald-600" />
                                        </div>
                                        Benefits
                                    </h5>
                                    <ul className="space-y-2.5">
                                        {info.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-base text-emerald-900">
                                                <Check size={16} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                                                {benefit}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {info.considerations.length > 0 && (
                                <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-5 border border-amber-100 shadow-sm">
                                    <h5 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                            <Info size={14} className="text-amber-600" />
                                        </div>
                                        Things to Consider
                                    </h5>
                                    <ul className="space-y-2.5">
                                        {info.considerations.map((consideration, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-base text-amber-900">
                                                <Info size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
                                                {consideration}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-5xl max-h-[96vh] bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-10 p-2.5 bg-white hover:bg-slate-100 rounded-full transition-all shadow-md hover:shadow-lg text-slate-600 hover:text-slate-800"
                >
                    <X size={22} />
                </button>

                {/* Header */}
                <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-violet-600 to-purple-600 shrink-0">
                    <h1 className="text-2xl font-bold mb-1 text-white">My IOL Options</h1>
                    <p className="text-base text-white/80">
                        Lens options your doctor has recommended for you
                    </p>
                </div>

                {/* Scrollable Content - shows skeleton or actual content */}
                {isLoading ? (
                    <IOLOptionsSkeletonContent />
                ) : (
                <div className="overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                    {/* Main Content */}
                    <div className="px-8 pt-6 pb-6 space-y-6">

                        {/* About Your Eyes Section */}
                        {(hasAstigmatism || isMultifocalCandidate || isEdofCandidate || isLALCandidate || hasPremiumOptions) && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="bg-gradient-to-r from-violet-100 to-blue-100 px-6 py-4 border-b border-violet-200">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-white rounded-xl shadow-sm">
                                            <Eye size={22} className="text-violet-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">About Your Eyes</h3>
                                            <p className="text-base text-slate-700">
                                                Based on your eye exam, your doctor has noted:
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    {hasAstigmatism && (
                                        <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                                            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                                            <span className="text-base text-slate-800">
                                                <strong className="text-purple-700">You have astigmatism</strong> — Your cornea has a slight curve that can cause blurry vision. A <strong>Toric lens</strong> can correct this during surgery for sharper vision.
                                            </span>
                                        </div>
                                    )}
                                    {isEdofCandidate && (
                                        <div className="flex items-start gap-3 p-4 bg-sky-50 rounded-xl border border-sky-100">
                                            <div className="w-2 h-2 rounded-full bg-sky-500 mt-2 flex-shrink-0" />
                                            <span className="text-base text-slate-800">
                                                <strong className="text-sky-700">Extended vision lens (EDOF) is an option</strong> — You may benefit from an extended depth of focus lens that provides clear distance and intermediate vision with fewer visual disturbances at night.
                                            </span>
                                        </div>
                                    )}
                                    {isMultifocalCandidate && (
                                        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                            <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                                            <span className="text-base text-slate-800">
                                                <strong className="text-amber-700">Multifocal lens is an option</strong> — Based on your eye health and lifestyle, you may benefit from a multifocal lens that provides clear vision at multiple distances, reducing your need for glasses.
                                            </span>
                                        </div>
                                    )}
                                    {isLALCandidate && (
                                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                            <span className="text-base text-slate-800">
                                                <strong className="text-blue-700">Light Adjustable Lens is an option</strong> — Your eyes are suitable for the LAL, which can be fine-tuned after surgery for the most customized result.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Per-Eye Package Display - Single Column Layout */}
                        {!samePlanBothEyes && (offeredPackageIdsOD.length > 0 || offeredPackageIdsOS.length > 0) && (() => {
                            // Combine all unique packages from both eyes
                            const allPackageIds = [...new Set([...offeredPackageIdsOD, ...offeredPackageIdsOS])];

                            // Categorize packages for per-eye display
                            const perEyeStandard: Array<{pkg: SurgicalPackage; forOD: boolean; forOS: boolean}> = [];
                            const perEyePremium: Array<{pkg: SurgicalPackage; forOD: boolean; forOS: boolean}> = [];
                            const perEyeToric: Array<{pkg: SurgicalPackage; forOD: boolean; forOS: boolean}> = [];

                            allPackageIds.forEach(pkgId => {
                                const pkg = surgicalPackages.find(p => p.package_id === pkgId);
                                if (!pkg) return;
                                const info = PACKAGE_INFO[pkgId] || DEFAULT_PACKAGE_INFO;
                                const entry = {
                                    pkg,
                                    forOD: offeredPackageIdsOD.includes(pkgId),
                                    forOS: offeredPackageIdsOS.includes(pkgId)
                                };
                                if (info.category === 'toric') {
                                    perEyeToric.push(entry);
                                } else if (info.category === 'premium') {
                                    perEyePremium.push(entry);
                                } else {
                                    perEyeStandard.push(entry);
                                }
                            });

                            return (
                                <div className="space-y-6">
                                    {/* Header explaining per-eye approach */}
                                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-5">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2.5 bg-violet-100 rounded-xl flex-shrink-0">
                                                <Eye size={22} className="text-violet-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 mb-2">Personalized Options for Each Eye</h3>
                                                <p className="text-base text-slate-700 mb-3">
                                                    Your doctor has customized lens recommendations for each eye based on your individual needs.
                                                    Each option below shows which eye it's recommended for.
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full border border-blue-200">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                                        Right Eye
                                                    </span>
                                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full border border-emerald-200">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                                                        Left Eye
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Standard Options */}
                                    {perEyeStandard.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                                                <div className="p-2 bg-emerald-100 rounded-lg">
                                                    <Check size={20} className="text-emerald-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Standard Options</h3>
                                                    <p className="text-sm text-slate-600">Basic lens options covered by insurance</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {perEyeStandard.map(({pkg, forOD, forOS}) =>
                                                    renderPackageCard(pkg, false, {
                                                        forOD,
                                                        forOS,
                                                        selectedOD: selectedPackageIdOD === pkg.package_id,
                                                        selectedOS: selectedPackageIdOS === pkg.package_id
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Premium Options */}
                                    {perEyePremium.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                                                <div className="p-2 bg-amber-100 rounded-lg">
                                                    <Star size={20} className="text-amber-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Premium Options</h3>
                                                    <p className="text-sm text-slate-600">Advanced lenses to reduce glasses dependency</p>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-amber-50 to-white rounded-xl border border-amber-100 mb-4">
                                                <p className="text-base text-amber-900">
                                                    <Sparkles size={16} className="inline mr-2 text-amber-600" />
                                                    These advanced lenses can reduce or eliminate your need for glasses after surgery.
                                                </p>
                                            </div>
                                            <div className="space-y-4">
                                                {perEyePremium.map(({pkg, forOD, forOS}) =>
                                                    renderPackageCard(pkg, false, {
                                                        forOD,
                                                        forOS,
                                                        selectedOD: selectedPackageIdOD === pkg.package_id,
                                                        selectedOS: selectedPackageIdOS === pkg.package_id
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Toric/Astigmatism Options */}
                                    {perEyeToric.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                                                <div className="p-2 bg-purple-100 rounded-lg">
                                                    <Eye size={20} className="text-purple-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">Astigmatism Correction</h3>
                                                    <p className="text-sm text-slate-600">Special lenses to correct your astigmatism</p>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-xl border border-purple-200 mb-4">
                                                <p className="text-base text-purple-900">
                                                    <strong>Toric lenses</strong> correct the irregular curve in your cornea, giving you sharper vision without needing glasses to correct astigmatism.
                                                </p>
                                            </div>
                                            <div className="space-y-4">
                                                {perEyeToric.map(({pkg, forOD, forOS}) =>
                                                    renderPackageCard(pkg, false, {
                                                        forOD,
                                                        forOS,
                                                        selectedOD: selectedPackageIdOD === pkg.package_id,
                                                        selectedOS: selectedPackageIdOS === pkg.package_id
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* No Options State */}
                        {(samePlanBothEyes ? offeredPackageIds.length === 0 : (offeredPackageIdsOD.length === 0 && offeredPackageIdsOS.length === 0)) && (
                            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertCircle size={32} className="text-slate-500" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-xl mb-2">No Options Available Yet</h3>
                                <p className="text-base text-slate-700 max-w-md mx-auto">
                                    Your doctor hasn't selected lens options for you yet. Please check back after your consultation.
                                </p>
                            </div>
                        )}

                        {/* Standard Options - Only for unified plan */}
                        {samePlanBothEyes && categorizedPackages.standard.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                        <Check size={20} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            Standard Options
                                        </h3>
                                        {hasStandardOnly && (
                                            <p className="text-sm text-slate-600">
                                                Your doctor recommends these options
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {categorizedPackages.standard.map(pkg => renderPackageCard(pkg, hasStandardOnly))}
                                </div>

                                {hasStandardOnly && (
                                    <div className="mt-5 p-5 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 shadow-sm">
                                        <p className="text-base text-slate-700">
                                            <strong className="text-slate-900">Note:</strong> Your doctor has recommended standard lens options for your surgery.
                                            If you're interested in premium options (like multifocal or extended vision lenses),
                                            please discuss this during your next appointment.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Premium Options - Only for unified plan */}
                        {samePlanBothEyes && categorizedPackages.premium.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Star size={20} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            Premium Options
                                        </h3>
                                        <p className="text-sm text-slate-600">
                                            Your doctor recommends you consider these
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-r from-amber-50 to-white rounded-xl border border-amber-100 mb-4">
                                    <p className="text-base text-amber-900">
                                        <Sparkles size={16} className="inline mr-2 text-amber-600" />
                                        These advanced lenses can reduce or eliminate your need for glasses after surgery.
                                        They have an additional out-of-pocket cost not covered by insurance.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    {categorizedPackages.premium.map(pkg => renderPackageCard(pkg))}
                                </div>
                            </div>
                        )}

                        {/* Astigmatism/Toric Options - Only for unified plan */}
                        {samePlanBothEyes && categorizedPackages.toric.length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Eye size={20} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            Astigmatism Correction
                                        </h3>
                                        <p className="text-sm text-slate-600">
                                            Special lenses to correct your astigmatism
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gradient-to-r from-purple-50 to-white rounded-xl border border-purple-200 mb-4">
                                    <p className="text-base text-purple-900">
                                        <strong>Because you have astigmatism</strong>, your doctor recommends a Toric lens to correct the irregular curve in your cornea.
                                        This will give you sharper, clearer vision without needing glasses to correct astigmatism.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    {categorizedPackages.toric.map(pkg => renderPackageCard(pkg))}
                                </div>
                            </div>
                        )}

                        {/* Cost Disclaimer */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
                                    <DollarSign size={22} className="text-amber-600" />
                                </div>
                                <div className="text-base text-amber-900">
                                    <p className="font-bold text-lg mb-2">About Costs</p>
                                    <p>
                                        The prices shown are estimates. Your actual cost may vary based on your insurance coverage.
                                        For a detailed breakdown, please speak with our surgical coordinator or financial counselor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FAQs Section - Always render with hardcoded FAQs */}
                    <div className="px-8 pb-6">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Info size={20} className="text-blue-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">
                                Frequently Asked Questions
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {iolOptionsFaqs.map((faq, index) => {
                                const isOpen = openFaqIndex === index;
                                return (
                                    <div
                                        key={index}
                                        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                            isOpen
                                                ? 'bg-gradient-to-br from-violet-50 to-white border-violet-200 shadow-md'
                                                : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <button
                                            onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                            className="w-full text-left p-5 flex justify-between items-start gap-4"
                                        >
                                            <div className={`font-semibold text-base transition-colors ${isOpen ? 'text-violet-800' : 'text-slate-900'}`}>
                                                {faq.question}
                                            </div>
                                            <span className={`flex-shrink-0 p-2 rounded-full transition-all duration-200 ${isOpen ? 'rotate-180 bg-violet-200 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                                <ChevronDown size={18} />
                                            </span>
                                        </button>
                                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="p-5 pt-0 text-slate-800 leading-relaxed text-base">
                                                <div className="h-px w-full bg-violet-200/60 mb-4" />
                                                <ReactMarkdown>{faq.answer}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat CTA Footer */}
                    <div className="px-8 pb-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 shadow-sm">
                            <div>
                                <h4 className="text-violet-700 font-bold text-lg mb-1">Have questions about your options?</h4>
                                <p className="text-base text-slate-700">
                                    Our AI assistant can explain each lens type based on your specific situation.
                                </p>
                            </div>
                            <button
                                onClick={() => onOpenChat(sanitizeQuestion(moduleContent?.botStarterPrompt) || 'Help me understand my IOL options')}
                                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-base shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:scale-105 transition-all whitespace-nowrap"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default IOLOptionsModal;
