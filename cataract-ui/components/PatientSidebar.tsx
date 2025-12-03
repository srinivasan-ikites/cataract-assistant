import React from 'react';
import { X, User, CheckCircle2, Circle, Clock, AlertCircle, Eye, FileText, ArrowRight } from 'lucide-react';
import { useTheme } from '../theme';

interface PatientSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const PatientSidebar: React.FC<PatientSidebarProps> = ({ isOpen, onClose }) => {
    const { classes } = useTheme();

    // Hardcoded Patient Data
    const patient = {
        name: "Jane Doe",
        dob: "Jan 15, 1954",
        id: "MRN-882401",
        img: "https://i.pravatar.cc/150?u=jane_doe_cataract"
    };

    const history = [
        "Glare & Halos at night",
        "Difficulty reading fine print",
        "Mild Astigmatism (Left Eye)",
        "Previous LASIK (2005)"
    ];

    const progressSteps = [
        { label: 'Registration', status: 'completed', date: 'Oct 10' },
        { label: 'Consultation', status: 'completed', date: 'Oct 12' },
        { label: 'Counseling', status: 'current', date: 'Now' },
        { label: 'Pre-Op Assessment', status: 'pending', date: 'Oct 25' },
        { label: 'Surgery Day', status: 'pending', date: 'Nov 01' },
    ];

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-[140] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div className={`fixed top-0 left-0 h-full w-[340px] md:w-[380px] bg-white z-[150] shadow-2xl transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

                {/* Header Section */}
                <div className={`p-6 ${classes.headerBg} flex justify-between items-start border-b border-slate-100 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 pointer-events-none"></div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="relative group">
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
                                {/* Placeholder Avatar */}
                                <div className={`w-full h-full ${classes.headerIconContainer} flex items-center justify-center bg-slate-200`}>
                                    <User size={32} className="opacity-50" />
                                </div>
                            </div>
                            <div className={`absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm`}></div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{patient.name}</h2>
                            <p className="text-xs font-mono text-slate-500 mb-1">ID: {patient.id}</p>
                            <span className="inline-block px-2 py-0.5 rounded-full bg-white/50 border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                Verified Patient
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors text-slate-500 relative z-10">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8 pb-20">

                    {/* Surgery Progress Tracker */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <Clock size={14} /> Care Pathway
                        </h3>
                        <div className="relative pl-3">
                            {/* Vertical Connector Line */}
                            <div className="absolute top-3 bottom-6 left-[15px] w-0.5 bg-slate-100"></div>

                            <div className="space-y-6 relative">
                                {progressSteps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-4 group">
                                        {/* Status Dot */}
                                        <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-[3px] border-white shadow-sm transition-transform duration-300 group-hover:scale-110 ${step.status === 'completed' ? 'bg-emerald-500 text-white' :
                                            step.status === 'current' ? `${classes.fabBg} text-white` : 'bg-slate-200 text-slate-400'
                                            }`}>
                                            {step.status === 'completed' ? <CheckCircle2 size={14} /> : <Circle size={10} fill={step.status === 'current' ? "currentColor" : "none"} />}
                                        </div>

                                        {/* Text Content */}
                                        <div className={`${step.status === 'pending' ? 'opacity-60' : 'opacity-100'}`}>
                                            <p className={`text-sm font-bold ${step.status === 'current' ? 'text-slate-900' : 'text-slate-700'}`}>
                                                {step.label}
                                            </p>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">{step.date}</p>

                                            {step.status === 'current' && (
                                                <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase ${classes.primaryText} bg-slate-50 px-2 py-1 rounded-md border border-slate-100`}>
                                                    <span className="relative flex h-2 w-2">
                                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${classes.fabBg}`}></span>
                                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${classes.fabBg}`}></span>
                                                    </span>
                                                    Active Stage
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-px w-full bg-slate-100"></div>

                    {/* Patient History / Issues */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText size={14} /> Medical Notes
                        </h3>
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-slate-200 transition-colors">
                            <ul className="space-y-3">
                                {history.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600 leading-snug">
                                        <AlertCircle size={16} className={`flex-shrink-0 mt-0.5 ${classes.primaryText}`} />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="h-px w-full bg-slate-100"></div>

                    {/* Recommended Lens Card */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Eye size={14} /> Surgeon Recommendation
                        </h3>
                        <div className={`rounded-2xl overflow-hidden border border-slate-200 shadow-sm group cursor-pointer transition-all duration-300 hover:shadow-md bg-white`}>
                            <div className="relative h-36 bg-slate-900 overflow-hidden">
                                {/* Abstract Lens Background */}
                                <div className={`absolute inset-0 opacity-80 bg-gradient-to-br ${classes.chatHeader}`}></div>

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center relative animate-[spin_10s_linear_infinite]">
                                        <div className="w-16 h-16 rounded-full border border-white/50"></div>
                                        <div className="absolute top-0 w-full h-px bg-white/30"></div>
                                        <div className="absolute left-1/2 h-full w-px bg-white/30"></div>
                                    </div>
                                    <Eye size={32} className="text-white absolute z-10 drop-shadow-lg" />
                                </div>

                                <div className={`absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${classes.primaryText} shadow-sm`}>
                                    Premium IOL
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800 text-lg">PanOptix® Trifocal</h4>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                    First and only trifocal lens available in the US. Delivers an exceptional combination of near, intermediate, and distance vision.
                                </p>
                                <button className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200 hover:bg-slate-50 transition-colors ${classes.primaryText} flex items-center justify-center gap-2`}>
                                    View Lens Details <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

export default PatientSidebar;