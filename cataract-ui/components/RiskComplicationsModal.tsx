import React, { useState, Fragment } from 'react';
import {
    X,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Info,
    Zap,
    ChevronDown,
    MessageCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../theme';
import { Patient } from '../services/api';

interface RiskComplicationsModalProps {
    patient: Patient | null;
    onClose: () => void;
    moduleContent?: any;
    onOpenChat?: (question: string) => void;
}

// Risk categories with their items extracted from Dr. Gitanjali's consent forms
// Simplified to two main categories per Dr. Gitanjali's feedback
const riskCategories = [
    {
        id: 'common',
        title: 'Common & Expected',
        description: 'These are normal experiences that typically resolve on their own',
        icon: CheckCircle2,
        color: 'emerald',
        items: [
            {
                name: 'Mild Discomfort',
                description: 'Cataract surgery is usually quite comfortable. Mild discomfort for the first 24 hours is typical and normal.',
                note: 'Severe pain is extremely unusual and should be reported immediately to your surgeon.'
            },
            {
                name: 'Posterior Capsular Opacification (PCO)',
                description: 'Clouding of the lens capsule that surrounds the implant. This usually occurs weeks to months after surgery and can cause decreased vision.',
                note: 'Easily correctable by a painless laser procedure (YAG capsulotomy) that does not require hospitalization.'
            },
            {
                name: 'Surface Bleeding (Subconjunctival Hemorrhage)',
                description: 'Bleeding on the surface of the eye that appears as a red patch. This is common and looks worse than it is.',
                note: 'This absorbs on its own within 1-2 weeks and does not affect your vision or healing.'
            }
        ]
    },
    {
        id: 'complications',
        title: 'Less Common Complications',
        description: 'These complications can occur but are typically manageable with proper treatment',
        icon: AlertTriangle,
        color: 'amber',
        items: [
            {
                name: 'Infection',
                description: 'If serious, this can lead to loss of vision or loss of the eye.',
                note: 'Prevented by using prescribed antibiotic drops and following post-op instructions carefully.'
            },
            {
                name: 'Bleeding (Intraocular)',
                description: 'Bleeding inside the eye during or after surgery. This is rare.',
                note: 'Usually resolves on its own or with treatment.'
            },
            {
                name: 'Increased Intraocular Pressure / Glaucoma',
                description: 'This may require medical or surgical treatment. If left uncontrolled, it can lead to loss of vision.',
                note: 'Monitored during follow-up visits and treated promptly if detected.'
            },
            {
                name: 'Swelling of the Retina (Cystoid Macular Edema)',
                description: 'This condition may limit your vision and require treatment.',
                note: 'Patients with diabetic retinopathy are at higher risk.'
            },
            {
                name: 'Corneal Edema',
                description: 'Clouding of the normally clear outer layer of the eye. This cloudy appearance is common in the first few days after surgery and usually resolves with time.',
                note: 'In some cases, a corneal transplant may be needed if it persists.'
            },
            {
                name: 'Corneal Abrasion (Scratch)',
                description: 'The cornea could be scratched during the procedure.',
                note: 'This could result in temporary discomfort and blurred vision but typically heals within a few days.'
            },
            {
                name: 'Drooping Eyelid (Ptosis)',
                description: 'Drooping of the eyelid after surgery.',
                note: 'May require surgical correction if it persists.'
            },
            {
                name: 'Double Vision',
                description: 'Seeing two images of a single object.',
                note: 'Usually temporary and resolves as the eye heals.'
            },
            {
                name: 'Retinal Detachment',
                description: 'This can be repaired surgically but carries a risk of loss of vision or blindness.',
                note: 'Patients who are very nearsighted (myopic) are at higher risk. Report flashes of light, new floaters, or a curtain in your vision immediately.'
            },
            {
                name: 'Rupture of the Capsule',
                description: 'If the capsule that holds the lens ruptures, an additional procedure to remove the gel-like material (vitreous) may be required.',
                note: 'This may delay placement of the lens implant.'
            },
            {
                name: 'Capsule Tear',
                description: 'The capsule (sack) containing the cataract might tear, allowing pieces of the cataract to move into the back of the eye.',
                note: 'You may need another surgery called a vitrectomy to remove the cataract pieces.'
            },
            {
                name: 'Dislocation of Lens Fragments',
                description: 'Lens fragments can dislocate to the back of the eye if the capsule is ruptured.',
                note: 'Additional surgery by a retina surgeon will be required to remove these fragments.'
            },
            {
                name: 'Retained Lens Material',
                description: 'Small pieces of the cataract may remain in the eye.',
                note: 'May require additional procedures to remove.'
            },
            {
                name: 'Anesthesia Complications',
                description: 'Complications associated with local anesthesia injections around the eye include perforation of the eye, injury to the optic nerve, and interference with blood circulation.',
                note: 'These complications are rare because most cataract surgeries use topical (drop) anesthesia rather than injections.'
            },
            {
                name: 'Night Glare, Halos, and Ghost Images',
                description: 'You may experience increased night glare, halos around lights, or double/ghost images.',
                note: 'Multifocal IOLs may increase the likelihood of these visual effects. Consider how this might affect night driving.'
            },
            {
                name: 'Decentration of IOL',
                description: 'If the IOL shifts from its ideal position, it can increase symptoms of glare and ghost images and decrease visual acuity.',
                note: 'Usually correctable with glasses, or in some cases, IOL repositioning surgery.'
            },
            {
                name: 'IOL Power Calculation Variability',
                description: 'While the method used to calculate IOL power is very accurate, the final result may differ from what was planned.',
                note: 'Patients who have had LASIK or other refractive surgeries are especially difficult to measure precisely.'
            },
            {
                name: 'Anisometropia',
                description: 'Since surgery is done on one eye at a time, you may be left with a difference in refractive power between your two eyes temporarily.',
                note: 'If significant, a temporary contact lens may be fitted until the second eye surgery is performed.'
            }
        ]
    }
];

// Laser-specific risks (shown only if patient is a laser candidate)
const laserRisks = {
    id: 'laser',
    title: 'Laser-Assisted Surgery Risks',
    description: 'Additional considerations for femtosecond laser-assisted cataract surgery',
    icon: Zap,
    color: 'blue',
    items: [
        {
            name: 'Incomplete or Off-Center Cuts',
            description: 'The laser cuts into the cornea and cataract might be off-center, incomplete, or broken up.',
            note: 'If this happens, the laser can be used again or the surgeon will use a blade to complete the procedure.'
        },
        {
            name: 'Prior Refractive Surgery Risk',
            description: 'There may be more risk if you have had prior LASIK, PRK, or other refractive surgeries. The laser suction could open up the old flap or wound.',
            note: 'The use of FS laser on patients who have had refractive surgery is considered "off-label" by the FDA.'
        }
    ]
};

// Hardcoded FAQs for Risks & Complications
const riskFaqs = [
    {
        question: "How common are serious complications from cataract surgery?",
        answer: "Cataract surgery is one of the safest and most commonly performed surgeries. Serious complications are rare, occurring in less than 1-2% of cases. The vast majority of patients experience successful outcomes with improved vision."
    },
    {
        question: "What should I do if I experience severe pain after surgery?",
        answer: "Mild discomfort is normal for the first 24 hours after surgery. However, if you experience severe pain that is not improving with over-the-counter pain relievers like Advil or Tylenol, contact your surgeon immediately as this could indicate a complication that needs prompt attention."
    },
    {
        question: "Will I definitely need glasses after cataract surgery?",
        answer: "This depends on the type of IOL (intraocular lens) you choose. With a standard monofocal lens, you will likely need glasses for reading or computer work. Premium IOLs like multifocal or EDOF lenses can reduce dependence on glasses, but some patients may still need them for certain activities."
    },
    {
        question: "What is posterior capsular opacification (PCO) and is it serious?",
        answer: "PCO, sometimes called a 'secondary cataract,' occurs when the capsule behind the IOL becomes cloudy weeks to months after surgery. It's not serious and is easily treated with a quick, painless laser procedure called YAG capsulotomy, which takes only a few minutes and is done in the office."
    },
    {
        question: "Am I at higher risk for complications if I have diabetes?",
        answer: "Patients with diabetes, especially those with diabetic retinopathy, may have a slightly higher risk of certain complications like swelling of the retina (cystoid macular edema). However, with proper monitoring and care, most diabetic patients have successful outcomes. Your surgeon will take extra precautions if needed."
    },
    {
        question: "What are the warning signs I should watch for after surgery?",
        answer: "Contact your doctor immediately if you experience: significant pain not relieved by over-the-counter medication, sudden decrease in vision, flashes of light, new floaters, a curtain or shadow in your vision, increasing redness, or discharge from the eye. These could indicate complications that need prompt treatment."
    }
];

const colorClasses = {
    emerald: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        iconBg: 'bg-emerald-500',
        iconText: 'text-white',
        titleText: 'text-emerald-900',
        descText: 'text-emerald-700',
        itemBg: 'bg-white',
        itemBorder: 'border-emerald-100',
        noteBg: 'bg-emerald-50',
        noteText: 'text-emerald-700'
    },
    amber: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        iconBg: 'bg-amber-500',
        iconText: 'text-white',
        titleText: 'text-amber-900',
        descText: 'text-amber-700',
        itemBg: 'bg-white',
        itemBorder: 'border-amber-100',
        noteBg: 'bg-amber-50',
        noteText: 'text-amber-700'
    },
    blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-500',
        iconText: 'text-white',
        titleText: 'text-blue-900',
        descText: 'text-blue-700',
        itemBg: 'bg-white',
        itemBorder: 'border-blue-100',
        noteBg: 'bg-blue-50',
        noteText: 'text-blue-700'
    }
};

