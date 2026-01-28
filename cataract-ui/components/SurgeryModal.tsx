import React, { useState, Fragment } from 'react';
import { X, Check, Info, ShieldCheck, Zap, AlertCircle, ArrowRight, Loader2, Clock, MapPin, ClipboardCheck, Droplets, Activity, Coffee, Eye, ScanEye, Shield, Phone, MessageCircle, BriefcaseMedical, Armchair, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Patient } from '../services/api';
import { useTheme } from '../theme';

interface SurgeryModalProps {
    patient: Patient | null;
    onClose: () => void;
    isDayOfSurgery?: boolean;
    moduleContent?: any;
    onOpenChat: (msg?: string) => void;
    isLoading?: boolean;
}

// Skeleton content component for Surgery Modal
const SurgerySkeletonContent: React.FC = () => (
    <div className="flex-1 overflow-y-auto p-8 space-y-12 bg-slate-50 animate-pulse">
        {/* Intro Section Skeleton */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="h-9 bg-slate-200 rounded w-3/4" />
                        <div className="space-y-2">
                            <div className="h-5 bg-slate-100 rounded w-full" />
                            <div className="h-5 bg-slate-100 rounded w-5/6" />
                            <div className="h-5 bg-slate-100 rounded w-4/5" />
                        </div>
                    </div>
                </div>
                <div className="aspect-video w-full rounded-xl bg-slate-200" />
            </div>
        </section>

        {/* Divider Skeleton */}
        <div className="flex items-center justify-center">
            <div className="h-5 bg-slate-200 rounded w-64" />
        </div>

        {/* Traditional Surgery Card Skeleton */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                    <div>
                        <div className="h-8 bg-slate-200 rounded w-56 mb-4" />
                        <div className="space-y-2">
                            <div className="h-5 bg-slate-100 rounded w-full" />
                            <div className="h-5 bg-slate-100 rounded w-5/6" />
                            <div className="h-5 bg-slate-100 rounded w-4/5" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="h-4 bg-slate-200 rounded w-32" />
                        <div className="flex items-center gap-4">
                            <div className="w-7 h-7 rounded-full bg-slate-200" />
                            <div className="h-5 bg-slate-100 rounded w-48" />
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-7 h-7 rounded-full bg-slate-200" />
                            <div className="h-5 bg-slate-100 rounded w-40" />
                        </div>
                    </div>
                </div>
                <div className="aspect-video w-full rounded-2xl bg-slate-200" />
            </div>
        </section>

        {/* Laser Surgery Card Skeleton */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="bg-slate-100 rounded-xl p-5 mb-8 h-20" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                    <div className="space-y-2">
                        <div className="h-5 bg-slate-100 rounded w-full" />
                        <div className="h-5 bg-slate-100 rounded w-5/6" />
                        <div className="h-5 bg-slate-100 rounded w-4/5" />
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-7 h-7 rounded-full bg-slate-200" />
                                <div className="h-5 bg-slate-100 rounded w-56" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="aspect-video w-full rounded-2xl bg-slate-200" />
                    <div className="bg-orange-50 rounded-xl p-4 h-20" />
                </div>
            </div>
        </section>

        {/* FAQ Skeleton */}
        <div className="space-y-6 pt-10 border-t border-slate-100">
            <div className="h-5 bg-slate-200 rounded w-56 mx-auto" />
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
        <div className="p-6 rounded-[28px] bg-slate-50 border border-slate-200 text-center max-w-2xl mx-auto">
            <div className="h-5 bg-slate-200 rounded w-40 mx-auto mb-2" />
            <div className="h-4 bg-slate-100 rounded w-64 mx-auto mb-4" />
            <div className="h-12 bg-violet-200 rounded-full w-48 mx-auto" />
        </div>
    </div>
);

// Hardcoded FAQs for "What is Cataract Surgery" module - mandatory questions from Dr. Gitanjali
const surgeryFaqs = [
    {
        question: "What is the difference between traditional and laser assisted cataract surgery?",
        answer: "The main difference is how the incisions are made. In **traditional surgery**, the surgeon uses a handheld blade to create precise incisions. In **laser-assisted surgery**, a computer-controlled laser creates these incisions with a high degree of precision. Both methods then use ultrasound to break up and remove the cataract, and both involve placing an intraocular lens (IOL) implant."
    },
    {
        question: "Does insurance cover laser assisted surgery?",
        answer: "No. Laser-assisted cataract surgery is considered a premium upgrade and is **not covered by standard insurance**. You will have an out-of-pocket cost for the laser portion of the procedure. See the 'Costs & Insurance' section for more details."
    },
    {
        question: "What kind of anesthesia will I receive?",
        answer: "You will receive **local anesthesia** (numbing drops for the eye) and **IV sedation**. An IV will be inserted into your arm where an anesthesiologist will inject mild sedatives to help you stay calm and pain-free during the procedure. You will be **semi-awake during surgery** but will feel no pain."
    },
    {
        question: "How long does the surgery take?",
        answer: "The actual surgery typically takes about **15-30 minutes** per eye. However, you should plan to be at the surgery center for 2-3 hours to allow time for check-in, preparation, and recovery."
    }
];

// Hardcoded FAQs for "Day of Surgery" module
const dayOfSurgeryFaqs = [
    {
        question: "Will I be awake during surgery? What will I see?",
        answer: "Yes, you will be **awake but sedated** — relaxed and comfortable. You won't feel pain due to numbing drops. During the procedure, you may see bright lights, colors, or moving shapes, but everything will be blurry. Some patients describe it as looking through a kaleidoscope. You won't see the surgical instruments or anything alarming."
    },
    {
        question: "What if I accidentally move my eye or need to cough/sneeze during surgery?",
        answer: "Don't worry — this is a common concern! Your surgeon is highly trained to handle small movements. The surgical microscope tracks your eye, and brief pauses can be made if needed. If you feel a sneeze or cough coming, try to signal your surgeon by squeezing their hand or making a sound. **A small movement won't ruin your surgery.**"
    },
    {
        question: "How long will the entire process take from arrival to going home?",
        answer: "Plan to be at the surgery center for **2-3 hours total**. This includes: check-in and paperwork (15-20 min), pre-op preparation and eye drops (45-60 min), the actual surgery (15-30 min), and recovery observation (30-45 min). The surgery itself is quick — most of your time is spent preparing and recovering."
    },
    {
        question: "Why do my pupils need to be dilated? How long will they stay dilated?",
        answer: "Dilating your pupils allows the surgeon to see inside your eye clearly and provides room to work. Your pupils may remain dilated for **up to 24-72 hours** after surgery. During this time, you'll be sensitive to light and have blurry near vision. Bring sunglasses and avoid driving until dilation wears off."
    }
];

const VideoPlayer = ({ src, title }: { src: string, title: string }) => {
    const [isLoading, setIsLoading] = React.useState(true);
    return (
        <div className="relative w-full h-full bg-slate-900">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
                </div>
            )}
            <iframe
                width="100%"
                height="100%"
                src={src}
                title={title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={`w-full h-full object-cover transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoading(false)}
            ></iframe>
        </div>
    );
};

const DayOfSurgeryView = ({
    patient,
    onClose,
    moduleContent,
    onOpenChat,
    openFaqIndex,
    setOpenFaqIndex
}: {
    patient: Patient | null,
    onClose: () => void,
    moduleContent: any,
    onOpenChat: (msg?: string) => void,
    openFaqIndex: number | null,
    setOpenFaqIndex: (idx: number | null) => void
}) => {
    const { classes } = useTheme();
    const arrivalTime = patient?.surgical_recommendations_by_doctor?.scheduling?.arrival_time || "7:30 AM";
    const doctorName = patient?.surgical_recommendations_by_doctor?.doctor_ref_id || "Dr. Sarah Chen, MD";
    const patientId = patient?.patient_id || "839210";

    const sanitizeQuestion = (q?: string) =>
        (q || '')
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/`+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    return (
        <div className="flex-1 flex flex-col bg-slate-50 min-h-0 overflow-hidden">
            {/* Top Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-8 pb-4">
                {/* Arrival Time Card */}
                <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                        <Clock size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-black text-slate-700 uppercase tracking-widest mb-0.5">ARRIVAL TIME</div>
                        <div className="text-3xl font-black text-slate-900 leading-tight">{arrivalTime}</div>
                    </div>
                </div>

                {/* Location Card */}
                <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-black text-slate-700 uppercase tracking-widest mb-0.5">LOCATION</div>
                        <div className="text-xl font-black text-slate-900 leading-tight tracking-tight">Eye Surgery Center</div>
                        <div className="text-base font-medium text-slate-700">Suite 200 • Main Entrance</div>
                    </div>
                </div>
            </div>

            {/* Main Content Areas */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                    {/* Left Column: What to Expect */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={18} className="text-violet-600" />
                            <h2 className="text-lg font-bold text-slate-900">What to Expect</h2>
                        </div>

                        <div className="relative space-y-6 py-2">
                            {/* Timeline Connector */}
                            <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-200"></div>

                            {/* Step 1: Check-in & Registration */}
                            <div className="relative pl-14">
                                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-violet-600 border-4 border-white shadow-md flex items-center justify-center text-white z-10">
                                    <ClipboardCheck size={20} />
                                </div>
                                <h3 className="text-base font-black text-slate-900 leading-tight mb-2">Check-in & Registration</h3>
                                <ul className="text-sm font-medium text-slate-700 space-y-1.5">
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Complete paperwork and verify your information</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Step 2: Preparation */}
                            <div className="relative pl-14">
                                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-2 border-violet-200 shadow-sm flex items-center justify-center text-violet-500 z-10">
                                    <Droplets size={20} />
                                </div>
                                <h3 className="text-base font-black text-slate-900 leading-tight mb-2">Preparation</h3>
                                <ul className="text-sm font-medium text-slate-700 space-y-1.5">
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>You will be taken to the preoperative area where a nurse will administer drops</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Your pupils may remain dilated for up to three days</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>You will meet your anesthesia team and surgeon</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Step 3: Anesthesia */}
                            <div className="relative pl-14">
                                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-2 border-violet-200 shadow-sm flex items-center justify-center text-violet-500 z-10">
                                    <Activity size={20} />
                                </div>
                                <h3 className="text-base font-black text-slate-900 leading-tight mb-2">Anesthesia</h3>
                                <p className="text-sm font-medium text-slate-700 mb-2">
                                    You will receive an IV <span className="text-slate-600">(a small catheter placed in your arm to deliver fluids and medication)</span>
                                </p>
                                <ul className="text-sm font-medium text-slate-700 space-y-1.5">
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Mild sedation to help you relax</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>You will be partially awake, but feel no pain</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Administered through an IV</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Step 4: Procedure */}
                            <div className="relative pl-14">
                                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center text-slate-400 z-10">
                                    <BriefcaseMedical size={20} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 leading-tight mb-2">Procedure</h3>
                                <ul className="text-sm font-medium text-slate-700 space-y-1.5">
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Approximately 30 minutes</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Step 5: Recovery */}
                            <div className="relative pl-14">
                                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center text-slate-400 z-10">
                                    <Armchair size={20} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 leading-tight mb-2">Recovery</h3>
                                <ul className="text-sm font-medium text-slate-700 space-y-1.5">
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Rest in post-op area while effects wear off</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Protective patch placed on your eye</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>IV removed and discharge paperwork completed</span>
                                    </li>
                                    <li className="flex items-baseline gap-2">
                                        <span className="text-violet-500 text-xs">•</span>
                                        <span>Someone must drive you home</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: What is Normal? */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Check size={18} className="p-0.5 bg-violet-600 text-white rounded-full" />
                            <h2 className="text-lg font-bold text-slate-900">What is Normal?</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Blurry Vision */}
                            <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                    <Eye size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-base">Blurry Vision</h4>
                                    <p className="text-sm font-medium text-slate-700">Improving by tomorrow</p>
                                </div>
                            </div>

                            {/* Large Pupils */}
                            <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center">
                                    <ScanEye size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-base">Large Pupils</h4>
                                    <p className="text-sm font-medium text-slate-700">May last up to 3 days</p>
                                </div>
                            </div>

                            {/* Scratchy Feeling */}
                            <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                                    <AlertCircle size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-base">Scratchy Feeling</h4>
                                    <p className="text-sm font-medium text-slate-700">Like an eyelash is stuck</p>
                                </div>
                            </div>

                            {/* The Patch */}
                            <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm space-y-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-base">The Patch</h4>
                                    <p className="text-sm font-medium text-slate-700">Keep on until follow-up</p>
                                </div>
                            </div>
                        </div>

                        {/* Assistance Banner */}
                        <div className="bg-violet-50 p-4 rounded-3xl border border-violet-100 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
                                <Info size={20} />
                            </div>
                            <p className="text-sm font-bold text-slate-800 leading-tight">
                                Need immediate assistance?<br />
                                <span className="text-slate-700 font-medium">Call the surgery center helpline at</span> <span className="text-violet-700 font-black">555-0123</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* FAQ Section - Always render with hardcoded FAQs */}
                <div className="space-y-6 pt-10 border-t border-slate-100 mt-10">
                    <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider text-center">Frequently Asked Questions</h3>
                    <div className="space-y-3">
                        {dayOfSurgeryFaqs.map((faq, index) => {
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

                {/* Bot CTA Section */}
                <div className={`mt-8 p-6 rounded-[28px] ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                    <h3 className={`text-lg font-semibold ${classes.primaryText} mb-2`}>
                        Still have questions?
                    </h3>
                    <p className="text-slate-600 mb-4 text-sm">
                        Our AI assistant can explain your surgery day roadmap in more detail based on your personal medical records.
                    </p>
                    <button
                        onClick={() =>
                            onOpenChat(
                                sanitizeQuestion(moduleContent?.botStarterPrompt) ||
                                "Tell me more about what to expect on the day of my surgery"
                            )
                        }
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${classes.fabBg} text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
                    >
                        <MessageCircle size={20} />
                        Chat with Assistant
                    </button>
                </div>
            </div>

            {/* Footer */}
            {/* <div className="px-8 py-4 border-t border-slate-200 bg-white/50 text-center">
                <p className="text-sm font-black text-slate-600 uppercase tracking-widest">
                    Patient ID: #{patientId} • {doctorName}
                </p>
            </div> */}
        </div>
    );
};

const SurgeryModal: React.FC<SurgeryModalProps> = ({ patient, onClose, isDayOfSurgery = false, moduleContent, onOpenChat, isLoading = false }) => {
    const { classes } = useTheme();
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    // Check laser eligibility based on candidacy profile
    // Patient is eligible for laser if they are a candidate for multifocal or EDOF in either eye
    const candidacyOD = patient?.surgical_plan?.candidacy_profile?.od_right;
    const candidacyOS = patient?.surgical_plan?.candidacy_profile?.os_left;
    const isEligibleForLaser =
        candidacyOD?.is_candidate_multifocal === true ||
        candidacyOS?.is_candidate_multifocal === true;
        // candidacyOD?.is_candidate_edof === true ||
        // candidacyOS?.is_candidate_edof === true;

    const sanitizeQuestion = (q?: string) =>
        (q || '')
            .replace(/\*\*/g, '')
            .replace(/__/g, '')
            .replace(/`+/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className={`relative w-full max-w-6xl max-h-[96vh] bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[scaleIn_0.2s_ease-out]`}>
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
                        {isDayOfSurgery ? 'Day of Surgery' : 'What is Cataract Surgery?'}
                    </h1>
                    <p className="text-base text-white/80">
                        {isDayOfSurgery ? 'Your step-by-step guide for surgery day' : 'Understanding your procedure options'}
                    </p>
                </div>

                {/* Content Area - shows skeleton or actual content */}
                {isLoading ? (
                    <SurgerySkeletonContent />
                ) : isDayOfSurgery ? (
                    <DayOfSurgeryView
                        patient={patient}
                        onClose={onClose}
                        moduleContent={moduleContent}
                        onOpenChat={onOpenChat}
                        openFaqIndex={openFaqIndex}
                        setOpenFaqIndex={setOpenFaqIndex}
                    />
                ) : (
                    /* Content Area - Scrollable (Original View) */
                    <div className="flex-1 overflow-y-auto p-8 space-y-12 bg-slate-50" style={{ scrollbarGutter: 'stable' }}>

                        {/* 1. INTRO SECTION */}
                        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                                <div className="space-y-6">
                                    {/* {patient?.name && (
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
                                            <ShieldCheck size={16} className="fill-blue-200" />
                                            Personalized for {patient.name.first}
                                        </div>
                                    )} */}

                                    <div className="space-y-4">
                                        <h2 className="text-3xl font-bold text-slate-900">
                                            Restoring Your Clear Vision
                                        </h2>
                                        <p className="text-slate-700 leading-relaxed text-lg">
                                            Cataract surgery is a safe, routine procedure to remove the cloudy lens from your eye and replace it with a clear, artificial lens.
                                            This will help clear up the blurriness caused by your <strong className="text-violet-600">cataracts</strong> and improve your vision significantly.
                                        </p>
                                    </div>
                                </div>

                                <div className="relative group">
                                    {/* <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl opacity-20 blur group-hover:opacity-40 transition duration-1000"></div> */}
                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden shadow-2xl bg-black">
                                        <VideoPlayer
                                            src="https://www.youtube.com/embed/LIza4BiEoOk?modestbranding=1&rel=0&iv_load_policy=3&color=white"
                                            title="Cataract Surgery Introduction"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 text-center italic mt-4">
                                            Video courtesy of American Academy of Ophthalmology
                                        </p>
                                </div>
                            </div>
                        </section>

                        {/* DIVIDER */}
                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <span className="relative z-10 bg-slate-50 px-6 text-base font-bold text-slate-500 uppercase tracking-widest">
                                Two Ways To Perform Surgery
                            </span>
                        </div>

                        {/* 2. TRADITIONAL SURGERY CARD */}
                        <section className="bg-white rounded-3xl p-1 shadow-lg shadow-slate-200/50 border border-slate-100">
                            <div className="p-8 md:p-10">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                                    <div className="space-y-8">
                                        <div>
                                            <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                                                Traditional Surgery
                                            </h2>
                                            <p className="text-slate-700 leading-relaxed text-lg">
                                                The standard method where the surgeon uses a handheld blade to create precise incisions.
                                                An ultrasound device is then used to break up and remove the cataract (your cloudy lens).
                                                After all lens fragments are removed, your surgeon carefully inserts a clear lens implant
                                                called an IOL (intraocular lens).
                                            </p>
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Key Features</h3>
                                            <ul className="space-y-4">
                                                <li className="flex items-start gap-4">
                                                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Check size={16} className="text-emerald-600" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-slate-700 font-medium text-base">Performed manually by your surgeon</span>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Check size={16} className="text-emerald-600" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-slate-700 font-medium text-base">Standard recovery timeline</span>
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="inline-flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                                            <div className="bg-green-500 rounded-full p-1">
                                                <Check size={12} className="text-white" strokeWidth={4} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Coverage Status</div>
                                                <div className="text-sm font-bold text-slate-900">Covered by most standard insurance plans</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-xl bg-black relative">
                                            <VideoPlayer
                                                src="https://www.youtube.com/embed/4xJivTGL7eA?modestbranding=1&rel=0&iv_load_policy=3&color=white"
                                                title="Phacoemulsification Cataract Surgery"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 text-center italic">
                                            Video courtesy of American Academy of Ophthalmology
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 3. LASER SURGERY CARD (Premium Look) */}
                        <section className={`rounded-3xl p-1 shadow-xl border-2 ${isEligibleForLaser ? 'bg-violet-50/30 border-violet-100 shadow-violet-100/50' : 'bg-white border-slate-100'}`}>
                            <div className="p-8 md:p-10">
                                {/* Intro / Eligibility Header */}
                                <div className="mb-8">
                                    {isEligibleForLaser ? (
                                        <div className="bg-green-50 border border-green-100 rounded-xl p-5 flex items-start gap-4 mb-8">
                                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                                <Check size={20} className="text-green-600" strokeWidth={3} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-green-800 text-base mb-1">You are eligible for Laser-Assisted Surgery</h4>
                                                <p className="text-green-700 text-base">Based on your corneal thickness and cataract density.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 flex items-start gap-4 mb-8">
                                            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                                                <Info size={20} className="text-rose-600" strokeWidth={3} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-rose-800 text-base mb-1">Not Recommended</h4>
                                                <p className="text-rose-700 text-base">
                                                    Due to your specific eye health, traditional surgery is the recommended approach for optimal outcomes.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 mb-2">
                                        <h2 className="text-3xl font-bold text-slate-900">Laser-Assisted Surgery</h2>
                                        <span className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-bold uppercase tracking-wide">
                                            Advanced
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                                    <div className="space-y-8">
                                        <p className="text-slate-700 leading-relaxed text-lg">
                                            A bladeless, computer-controlled laser creates precise incisions. This advanced method offers a higher degree of precision for astigmatism correction and lens placement.
                                            After these incisions are created by the laser, your surgeon will still use an ultrasound device to break up and remove the cataract (your cloudy lens).
                                            Subsequently, a clear lens implant called an IOL (intraocular lens) is carefully inserted.
                                        </p>

                                        <div>
                                            <h3 className="text-sm font-bold text-violet-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                                <Zap size={16} className="fill-current" />
                                                Key Benefits
                                            </h3>
                                            <ul className="space-y-4">
                                                <li className="flex items-start gap-4">
                                                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Check size={16} className="text-violet-600" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-slate-700 font-medium text-base">Enhanced precision for astigmatism correction</span>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Check size={16} className="text-violet-600" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-slate-700 font-medium text-base">Potentially faster recovery time</span>
                                                </li>
                                                <li className="flex items-start gap-4">
                                                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <Check size={16} className="text-violet-600" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-slate-700 font-medium text-base">Less ultrasound energy used on the eye</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-xl bg-black relative group">
                                            <VideoPlayer
                                                src="https://www.youtube.com/embed/8zVKol3nKNo?modestbranding=1&rel=0&iv_load_policy=3&color=white"
                                                title="Femtosecond Laser-Assisted Cataract Surgery"
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 text-center italic">
                                            Video courtesy of American Academy of Ophthalmology
                                        </p>

                                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 flex gap-4">
                                            <AlertCircle className="text-orange-500 flex-shrink-0" size={22} />
                                            <p className="text-sm text-orange-800 leading-relaxed font-medium">
                                                <strong className="block text-orange-900 mb-1">Note:</strong>
                                                This is an advanced feature not covered by insurance. See 'Costs & Insurance' for details.
                                            </p>
                                        </div>

                                        {/* <button className="w-full py-3 bg-violet-50 text-violet-700 font-bold rounded-xl hover:bg-violet-100 transition-colors flex items-center justify-center gap-2">
                                            View Cost & Insurance Details
                                            <ArrowRight size={16} />
                                        </button> */}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* FAQ Section - Always render with hardcoded FAQs */}
                        <div className="space-y-6 pt-10 border-t border-slate-100">
                            <h3 className="text-base font-bold text-slate-600 uppercase tracking-wider text-center">Frequently Asked Questions</h3>
                            <div className="space-y-3">
                                {surgeryFaqs.map((faq, index) => {
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
                                                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                                    }`}
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

                        {/* Bot CTA Section */}
                        <div className={`mt-8 p-6 rounded-[28px] ${classes.surfaceVariant} border border-slate-200 text-center max-w-2xl mx-auto`}>
                            <h3 className={`text-lg font-semibold ${classes.primaryText} mb-2`}>
                                Still have questions?
                            </h3>
                            <p className="text-slate-600 mb-4 text-sm">
                                Our AI assistant can explain cataract procedures in more detail based on your records.
                            </p>
                            <button
                                onClick={() =>
                                    onOpenChat(
                                        sanitizeQuestion(moduleContent?.botStarterPrompt) ||
                                        "Tell me more about cataract surgery options"
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
            </div>
        </div>
    );
};

export default SurgeryModal;
