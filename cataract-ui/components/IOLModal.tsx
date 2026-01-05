import React, { useState, Fragment } from 'react';
import { X, Info, ArrowLeft, Check, AlertCircle, Scan, Grid, MoreHorizontal, Sun, ChevronRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../theme';
import { GeminiContentResponse } from '../types';
import ReactMarkdown from 'react-markdown';

interface IOLModalProps {
    onClose: () => void;
    moduleContent: GeminiContentResponse | null;
    onOpenChat: (initialMessage?: string) => void;
}

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
        description: 'Standard vision focused at a single distance.',
        icon: Scan,
        definition: 'Monofocal lenses are the standard option, designed to provide clear vision at one specific distance—usually far. You will likely need glasses for reading and intermediate work (like computer use).',
        benefits: [
            'Fully covered by insurance (Standard of Care)',
            'Excellent quality of vision for distance',
            'No glare or halos at night'
        ],
        tradeoffs: [
            'Requires reading glasses for near tasks',
            'Does not correct astigmatism (unless Toric version used)'
        ],
        toricInfo: 'A Monofocal Toric IOL is available to correct astigmatism, sharpening distance vision without the need for distance glasses.'
    },
    {
        id: 'multifocal',
        title: 'Multifocal',
        description: 'See clearly at near, intermediate, and far distances.',
        icon: Grid,
        definition: 'Multifocal lenses are designed to provide clear vision at multiple distances—near, intermediate, and far. They work somewhat like bifocal or progressive eyeglasses, using concentric rings to split light into different focal points. This reduces or eliminates the need for glasses after surgery.',
        benefits: [
            'High Spectacle Independence',
            'Clear vision at near, intermediate, and distance'
        ],
        tradeoffs: [
            'Potential Visual Disturbances: Some patients experience halos or glare around lights at night.',
            'Not covered by insurance (Out-of-pocket cost)'
        ],
        toricInfo: 'If you have astigmatism, a Toric Multifocal IOL can correct it while also providing the multifocal benefits. This ensures lines are straight and vision is crisp throughout the range.'
    },
    {
        id: 'edof',
        title: 'EDOF',
        description: 'Extended depth of focus for a continuous range of vision.',
        icon: MoreHorizontal,
        definition: 'Extended Depth of Focus (EDOF) lenses provide a continuous range of high-quality vision from distance to intermediate (computer distance). They offer fewer night-time side effects than multifocals but may still require mild reading glasses for very small print.',
        benefits: [
            'Seamless vision from far to intermediate',
            'Less glare/halos compared to Multifocals'
        ],
        tradeoffs: [
            'May still need reading glasses for fine print',
            'Premium option (Out-of-pocket cost)'
        ],
        toricInfo: 'Toric EDOF lenses are available to correct astigmatism, providing a wider range of clear vision while sharpening image quality.'
    },
    {
        id: 'lal',
        title: 'Light Adjustable Lens (LAL)',
        description: 'Power can be adjusted with UV light after surgery.',
        icon: Sun,
        definition: 'The Light Adjustable Lens (LAL) is the only IOL that allows your doctor to adjust and customize your vision AFTER the surgery using UV light treatments. This offers the ultimate precision for patients who want to fine-tune their visual outcome.',
        benefits: [
            'Customizable vision after surgery',
            'Can fix residual refractive error without extra surgery'
        ],
        tradeoffs: [
            'Requires UV protective glasses for a few weeks after surgery',
            'Requires multiple office visits for light treatments'
        ],
        toricInfo: 'The LAL can also treat astigmatism with extreme precision during the light adjustment phase, ensuring the sharpest possible vision.'
    }
];

const IOLModal: React.FC<IOLModalProps> = ({ onClose, moduleContent, onOpenChat }) => {
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
            <div className="relative w-full max-w-6xl h-[95vh] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]">

                {/* Header (Always Visible) */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 z-20 bg-white">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        {selectedLens ? 'Lens Details' : 'What is an IOL?'}
                    </h1>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Main Layout Area */}
                <div className="flex-1 relative overflow-hidden bg-slate-50">

                    {/* VIEW 1: SELECTION LIST */}
                    <div
                        className={`absolute inset-0 p-8 overflow-y-auto transition-transform duration-500 ease-in-out ${selectedLens ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
                    >
                        {/* Definition Banner */}
                        <div className="bg-violet-50 border-l-4 border-violet-500 rounded-r-xl p-6 mb-10 flex gap-4 items-start shadow-sm">
                            <Info className="flex-shrink-0 text-violet-600 mt-0.5" size={24} />
                            <p className="text-slate-700 leading-relaxed text-lg">
                                An <strong className="text-violet-700">intraocular lens (IOL)</strong> is a tiny, artificial lens for the eye. It replaces the eye's natural lens that is removed during cataract surgery.
                            </p>
                        </div>

                        <h2 className="text-xl font-bold text-slate-900 mb-6">IOL Lens Options</h2>

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
                                        <h3 className="text-lg font-bold text-slate-900 mb-2">{option.title}</h3>
                                        <p className="text-slate-500 text-sm">{option.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* FAQs Section */}
                        {moduleContent?.faqs && moduleContent.faqs.length > 0 && (
                            <div className="mb-10 max-w-4xl mx-auto">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Frequently Asked Questions</h3>
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
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Definition</h3>
                                    <p className="text-lg text-slate-700 leading-relaxed">
                                        {selectedLens.definition}
                                    </p>
                                </div>

                                {/* Trade-offs */}
                                <div className="mb-10">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Trade-offs to Consider</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                                            <ul className="space-y-4">
                                                {selectedLens.benefits.map((benefit, i) => (
                                                    <li key={i} className="flex gap-3 items-start">
                                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Check size={14} className="text-emerald-700" strokeWidth={3} />
                                                        </div>
                                                        <span className="text-emerald-900 font-medium text-sm">{benefit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
                                            <ul className="space-y-4">
                                                {selectedLens.tradeoffs.map((con, i) => (
                                                    <li key={i} className="flex gap-3 items-start">
                                                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <AlertCircle size={14} className="text-orange-600" strokeWidth={3} />
                                                        </div>
                                                        <span className="text-orange-900 font-medium text-sm">{con}</span>
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
                                            <h3 className="text-lg font-bold text-slate-900">About the Toric Option</h3>
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded tracking-wide">
                                                Astigmatism Correction
                                            </span>
                                        </div>
                                        <p className="text-blue-900 leading-relaxed">
                                            {selectedLens.toricInfo}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default IOLModal;
