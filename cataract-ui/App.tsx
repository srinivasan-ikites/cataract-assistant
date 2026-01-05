



import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Cube3D from './components/Cube3D';
import DetailModal from './components/DetailModal';
import FAQOverlay from './components/FAQOverlay';
import ThemeSwitcher from './components/ThemeSwitcher';
import PatientSidebar from './components/PatientSidebar';
import { ModuleItem } from './types';
import { ThemeProvider, useTheme } from './theme';
import { Patient, Clinic, api } from './services/api';
import DoctorPortal from './doctor/DoctorPortal';

// The 9 main modules as requested
// We define a helper to get modules dynamically based on patient data
const getModules = (patient: Patient | null): ModuleItem[] => {
  // Extract dynamic fields or fallbacks
  const diagnosis =
    patient?.clinical_context?.diagnosis?.pathology ||
    patient?.clinical_context?.diagnosis?.type ||
    'Cataract Type';
  const selectedLens = patient?.surgical_recommendations_by_doctor?.recommended_lens_options?.find(opt => opt.is_selected_preference)?.name || 'Selected Lens';
  const surgeryDate = patient?.surgical_recommendations_by_doctor?.decision_date || 'Upcoming';
  const packageOption = selectedLens; // Using selected lens as the package/option name for now

  return [
    // Row 1: Learn
    {
      id: '1',
      title: 'My Diagnosis',
      iconName: 'type',
      shortDescription: diagnosis // e.g. "Nuclear Sclerosis"
    },
    {
      id: '2',
      title: 'What is Cataract Surgery?',
      iconName: 'surgery',
      shortDescription: 'Lens Replacement Procedure'
    },
    {
      id: '3',
      title: 'What is an IOL?',
      iconName: 'iol',
      shortDescription: 'Artificial Lens Implant'
    },

    // Row 2: Decide & Prepare
    {
      id: '4',
      title: 'My IOL Options',
      iconName: 'options',
      shortDescription: selectedLens // e.g. "Monofocal Toric"
    },
    {
      id: '5',
      title: 'Risks & Complications',
      iconName: 'risk',
      shortDescription: 'Standard Medical Risks'
    },
    {
      id: '6',
      title: 'Before Surgery',
      iconName: 'preop',
      shortDescription: `Date: ${surgeryDate}`
    },

    // Row 3: Act & Recover
    {
      id: '7',
      title: 'Day of Surgery',
      iconName: 'day',
      shortDescription: 'Duration: ~15-20 Mins'
    },
    {
      id: '8',
      title: 'After Surgery',
      iconName: 'postop',
      shortDescription: 'Drops & Recovery Timeline'
    },
    {
      id: '9',
      title: 'Costs & Insurance',
      iconName: 'forms',
      shortDescription: `Status: ${packageOption} Selected`
    },
  ];
};

