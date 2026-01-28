import React, { useState, Fragment } from 'react';
import { X, Info, ArrowLeft, Check, AlertCircle, Scan, Grid, MoreHorizontal, Sun, ChevronRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../theme';
import { GeminiContentResponse } from '../types';
import ReactMarkdown from 'react-markdown';

interface IOLModalProps {
    onClose: () => void;
    moduleContent: GeminiContentResponse | null;
    onOpenChat: (initialMessage?: string) => void;
    isLoading?: boolean;
}

// Skeleton content component for IOL Modal
const IOLSkeletonContent: React.FC = () => (
    <div className="flex-1 p-8 overflow-y-auto animate-pulse">
        {/* Definition Banner Skeleton */}
        <div className="bg-violet-50 border-l-4 border-violet-200 rounded-r-xl p-6 mb-10 flex gap-4">
            <div className="w-7 h-7 bg-violet-200 rounded flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-5 bg-violet-200 rounded w-3/4" />
                <div className="h-5 bg-violet-100 rounded w-full" />
            </div>
        </div>

        <div className="h-8 bg-slate-200 rounded w-48 mb-6" />

        {/* IOL Options Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200">
                    <div className="w-12 h-12 rounded-xl bg-violet-100 mb-4" />
                    <div className="space-y-2">
                        <div className="h-6 bg-slate-200 rounded w-32" />
                        <div className="h-4 bg-slate-100 rounded w-full" />
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                    </div>
                </div>
            ))}
        </div>

        {/* FAQ Skeleton */}
        <div className="mb-10 max-w-4xl mx-auto">
            <div className="h-5 bg-slate-200 rounded w-56 mx-auto mb-4" />
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 flex justify-between items-center">
                        <div className="h-5 bg-slate-200 rounded w-3/4" />
                        <div className="w-8 h-8 bg-slate-100 rounded-full" />
                    </div>
                ))}
            </div>
        </div>

        {/* Chat CTA Skeleton */}
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center max-w-2xl mx-auto">
            <div className="h-5 bg-slate-200 rounded w-40 mx-auto mb-2" />
            <div className="h-4 bg-slate-100 rounded w-64 mx-auto mb-4" />
            <div className="h-12 bg-violet-200 rounded-full w-48 mx-auto" />
        </div>
    </div>
);

// Hardcoded FAQs for "What is an IOL?" module
const iolFaqs = [
    {
        question: "How long does an IOL last?",
        answer: "An IOL is designed to be a **permanent implant** and typically lasts a lifetime. Unlike contact lenses or glasses, you don't need to replace it. The materials used (usually acrylic or silicone) are biocompatible and remain stable in the eye for decades."
    },
    {
        question: "Will I feel the IOL in my eye?",
        answer: "No, you will **not feel the IOL** once it's implanted. The lens is placed inside the eye's natural lens capsule, and there are no nerve endings there to sense it. Most patients forget they even have an artificial lens."
    },
    {
        question: "Can an IOL be removed or replaced if needed?",
        answer: "Yes, in rare cases an IOL can be removed or exchanged, but this is uncommon. Reasons for IOL exchange might include incorrect lens power, lens dislocation, or patient dissatisfaction with a premium lens. This is a more complex procedure than the original surgery."
    },
    {
        question: "What happens to my natural lens during cataract surgery?",
        answer: "During cataract surgery, your **cloudy natural lens (the cataract) is removed** using ultrasound energy to break it into tiny pieces. These pieces are then gently suctioned out. The thin capsule that held your natural lens is left in place, and the new IOL is inserted into this capsule."
    }
];

interface IOLOption {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    definition: string;
    benefits: string[];
    tradeoffs: string[];
    toricInfo: string;
}