const RiskComplicationsModal: React.FC<RiskComplicationsModalProps> = ({
    patient,
    onClose,
    moduleContent,
    onOpenChat
}) => {
    const { classes } = useTheme();
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['common', 'complications']);

    // Check if patient is eligible for laser surgery
    const candidacyOD = patient?.surgical_plan?.candidacy_profile?.od_right;
    const candidacyOS = patient?.surgical_plan?.candidacy_profile?.os_left;
    const isLaserCandidate =
        candidacyOD?.is_candidate_multifocal === true ||
        candidacyOS?.is_candidate_multifocal === true;

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const sanitizeQuestion = (q: string) => q.replace(/[#*`]/g, '').trim();

    // Combine risk categories with laser risks if applicable
    const allCategories = isLaserCandidate
        ? [...riskCategories, laserRisks]
        : riskCategories;

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
                    <h1 className="text-2xl font-bold mb-1 text-white">Risks & Complications</h1>
                    <p className="text-base text-white/80">Understanding potential outcomes of cataract surgery</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8 space-y-8 bg-slate-50">
                    {/* Important Notice */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
                            <Info size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900 text-xl mb-2">Important Information</h3>
                            <p className="text-blue-800 text-base leading-relaxed">
                                All operations and procedures carry some risk. While cataract surgery is one of the safest and most commonly performed surgeries,
                                it's important to understand the potential complications. Most patients experience excellent outcomes with minimal issues.
                            </p>
                        </div>
                    </div>

                    {/* Section 1: Risk Categories */}
                    <div className="space-y-6">
                        <h3 className="text-base font-black text-slate-600 uppercase tracking-wider px-1">
                            Potential Risks & Complications
                        </h3>

                        {allCategories.map((category) => {
                            const colors = colorClasses[category.color as keyof typeof colorClasses];
                            const isExpanded = expandedCategories.includes(category.id);
                            const IconComponent = category.icon;

                            return (
                                <div
                                    key={category.id}
                                    className={`rounded-[24px] border-2 ${colors.border} overflow-hidden transition-all duration-300`}
                                >
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className={`w-full ${colors.bg} p-6 flex items-center justify-between gap-4 transition-colors hover:brightness-95`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl ${colors.iconBg} ${colors.iconText} flex items-center justify-center`}>
                                                <IconComponent size={24} />
                                            </div>
                                            <div className="text-left">
                                                <h4 className={`text-xl font-bold ${colors.titleText}`}>{category.title}</h4>
                                                <p className={`text-base ${colors.descText}`}>{category.description}</p>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-full ${colors.bg} transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown size={22} className={colors.titleText} />
                                        </div>
                                    </button>

                                    {/* Category Items */}
                                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="p-6 pt-2 space-y-4">
                                            {category.items.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`${colors.itemBg} rounded-xl p-6 border ${colors.itemBorder} shadow-sm`}
                                                >
                                                    <h5 className="text-lg font-bold text-slate-900 mb-2">{item.name}</h5>
                                                    <p className="text-base text-slate-700 leading-relaxed mb-3">{item.description}</p>
                                                    {item.note && (
                                                        <div className={`${colors.noteBg} rounded-lg p-4 flex gap-3`}>
                                                            <Info size={18} className={`${colors.noteText} flex-shrink-0 mt-0.5`} />
                                                            <p className={`text-base ${colors.noteText}`}>{item.note}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Important Disclaimer */}
                    <div className="bg-slate-800 text-white rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-xl mb-2">Important Disclaimer</h4>
                                <p className="text-slate-300 text-base leading-relaxed">
                                    There is no guarantee that cataract surgery will improve your vision. As a result of the surgery and/or anesthesia,
                                    it is possible that your vision could be made worse. In some cases, complications may occur weeks, months, or even years later.
                                    These complications may result in poor vision, total loss of vision, or even loss of the eye in rare situations.
                                    You may need additional treatment or surgery to treat these complications.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: FAQs */}
                    <div className="space-y-4 pt-4">
                        <h3 className="text-base font-black text-slate-600 uppercase tracking-wider px-1">
                            Frequently Asked Questions
                        </h3>
                        <div className="space-y-3">
                            {riskFaqs.map((faq, index) => {
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

                    {/* Section 3: Chat with Assistant */}
                    <div className={`mt-8 p-10 rounded-[28px] ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-violet-600 mx-auto mb-6 shadow-sm">
                            <MessageCircle size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                            Still have questions?
                        </h3>
                        <p className="text-slate-600 mb-6 text-lg font-medium leading-relaxed max-w-md mx-auto">
                            Our AI assistant can explain risks and complications in more detail based on your specific situation.
                        </p>
                        <button
                            onClick={() =>
                                onOpenChat?.(
                                    sanitizeQuestion(moduleContent?.botStarterPrompt || "Tell me more about the risks of cataract surgery")
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

export default RiskComplicationsModal;