const AppContent: React.FC = () => {
  const [view, setView] = useState<'patient' | 'doctor'>('patient');
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentTheme, classes } = useTheme();

  // Simple Hash Routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/doctor') || hash === '#doctor') {
        setView('doctor');
      } else {
        setView('patient');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Check on initial load

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Generate modules based on loaded patient data
  const modules = getModules(currentPatient);

  // Auto-load the single patient on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const patients = await api.getPatients();
        if (!patients || patients.length === 0) {
          throw new Error('No patients available');
        }
        const first = patients[0];
        const full = await api.getPatientDetails(first.patient_id);

        // Fire-and-forget pre-generation if module_content missing/empty
        if (!full.module_content || Object.keys(full.module_content).length === 0) {
          api.pregenerateModules(first.patient_id).catch((err) =>
            console.error('Failed to pre-generate modules', err)
          );
        }

        // Load clinic (for footer / clinic-specific UI)
        const clinicId = (full as any).clinic_id;
        let clinic: Clinic | null = null;
        if (clinicId) {
          try {
            clinic = await api.getClinicDetails(clinicId);
          } catch (e) {
            console.warn('Failed to load clinic', e);
          }
        }

        if (!cancelled) {
          setCurrentPatient(full);
          setCurrentClinic(clinic);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load patient');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (view === 'doctor') {
    return <DoctorPortal />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium">Loading patient…</p>
        </div>
      </div>
    );
  }

  if (error || !currentPatient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-md text-center space-y-4 max-w-md">
          <h2 className="text-xl font-bold text-slate-800">Unable to load patient</h2>
          <p className="text-slate-600">{error || 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Helper to get soft background gradient colors based on theme
  // UPDATED: Removed heavy transparency so colors pop more
  const getThemeBlobs = () => {
    switch (currentTheme.id) {
      case 'magenta': return 'from-pink-300 via-rose-200 to-pink-100';
      case 'lavender': return 'from-violet-300 via-purple-200 to-indigo-100';
      case 'turquoise': return 'from-cyan-300 via-teal-200 to-emerald-100';
      case 'gradient': return 'from-cyan-300 via-violet-200 to-fuchsia-100';
      default: return 'from-blue-300 via-indigo-200 to-sky-100';
    }
  };

  // Helper for text gradient
  const getTextGradient = () => {
    switch (currentTheme.id) {
      case 'magenta': return 'from-pink-600 to-rose-600';
      case 'lavender': return 'from-violet-600 to-purple-600';
      case 'turquoise': return 'from-cyan-600 to-teal-600';
      case 'gradient': return 'from-cyan-500 to-violet-600';
      default: return 'from-blue-600 to-indigo-600';
    }
  };

  const blobGradient = getThemeBlobs();
  const textGradient = getTextGradient();

  return (
    <div className={`min-h-screen flex flex-col ${classes.appBackground} transition-colors duration-500 relative overflow-hidden`}>

      {/* CSS for Background Animation */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(50px, -60px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes rise {
          0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
          20% { opacity: 0.4; }
          80% { opacity: 0.2; }
          100% { transform: translateY(-10vh) scale(1.2); opacity: 0; }
        }
        .animate-blob {
          animation: blob 15s infinite alternate ease-in-out;
        }
        .animate-rise {
          animation: rise 20s infinite linear;
        }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animation-delay-6000 { animation-delay: 6s; }
      `}</style>

      {/* --- BACKGROUND LAYER --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Dot Pattern with Vignette Mask */}
        <div className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: 'radial-gradient(#94a3b8 1.5px, transparent 1.5px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
          }}>
        </div>

        {/* Living Ambient Orbs - Increased opacity and blur for stronger effect */}
        <div className={`absolute top-0 left-0 w-full h-full overflow-hidden`}>
          {/* Top Left Orb */}
          <div className={`absolute top-[-20%] left-[-10%] w-[900px] h-[900px] bg-gradient-to-br ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob`}></div>

          {/* Top Right Orb */}
          <div className={`absolute top-[-10%] right-[-20%] w-[800px] h-[800px] bg-gradient-to-bl ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob animation-delay-2000`}></div>

          {/* Bottom Center Orb */}
          <div className={`absolute -bottom-64 left-[15%] w-[1000px] h-[1000px] bg-gradient-to-t ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob animation-delay-4000`}></div>
        </div>

        {/* Rising Particles / Bokeh Effect */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`absolute rounded-full bg-gradient-to-b ${blobGradient} mix-blend-overlay filter blur-xl opacity-30 animate-rise`}
              style={{
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 100 + 50}px`,
                height: `${Math.random() * 100 + 50}px`,
                animationDelay: `${Math.random() * -20}s`,
                animationDuration: `${Math.random() * 15 + 15}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* --- MAIN CONTENT LAYER --- */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          onProfileClick={() => setIsSidebarOpen(true)}
          patientName={`${currentPatient.name.first} ${currentPatient.name.last}`}
          patientId={currentPatient.patient_id}
          patientDob={currentPatient.dob}
        />

        <main className="flex-grow flex flex-col items-center pt-12 pb-16 px-4 md:px-6">
          <div className="w-full max-w-6xl flex flex-col items-center">

            {/* Hero / Title Section */}
            <div className="w-full text-center mb-14 md:mb-16 px-3 md:px-8 animate-[fadeIn_0.8s_ease-out]">
              {/* <div className="inline-flex items-center gap-2 text-xs md:text-sm font-semibold tracking-[0.18em] text-slate-600 uppercase mb-3 bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Patient Education Portal
              </div> */}

              <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-5 tracking-tight leading-tight drop-shadow-sm">
                Your Journey to <br />
                <span className={`bg-clip-text text-transparent bg-gradient-to-r ${textGradient} pb-1`}>
                  Clearer Vision
                </span>
              </h2>

              <p className="text-slate-700 font-medium text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                Explore the interactive guide below to understand every step of your cataract surgery with confidence. Learn, prepare, and ask questions tailored to your care plan.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="px-5 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Ask a question
                </button>
                <button
                  onClick={() => {
                    if (modules.length) setSelectedModule(modules[0]);
                  }}
                  className="px-5 py-3 rounded-full bg-white/70 text-slate-800 text-sm font-semibold border border-slate-200 shadow hover:border-slate-300 transition-all"
                >
                  View my modules
                </button>
              </div>
            </div>

            {/* The 3x3 Cube Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12 md:gap-x-16 md:gap-y-16 pb-10 w-full">
              {modules.map((mod) => (
                <Cube3D
                  key={mod.id}
                  item={mod}
                  onClick={setSelectedModule}
                />
              ))}
            </div>
          </div>
        </main>

        <Footer patient={currentPatient} clinic={currentClinic} />
      </div>

      {/* Modals & Overlays */}
      <DetailModal
        item={selectedModule}
        patient={currentPatient}
        onClose={() => setSelectedModule(null)}
        onOpenChat={(question) => {
          setChatInitialQuestion(question);
          setIsChatOpen(true);
        }}
      />

      <PatientSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        patient={currentPatient}
      />

      <FAQOverlay
        patient={currentPatient}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpen={() => setIsChatOpen(true)}
        initialQuestion={chatInitialQuestion}
        onClearInitialQuestion={() => setChatInitialQuestion(undefined)}
      />
      <ThemeSwitcher />
    </div>
  );
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;