const iolOptions: IOLOption[] = [
    {
        id: 'monofocal',
        title: 'Monofocal',
        description: 'Standard lens providing clear vision at one distance (usually far/driving).',
        icon: Scan,
        definition: 'Monofocal lenses are the standard option, designed to provide clear vision at one specific distance—typically set for distance (driving) vision. You will likely need glasses for reading and intermediate work (like computer use). If you have minimal astigmatism, you can expect excellent distance vision.',
        benefits: [
            'Covered by most standard insurance plans',
            'Excellent quality of vision for distance (with minimal astigmatism)',
            'Minimal chance of glare or halos at night',
            'Proven technology with decades of success'
        ],
        tradeoffs: [
            'Requires glasses for reading and intermediate (computer) distance',
            'If you have astigmatism, you may also need glasses for distance',
            'Does not correct astigmatism (unless Toric version or laser correction is used)'
        ],
        toricInfo: 'A Monofocal Toric IOL is available to correct moderate to high astigmatism, giving you sharper distance vision without glasses. For low levels of astigmatism, your doctor may recommend laser-assisted surgery as an alternative.'
    },
    {
        id: 'multifocal',
        title: 'Multifocal',
        description: 'See clearly at ALL three distances—far, intermediate, and near.',
        icon: Grid,
        definition: 'Multifocal lenses provide clear vision at ALL three distances—far (driving), intermediate (computer), and near (reading fine print like medicine bottles or recipes). They work like bifocal or progressive eyeglasses, using concentric rings to split light into different focal points. This is the closest option to being completely glasses-free after surgery.',
        benefits: [
            'Greatest freedom from glasses—see at all distances',
            'Can read fine print, use computer, and drive without glasses',
            'Excellent for active lifestyles'
        ],
        tradeoffs: [
            'There is a chance you may experience halos and glare around lights at night',
            'Your brain needs time to adapt (usually 3-6 months)',
            'Premium cost not covered by insurance'
        ],
        toricInfo: 'If you have astigmatism, a Toric Multifocal IOL can correct it while also providing vision at all distances. For low levels of astigmatism, laser correction during surgery may be an alternative option.'
    },
    {
        id: 'edof',
        title: 'EDOF',
        description: 'Continuous range of vision from distance (driving) to intermediate (computer).',
        icon: MoreHorizontal,
        definition: 'Extended Depth of Focus (EDOF) lenses provide a continuous range of high-quality vision from distance (driving vision) to intermediate (computer vision). They offer fewer halos and glare at night compared to multifocal lenses, and are generally about half the cost. However, you may still need over-the-counter reading glasses for very fine print.',
        benefits: [
            'Clear vision from distance (driving) to intermediate (computer)',
            'Fewer halos and glare at night compared to multifocal',
            'More affordable than multifocal lenses'
        ],
        tradeoffs: [
            'May still need over-the-counter reading glasses for fine print (like medicine bottles or recipes)',
            'Does not provide full near vision like multifocal',
            'Premium cost not covered by insurance'
        ],
        toricInfo: 'Toric EDOF lenses are available to correct astigmatism while providing the extended range of vision. For low levels of astigmatism, laser correction may be an alternative option.'
    },
    {
        id: 'lal',
        title: 'Light Adjustable Lens (LAL)',
        description: 'The only lens that can be fine-tuned AFTER surgery.',
        icon: Sun,
        definition: 'The Light Adjustable Lens (LAL) is the only IOL that allows your doctor to adjust and customize your vision AFTER surgery using special UV light treatments. This lens provides ONE range of vision (like monofocal), but you can decide your exact visual outcome after seeing the results. This is especially helpful if your lens measurements are not 100% reliable (for example, if you have had prior LASIK or PRK surgery).',
        benefits: [
            'Vision can be customized and adjusted after surgery',
            'Ideal if you have had prior LASIK or PRK surgery',
            'You can choose: both eyes for distance, or one for distance and one for near (monovision)',
            'Highest level of customization available'
        ],
        tradeoffs: [
            'This lens provides ONE range of vision—it is not multifocal',
            'Requires UV-protective glasses for 2-3 weeks after surgery',
            'Multiple follow-up visits needed for light adjustment treatments',
            'Premium cost not covered by insurance'
        ],
        toricInfo: 'The LAL can treat astigmatism with extreme precision during the light adjustment phase. This allows fine-tuning after surgery to ensure the sharpest possible vision.'
    }
];

