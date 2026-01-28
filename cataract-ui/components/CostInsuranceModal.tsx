import React, { useState, Fragment } from 'react';
import {
    X,
    DollarSign,
    CheckCircle2,
    XCircle,
    Info,
    ChevronDown,
    MessageCircle,
    Shield,
    FileText,
    AlertTriangle,
    CreditCard,
    Building2,
    Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../theme';
import { Patient } from '../services/api';

interface CostInsuranceModalProps {
    patient: Patient | null;
    onClose: () => void;
    moduleContent?: any;
    onOpenChat?: (question: string) => void;
}

// What's typically covered by insurance
const coveredItems = [
    {
        name: 'Standard Cataract Surgery',
        description: 'Traditional phacoemulsification surgery performed by your surgeon using a handheld blade and ultrasound device.',
        icon: CheckCircle2
    },
    {
        name: 'Basic Monofocal IOL',
        description: 'A standard intraocular lens that provides clear vision at one distance (typically set for distance/driving vision).',
        icon: CheckCircle2
    },
    {
        name: 'Pre-operative Testing',
        description: 'Standard measurements and tests required before surgery, including keratometry and biometry.',
        icon: CheckCircle2
    },
    {
        name: 'Post-operative Visits',
        description: 'Follow-up appointments to monitor your healing and recovery after surgery.',
        icon: CheckCircle2
    }
];

// What's NOT covered (out-of-pocket expenses)
const notCoveredItems = [
    {
        name: 'Laser-Assisted Surgery',
        description: 'The femtosecond laser portion of cataract surgery. While it offers enhanced precision, it is considered an upgrade and is not covered by Medicare or private insurance.',
        price: 'Additional fee applies',
        icon: Sparkles
    },
    {
        name: 'Premium IOLs (Multifocal)',
        description: 'Lenses that allow you to see at multiple distances (far, intermediate, and near) without glasses. Requires supplemental consent.',
        price: 'Premium upgrade fee',
        icon: Sparkles
    },
    {
        name: 'Premium IOLs (EDOF)',
        description: 'Extended Depth of Focus lenses that provide a continuous range of vision from distance to intermediate. Requires supplemental consent.',
        price: 'Premium upgrade fee',
        icon: Sparkles
    },
    {
        name: 'Toric IOLs (Astigmatism Correction)',
        description: 'Specialized lenses designed to correct astigmatism. Patients electing Toric lenses will need to read and sign a supplemental consent form.',
        price: 'Premium upgrade fee',
        icon: Sparkles
    },
    {
        name: 'Light Adjustable Lens (LAL)',
        description: 'The only lens that can be customized after surgery using UV light treatments. Requires supplemental consent and multiple follow-up visits.',
        price: 'Premium upgrade fee',
        icon: Sparkles
    },
    {
        name: 'Limbal Relaxing Incision (LRI)',
        description: 'A small cut made in the cornea to reduce astigmatism during surgery. Medicare and private insurance do not cover this procedure.',
        price: 'Additional fee applies',
        icon: Sparkles
    }
];

// Important financial notes
const importantNotes = [
    {
        title: 'Supplemental Consent Required',
        description: 'Patients electing premium IOLs (Multifocal, EDOF, Toric, or LAL) will need to read and sign a supplemental consent form before surgery.',
        icon: FileText,
        color: 'blue'
    },
    {
        title: 'Additional Treatment Costs',
        description: 'If complications occur, you may need additional treatment or surgery. This additional treatment is not included in the original surgical fee.',
        icon: AlertTriangle,
        color: 'amber'
    },
    {
        title: 'No Guarantee of Results',
        description: 'Because of variability in testing and individual healing, there is no guarantee that surgery will meet your exact refractive goals. You may still need glasses after surgery.',
        icon: Info,
        color: 'slate'
    }
];

// FAQs for Cost & Insurance
const costFaqs = [
    {
        question: "What does my insurance typically cover for cataract surgery?",
        answer: "Most insurance plans, including Medicare, cover the basic cataract surgery procedure and a standard monofocal IOL. This includes the surgeon's fee, facility fee, anesthesia, and standard follow-up visits. However, premium upgrades like laser-assisted surgery and advanced IOLs are typically not covered."
    },
    {
        question: "Why aren't premium IOLs covered by insurance?",
        answer: "Insurance companies consider premium IOLs (Multifocal, EDOF, Toric, LAL) as elective upgrades rather than medical necessities. A standard monofocal IOL effectively treats the cataract, so any lens that provides additional benefits like reduced glasses dependence is considered an optional upgrade that patients pay for out-of-pocket."
    },
    {
        question: "What is a Limbal Relaxing Incision (LRI) and why isn't it covered?",
        answer: "An LRI is a small cut the surgeon makes in the cornea to reduce astigmatism during cataract surgery. While it can improve your vision without glasses, Medicare and private insurance consider it an elective procedure to reduce glasses dependence, not a medical necessity, so it is not covered."
    },
    {
        question: "What is a supplemental consent form?",
        answer: "A supplemental consent form is an additional document you must read and sign if you choose a premium IOL or certain procedures like LRI. It explains the specific risks, benefits, and costs associated with that particular option, ensuring you understand what you're choosing beyond the standard surgery."
    },
    {
        question: "Will I have to pay anything if complications occur?",
        answer: "If complications occur that require additional treatment or surgery, those treatments may involve additional costs that are not included in your original surgical fee. Your insurance may cover some of these costs depending on the nature of the complication and your specific plan. It's important to discuss this with your surgical coordinator."
    },
    {
        question: "Can I get an estimate of my out-of-pocket costs before surgery?",
        answer: "Yes, we recommend speaking with our surgical coordinator before your procedure. They can provide a detailed breakdown of costs based on the IOL and surgical options you're considering, as well as verify your insurance coverage and explain any out-of-pocket expenses you may have."
    }
];

const CostInsuranceModal: React.FC<CostInsuranceModalProps> = ({
    patient,
    onClose,
    moduleContent,
    onOpenChat
}) => {
    const { classes } = useTheme();
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    const sanitizeQuestion = (q: string) => q.replace(/[#*`]/g, '').trim();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
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
                    <h1 className="text-2xl font-bold mb-1 text-white">Costs & Insurance</h1>
                    <p className="text-base text-white/80">Understanding your financial options</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">

                    {/* Section 1: What's Covered */}
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                                <Shield size={22} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900">What's Typically Covered by Insurance</h3>
                        </div>

                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-[24px] p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {coveredItems.map((item, idx) => (
                                    <div key={idx} className="bg-white rounded-xl p-5 border border-emerald-100 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-slate-900 mb-1">{item.name}</h4>
                                                <p className="text-base text-slate-600">{item.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 p-4 bg-emerald-100 rounded-xl flex items-center gap-3">
                                <Building2 size={22} className="text-emerald-700 flex-shrink-0" />
                                <p className="text-base font-semibold text-emerald-800">
                                    Most insurance plans, including Medicare, cover these standard services with little to no out-of-pocket cost for the surgery itself.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: What's NOT Covered */}
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center">
                                <CreditCard size={22} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900">Premium Upgrades (Out-of-Pocket)</h3>
                        </div>

                        <div className="bg-violet-50 border-2 border-violet-200 rounded-[24px] p-6">
                            <p className="text-base text-violet-800 font-medium mb-5">
                                The following options are considered elective upgrades and are not covered by Medicare or most private insurance plans:
                            </p>
                            <div className="space-y-4">
                                {notCoveredItems.map((item, idx) => (
                                    <div key={idx} className="bg-white rounded-xl p-5 border border-violet-100 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                                                    <item.icon size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-slate-900 mb-1">{item.name}</h4>
                                                    <p className="text-base text-slate-600">{item.description}</p>
                                                </div>
                                            </div>
                                            <div className="px-4 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm font-bold whitespace-nowrap">
                                                {item.price}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Important Notes */}
                    <div className="space-y-5">
                        <h3 className="text-base font-black text-slate-600 uppercase tracking-wider px-1">
                            Important Financial Information
                        </h3>

                        <div className="grid grid-cols-1 gap-4">
                            {importantNotes.map((note, idx) => {
                                const colorMap = {
                                    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'bg-blue-500', text: 'text-blue-900', desc: 'text-blue-800' },
                                    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-500', text: 'text-amber-900', desc: 'text-amber-800' },
                                    slate: { bg: 'bg-slate-100', border: 'border-slate-200', icon: 'bg-slate-500', text: 'text-slate-900', desc: 'text-slate-700' }
                                };
                                const colors = colorMap[note.color as keyof typeof colorMap];

                                return (
                                    <div key={idx} className={`${colors.bg} border ${colors.border} rounded-2xl p-5 flex items-start gap-4`}>
                                        <div className={`w-10 h-10 rounded-xl ${colors.icon} text-white flex items-center justify-center flex-shrink-0`}>
                                            <note.icon size={22} />
                                        </div>
                                        <div>
                                            <h4 className={`text-lg font-bold ${colors.text} mb-1`}>{note.title}</h4>
                                            <p className={`text-base ${colors.desc}`}>{note.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Contact Surgical Coordinator CTA */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[24px] p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-xl mb-2">Get Your Personalized Cost Estimate</h4>
                                <p className="text-slate-300 text-base leading-relaxed mb-4">
                                    Our surgical coordinator can provide a detailed breakdown of costs based on your specific IOL choice and insurance coverage.
                                    We recommend scheduling a consultation to understand your exact out-of-pocket expenses before making your decision.
                                </p>
                                <p className="text-white font-bold text-lg">
                                    Contact our surgical coordinator for your personalized quote.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: FAQs */}
                    <div className="space-y-4 pt-4">
                        <h3 className="text-base font-black text-slate-600 uppercase tracking-wider px-1">
                            Frequently Asked Questions
                        </h3>
                        <div className="space-y-3">
                            {costFaqs.map((faq, index) => {
                                const isOpen = openFaqIndex === index;
                                return (
                                    <div
                                        key={index}
                                        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen
                                            ? 'bg-blue-50/50 border-blue-100 shadow-sm'
                                            : 'bg-white border-slate-100 hover:border-slate-300'
                                            }`}
                                    >
                                        <button
                                            onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                            className="w-full text-left p-5 flex justify-between items-start gap-4"
                                        >
                                            <div className={`font-semibold text-lg transition-colors ${isOpen ? 'text-blue-800' : 'text-slate-700'}`}>
                                                {faq.question}
                                            </div>
                                            <span className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 ${isOpen
                                                ? 'rotate-180 bg-blue-200 text-blue-700'
                                                : 'bg-slate-50 text-slate-400 shadow-sm'
                                                }`}>
                                                <ChevronDown size={20} />
                                            </span>
                                        </button>

                                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <div className="p-5 pt-0 text-slate-700 leading-relaxed text-base">
                                                <div className="h-px w-full bg-slate-200/60 mb-4"></div>
                                                {faq.answer}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 5: Chat with Assistant */}
                    <div className={`mt-8 p-10 rounded-[28px] ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-violet-600 mx-auto mb-6 shadow-sm">
                            <MessageCircle size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                            Still have questions?
                        </h3>
                        <p className="text-slate-600 mb-6 text-lg font-medium leading-relaxed max-w-md mx-auto">
                            Our AI assistant can help explain costs and insurance coverage based on your specific situation.
                        </p>
                        <button
                            onClick={() =>
                                onOpenChat?.(
                                    sanitizeQuestion(moduleContent?.botStarterPrompt || "Tell me more about the costs and insurance coverage for cataract surgery")
                                )
                            }
                            className={`inline-flex items-center gap-3 px-10 py-5 rounded-2xl ${classes.fabBg} text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all`}
                        >
                            <MessageCircle size={24} />
                            Chat with Assistant
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostInsuranceModal;