const IOLModal: React.FC<IOLModalProps> = ({ onClose, moduleContent, onOpenChat, isLoading = false }) => {
    const [selectedLens, setSelectedLens] = useState<IOLOption | null>(null);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const { classes } = useTheme();

    // Sanitize helper for chat prompt
    const sanitizeQuestion = (q?: string) =>
        (q || "")
            .replace(/\*\*/g, "")
            .replace(/__/g, "")
            .replace(/`+/g, "")
            .replace(/\s+/g, " ")
            .trim();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-6xl h-[95vh] bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-20 p-2.5 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white hover:text-white"
                >
                    <X size={22} />
                </button>

                {/* Header */}
                <div className="px-8 pt-6 pb-4 bg-gradient-to-r from-violet-600 to-purple-600 shrink-0 z-10">
                    <h1 className="text-2xl font-bold mb-1 text-white">
                        {selectedLens ? 'Lens Details' : 'What is an IOL?'}
                    </h1>
                    <p className="text-base text-white/80">
                        {selectedLens ? 'Understanding this lens option' : 'Learn about intraocular lens implants'}
                    </p>
                </div>

                {/* Main Layout Area */}
                <div className="flex-1 relative overflow-hidden bg-slate-50">

                    {/* Content Area - shows skeleton or actual content */}
                    {isLoading ? (
                        <IOLSkeletonContent />
                    ) : (
                    <>
                    {/* VIEW 1: SELECTION LIST */}
                    <div
                        className={`absolute inset-0 p-8 overflow-y-auto transition-transform duration-500 ease-in-out ${selectedLens ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
                    >
                        {/* Definition Banner */}
                        <div className="bg-violet-50 border-l-4 border-violet-500 rounded-r-xl p-6 mb-10 flex gap-4 items-start shadow-sm">
                            <Info className="flex-shrink-0 text-violet-600 mt-0.5" size={26} />
                            <p className="text-slate-700 leading-relaxed text-xl">
                                An <strong className="text-violet-700">intraocular lens (IOL)</strong> is a tiny, artificial lens for the eye. It replaces the eye's natural lens that is removed during cataract surgery.
                            </p>
                        </div>

                        <h2 className="text-2xl font-bold text-slate-900 mb-6">IOL Lens Options</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                            {iolOptions.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setSelectedLens(option)}
                                    className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/50 transition-all text-left flex flex-col gap-4 group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <option.icon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2">{option.title}</h3>
                                        <p className="text-slate-600 text-base">{option.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* FAQs Section - Always render with hardcoded FAQs */}
                        <div className="mb-10 max-w-4xl mx-auto">
                            <h3 className="text-base font-bold text-slate-600 uppercase tracking-wider mb-4 text-center">Frequently Asked Questions</h3>
                            <div className="space-y-3">
                                {iolFaqs.map((faq, index) => {
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

                                            <div
                                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                                            >
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
                        <div className={`mt-8 p-6 rounded-2xl ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                            <h3 className={`text-lg font-semibold ${classes.primaryText} mb-2`}>
                                Still have questions?
                            </h3>
                            <p className="text-slate-600 mb-4">
                                Our AI assistant can explain IOL options in more detail based on your personal medical records.
                            </p>
                            <button
                                onClick={() =>
                                    onOpenChat(
                                        sanitizeQuestion(moduleContent?.botStarterPrompt) ||
                                        `Tell me more about IOL options`
                                    )
                                }
                                className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${classes.fabBg} text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                Chat with Assistant
                            </button>
                        </div>
                    </div>

                    {/* VIEW 2: DETAIL SLIDE-IN */}
                    <div
                        className={`absolute inset-0 bg-white flex flex-col transition-transform duration-500 ease-in-out ${selectedLens ? 'translate-x-0' : 'translate-x-full'}`}
                    >
                        {selectedLens && (
                            <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarGutter: 'stable' }}>
                                {/* Back Button */}
                                <button
                                    onClick={() => setSelectedLens(null)}
                                    className="flex items-center gap-2 text-violet-600 font-bold mb-8 hover:text-violet-800 transition-colors"
                                >
                                    <ArrowLeft size={20} />
                                    Back to All Lenses
                                </button>

                                {/* Title */}
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
                                        <selectedLens.icon size={32} />
                                    </div>
                                    <h2 className="text-4xl font-bold text-slate-900">{selectedLens.title} IOL</h2>
                                </div>

                                {/* Definition */}
                                <div className="mb-10">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Overview</h3>
                                    <p className="text-xl text-slate-700 leading-relaxed">
                                        {selectedLens.definition}
                                    </p>
                                </div>

                                {/* Trade-offs */}
                                <div className="mb-10">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Trade-offs to Consider</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                                            <ul className="space-y-4">
                                                {selectedLens.benefits.map((benefit, i) => (
                                                    <li key={i} className="flex gap-3 items-start">
                                                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Check size={16} className="text-emerald-700" strokeWidth={3} />
                                                        </div>
                                                        <span className="text-emerald-900 font-medium text-base">{benefit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
                                            <ul className="space-y-4">
                                                {selectedLens.tradeoffs.map((con, i) => (
                                                    <li key={i} className="flex gap-3 items-start">
                                                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <AlertCircle size={16} className="text-orange-600" strokeWidth={3} />
                                                        </div>
                                                        <span className="text-orange-900 font-medium text-base">{con}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Toric Option */}
                                <div className="bg-blue-50 rounded-3xl p-8 relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-xl font-bold text-slate-900">About the Toric Option</h3>
                                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold uppercase rounded tracking-wide">
                                                Astigmatism Correction
                                            </span>
                                        </div>
                                        <p className="text-blue-900 leading-relaxed text-base">
                                            {selectedLens.toricInfo}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    </>
                    )}

                </div>
            </div>
        </div>
    );
};

export default IOLModal;
