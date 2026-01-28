import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Cube3D from './components/Cube3D';
import DetailModal from './components/DetailModal';
import FAQOverlay from './components/FAQOverlay';
import ThemeSwitcher from './components/ThemeSwitcher';
import { ModuleItem } from './types';
import { ThemeProvider, useTheme } from './theme';
import { Patient, Clinic, api } from './services/api';
import DoctorPortal from './doctor/DoctorPortal';
import PatientLogin from './patient/PatientLogin';
import LoginPage from './doctor/LoginPage';
import ClinicRegistration from './doctor/ClinicRegistration';
import AdminDashboard from './doctor/AdminDashboard';
import { ToastProvider } from './components/Toast';
import Loader, { LoaderStyles } from './components/Loader';
import { patientAuthStorage, patientAuthApi } from './services/api';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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
      shortDescription: 'Pre-op checklist & arrival time'
    },

    // Row 3: Act & Recover
    {
      id: '7',
      title: 'Day of Surgery',
      iconName: 'day',
      shortDescription: 'Timeline & what to expect'
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

// =============================================================================
// LANDING PAGE - Shows when user visits root URL
// =============================================================================
const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200 mb-6">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Cataract Surgery Education
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Empowering patients with personalized education for their cataract surgery journey.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/patient/VIC-MCLEAN-001')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Patient Portal
          </button>
          <button
            onClick={() => navigate('/doctor/VIC-MCLEAN-001')}
            className="px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 shadow hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            Doctor Portal
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-slate-800 text-white font-semibold rounded-xl shadow hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            Admin Portal
          </button>
        </div>

        <p className="text-sm text-slate-400 mt-8">
          Demo mode: Using McLean Eye Clinic (VIC-MCLEAN-001)
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// DOCTOR LOGIN ROUTE - Dedicated login page at /doctor/login
// =============================================================================
const DoctorLoginRouteContent: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showRegistration, setShowRegistration] = useState(false);

  // After successful login, redirect to user's clinic or admin
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[DoctorLoginRoute] User authenticated:', user.name, '| Role:', user.role, '| Clinic:', user.clinic_id);

      if (user.role === 'super_admin') {
        console.log('[DoctorLoginRoute] Redirecting super_admin to /admin');
        navigate('/admin', { replace: true });
      } else if (user.clinic_id) {
        console.log('[DoctorLoginRoute] Redirecting to /doctor/' + user.clinic_id);
        navigate(`/doctor/${user.clinic_id}`, { replace: true });
      } else {
        console.log('[DoctorLoginRoute] No clinic_id, staying on login');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader size="xl" variant="medical" message="Loading..." subMessage="Please wait" />
      </div>
    );
  }

  // If already authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader size="xl" variant="medical" message="Redirecting..." subMessage="Please wait" />
      </div>
    );
  }

  // Show registration form
  if (showRegistration) {
    return <ClinicRegistration onBack={() => setShowRegistration(false)} />;
  }

  // Show login page with registration callback
  return <LoginPage onRegister={() => setShowRegistration(true)} />;
};

const DoctorLoginRoute: React.FC = () => {
  return (
    <AuthProvider>
      <DoctorLoginRouteContent />
    </AuthProvider>
  );
};

// =============================================================================
// DOCTOR ROUTE WRAPPER - Clinic dashboard at /doctor/:clinicId
// =============================================================================
const DoctorRouteContent: React.FC<{ clinicId: string }> = ({ clinicId }) => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log('[DoctorRoute] clinicId from URL:', clinicId, '| isAuthenticated:', isAuthenticated, '| user clinic:', user?.clinic_id);

  // Redirect logic after auth check completes
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Not authenticated - redirect to login
      console.log('[DoctorRoute] Not authenticated, redirecting to /doctor/login');
      navigate('/doctor/login', { replace: true });
      return;
    }

    // Authenticated - check role and clinic
    if (user?.role === 'super_admin') {
      console.log('[DoctorRoute] Super admin detected, redirecting to /admin');
      navigate('/admin', { replace: true });
      return;
    }

    // Regular user - check if URL clinic matches user's clinic
    if (user?.clinic_id && user.clinic_id !== clinicId) {
      console.log('[DoctorRoute] Clinic mismatch. URL:', clinicId, '| User:', user.clinic_id);
      console.log('[DoctorRoute] Redirecting to /doctor/' + user.clinic_id);
      navigate(`/doctor/${user.clinic_id}`, { replace: true });
      return;
    }
  }, [isLoading, isAuthenticated, user, clinicId, navigate]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader size="xl" variant="medical" message="Loading..." subMessage="Please wait" />
      </div>
    );
  }

  // Not authenticated - show loading while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader size="xl" variant="medical" message="Redirecting to login..." subMessage="Please wait" />
      </div>
    );
  }

  // Super admin - show loading while redirecting
  if (user?.role === 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader size="xl" variant="medical" message="Redirecting to admin..." subMessage="Please wait" />
      </div>
    );
  }

  // Clinic mismatch - show loading while redirecting
  if (user?.clinic_id && user.clinic_id !== clinicId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader size="xl" variant="medical" message="Redirecting to your clinic..." subMessage="Please wait" />
      </div>
    );
  }

  // All checks passed - show the doctor portal
  return <DoctorPortal clinicId={clinicId} />;
};

const DoctorRoute: React.FC = () => {
  const { clinicId } = useParams<{ clinicId: string }>();

  if (!clinicId) {
    return <Navigate to="/doctor/login" replace />;
  }

  return (
    <AuthProvider>
      <DoctorRouteContent clinicId={clinicId} />
    </AuthProvider>
  );
};

// =============================================================================
// PATIENT LOGIN ROUTE - Dedicated login page at /patient/:clinicId/login
// =============================================================================
const PatientLoginRoute: React.FC = () => {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();

  const [clinicName, setClinicName] = useState<string>('');
  const [clinicLoading, setClinicLoading] = useState(true);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Redirect if no clinicId
  useEffect(() => {
    if (!clinicId) {
      navigate('/', { replace: true });
    }
  }, [clinicId, navigate]);

  // Load clinic info
  useEffect(() => {
    if (!clinicId) return;

    const loadClinic = async () => {
      try {
        setClinicLoading(true);
        const clinic = await api.getClinicDetails(clinicId);
        setClinicName(clinic.clinic_profile?.name || clinicId);
        setClinicError(null);
      } catch (err: any) {
        console.error('[PatientLoginRoute] Failed to load clinic:', err);
        setClinicError('Clinic not found');
      } finally {
        setClinicLoading(false);
      }
    };
    loadClinic();
  }, [clinicId]);

  // Check if already authenticated - redirect to portal
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      try {
        if (patientAuthStorage.isAuthenticated()) {
          const profile = await patientAuthApi.getProfile();
          if (profile && profile.clinic_id === clinicId) {
            // Already authenticated for this clinic - redirect to portal
            console.log('[PatientLoginRoute] Already authenticated, redirecting to portal');
            navigate(`/patient/${clinicId}`, { replace: true });
            return;
          } else if (profile) {
            // Authenticated for different clinic - clear and show login
            patientAuthStorage.clearAuth();
          }
        }
      } catch (err) {
        console.error('[PatientLoginRoute] Auth check error:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [clinicId, navigate]);

  // Handle successful login - navigate to portal
  const handleLoginSuccess = () => {
    console.log('[PatientLoginRoute] Login successful, navigating to portal');
    navigate(`/patient/${clinicId}`, { replace: true });
  };

  // Loading clinic info
  if (clinicLoading || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message={isCheckingAuth ? "Checking authentication" : "Loading clinic"}
          subMessage="Please wait..."
        />
      </div>
    );
  }

  // Clinic not found
  if (clinicError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-rose-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Clinic Not Found</h2>
          <p className="text-slate-600">
            The clinic <span className="font-mono bg-slate-100 px-2 py-1 rounded">{clinicId}</span> was not found.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Show login page
  return (
    <PatientLogin
      clinicId={clinicId!}
      clinicName={clinicName}
      onLoginSuccess={handleLoginSuccess}
    />
  );
};

// =============================================================================
// PATIENT ROUTE WRAPPER - Education portal at /patient/:clinicId (requires auth)
// =============================================================================
const PatientRoute: React.FC = () => {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();

  const [clinicLoading, setClinicLoading] = useState(true);
  const [clinicError, setClinicError] = useState<string | null>(null);

  // Patient authentication state
  const [patientAuth, setPatientAuth] = useState<{
    isChecking: boolean;
    isAuthenticated: boolean;
    patientId: string | null;
    patientClinicId: string | null;
  }>({
    isChecking: true,
    isAuthenticated: false,
    patientId: null,
    patientClinicId: null,
  });

  // Patient data state
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { currentTheme, classes } = useTheme();

  // Redirect if no clinicId
  useEffect(() => {
    if (!clinicId) {
      navigate('/', { replace: true });
    }
  }, [clinicId, navigate]);

  // Load clinic info
  useEffect(() => {
    if (!clinicId) return;

    const loadClinic = async () => {
      try {
        setClinicLoading(true);
        await api.getClinicDetails(clinicId);
        setClinicError(null);
      } catch (err: any) {
        console.error('[PatientRoute] Failed to load clinic:', err);
        setClinicError('Clinic not found');
      } finally {
        setClinicLoading(false);
      }
    };
    loadClinic();
  }, [clinicId]);

  // Check patient auth on mount
  useEffect(() => {
    checkPatientAuth();
  }, [clinicId]);

  const checkPatientAuth = async () => {
    setPatientAuth(prev => ({ ...prev, isChecking: true }));
    try {
      if (patientAuthStorage.isAuthenticated()) {
        const profile = await patientAuthApi.getProfile();
        if (profile) {
          // Verify patient belongs to this clinic
          if (profile.clinic_id === clinicId) {
            setPatientAuth({
              isChecking: false,
              isAuthenticated: true,
              patientId: profile.patient_id,
              patientClinicId: profile.clinic_id,
            });
            return;
          } else {
            // Patient is logged into a different clinic - clear and redirect to login
            patientAuthStorage.clearAuth();
          }
        }
      }
      // Not authenticated - redirect to login page
      setPatientAuth({
        isChecking: false,
        isAuthenticated: false,
        patientId: null,
        patientClinicId: null,
      });
    } catch (err) {
      console.error('[PatientRoute] Auth check error:', err);
      setPatientAuth({
        isChecking: false,
        isAuthenticated: false,
        patientId: null,
        patientClinicId: null,
      });
    }
  };

  const handlePatientLogout = async () => {
    await patientAuthApi.logout();
    // Redirect to login page after logout
    navigate(`/patient/${clinicId}/login`, { replace: true });
  };

  // Load patient data when authenticated
  useEffect(() => {
    let cancelled = false;

    const loadPatientData = async () => {
      if (patientAuth.isChecking || !patientAuth.isAuthenticated || !patientAuth.patientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Use patient auth API to get data (not clinic user auth)
        const full = await patientAuthApi.getMyData();
        if (!full) {
          throw new Error('Failed to load patient data');
        }

        // Fire-and-forget pre-generation if module_content missing/empty
        if (!full.module_content || Object.keys(full.module_content).length === 0) {
          api.pregenerateModules(patientAuth.patientId).catch((err) =>
            console.error('Failed to pre-generate modules', err)
          );
        }

        // Load clinic
        const patientClinicId = (full as any).clinic_id;
        let clinic: Clinic | null = null;
        if (patientClinicId) {
          try {
            clinic = await api.getClinicDetails(patientClinicId);
          } catch (e) {
            console.warn('Failed to load clinic', e);
          }
        }

        if (!cancelled) {
          setCurrentPatient(full);
          setCurrentClinic(clinic);
          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load patient');
          setLoading(false);
        }
      }
    };

    loadPatientData();
    return () => { cancelled = true; };
  }, [patientAuth.isChecking, patientAuth.isAuthenticated, patientAuth.patientId]);

  // Generate modules based on loaded patient data
  const modules = getModules(currentPatient);

  // Loading clinic info
  if (clinicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Loading clinic"
          subMessage="Please wait..."
        />
      </div>
    );
  }

  // Clinic not found
  if (clinicError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-rose-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Clinic Not Found</h2>
          <p className="text-slate-600">
            The clinic <span className="font-mono bg-slate-100 px-2 py-1 rounded">{clinicId}</span> was not found.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Checking auth
  if (patientAuth.isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Checking authentication"
          subMessage="Please wait..."
        />
      </div>
    );
  }

  // Not authenticated - redirect to login page
  if (!patientAuth.isAuthenticated) {
    console.log('[PatientRoute] Not authenticated, redirecting to login');
    return <Navigate to={`/patient/${clinicId}/login`} replace />;
  }

  // Loading patient data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Loading your personalized content"
          subMessage={`Welcome back, ${patientAuthStorage.getPatient()?.name?.first || 'Patient'}!`}
        />
      </div>
    );
  }

  // Error loading patient
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

  // Authenticated - show education portal
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

        {/* Living Ambient Orbs */}
        <div className={`absolute top-0 left-0 w-full h-full overflow-hidden`}>
          <div className={`absolute top-[-20%] left-[-10%] w-[900px] h-[900px] bg-gradient-to-br ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob`}></div>
          <div className={`absolute top-[-10%] right-[-20%] w-[800px] h-[800px] bg-gradient-to-bl ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob animation-delay-2000`}></div>
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
          onLogout={handlePatientLogout}
        />

        <main className="flex-grow flex flex-col items-center pt-12 pb-16 px-4 md:px-6">
          <div className="w-full max-w-6xl flex flex-col items-center">

            {/* Hero / Title Section */}
            <div className="w-full text-center mb-14 md:mb-16 px-3 md:px-8 animate-[fadeIn_0.8s_ease-out]">
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
};

// =============================================================================
// ADMIN ROUTE - With proper authentication
// =============================================================================

const AdminRouteContent: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      console.log('[AdminRoute] Not authenticated, redirecting to /doctor/login');
      navigate('/doctor/login', { replace: true });
      return;
    }

    if (user?.role !== 'super_admin') {
      console.log('[AdminRoute] Not super_admin, redirecting to /doctor/' + user?.clinic_id);
      if (user?.clinic_id) {
        navigate(`/doctor/${user.clinic_id}`, { replace: true });
      } else {
        navigate('/doctor/login', { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Loading..."
          subMessage="Please wait"
        />
      </div>
    );
  }

  // Not authenticated - show loading while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Redirecting to login..."
          subMessage="Please wait"
        />
      </div>
    );
  }

  // Not a super_admin - show loading while redirecting
  if (user?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Redirecting to your clinic..."
          subMessage="Please wait"
        />
      </div>
    );
  }

  // Authenticated super_admin - show admin dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-slate-900">Cataract Counsellor</h1>
            <p className="text-xs text-slate-500">Super Admin Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-blue-600 font-medium">Super Admin</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Sign Out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>
      {/* Admin Content */}
      <main className="p-8 max-w-7xl mx-auto">
        <AdminDashboard />
      </main>
    </div>
  );
};

const AdminRoute: React.FC = () => {
  return (
    <AuthProvider>
      <AdminRouteContent />
    </AuthProvider>
  );
};

// =============================================================================
// DEMO ROUTE - Shows education portal without auth (for testing)
// =============================================================================
const DemoRoute: React.FC = () => {
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentClinic, setCurrentClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { currentTheme, classes } = useTheme();

  // Load first patient for demo
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

        // Load clinic
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
    return () => { cancelled = true; };
  }, []);

  const modules = getModules(currentPatient);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Loading demo patient"
          subMessage="Preparing education portal"
        />
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

  const getThemeBlobs = () => {
    switch (currentTheme.id) {
      case 'magenta': return 'from-pink-300 via-rose-200 to-pink-100';
      case 'lavender': return 'from-violet-300 via-purple-200 to-indigo-100';
      case 'turquoise': return 'from-cyan-300 via-teal-200 to-emerald-100';
      case 'gradient': return 'from-cyan-300 via-violet-200 to-fuchsia-100';
      default: return 'from-blue-300 via-indigo-200 to-sky-100';
    }
  };

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
        .animate-blob { animation: blob 15s infinite alternate ease-in-out; }
        .animate-rise { animation: rise 20s infinite linear; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>

      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage: 'radial-gradient(#94a3b8 1.5px, transparent 1.5px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
          }}>
        </div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className={`absolute top-[-20%] left-[-10%] w-[900px] h-[900px] bg-gradient-to-br ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob`}></div>
          <div className={`absolute top-[-10%] right-[-20%] w-[800px] h-[800px] bg-gradient-to-bl ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob animation-delay-2000`}></div>
          <div className={`absolute -bottom-64 left-[15%] w-[1000px] h-[1000px] bg-gradient-to-t ${blobGradient} rounded-full mix-blend-multiply filter blur-[120px] opacity-70 animate-blob animation-delay-4000`}></div>
        </div>
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

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          onProfileClick={() => setIsSidebarOpen(true)}
          patientName={`${currentPatient.name.first} ${currentPatient.name.last}`}
          patientId={currentPatient.patient_id}
          patientDob={currentPatient.dob}
        />

        <main className="flex-grow flex flex-col items-center pt-12 pb-16 px-4 md:px-6">
          <div className="w-full max-w-6xl flex flex-col items-center">
            <div className="w-full text-center mb-14 md:mb-16 px-3 md:px-8 animate-[fadeIn_0.8s_ease-out]">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-700 uppercase mb-3 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Demo Mode - No Authentication
              </div>
              <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-5 tracking-tight leading-tight drop-shadow-sm">
                Your Journey to <br />
                <span className={`bg-clip-text text-transparent bg-gradient-to-r ${textGradient} pb-1`}>
                  Clearer Vision
                </span>
              </h2>
              <p className="text-slate-700 font-medium text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                Explore the interactive guide below to understand every step of your cataract surgery with confidence.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button onClick={() => setIsChatOpen(true)} className="px-5 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                  Ask a question
                </button>
                <button onClick={() => { if (modules.length) setSelectedModule(modules[0]); }} className="px-5 py-3 rounded-full bg-white/70 text-slate-800 text-sm font-semibold border border-slate-200 shadow hover:border-slate-300 transition-all">
                  View my modules
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12 md:gap-x-16 md:gap-y-16 pb-10 w-full">
              {modules.map((mod) => (
                <Cube3D key={mod.id} item={mod} onClick={setSelectedModule} />
              ))}
            </div>
          </div>
        </main>

        <Footer patient={currentPatient} clinic={currentClinic} />
      </div>

      <DetailModal
        item={selectedModule}
        patient={currentPatient}
        onClose={() => setSelectedModule(null)}
        onOpenChat={(question) => {
          setChatInitialQuestion(question);
          setIsChatOpen(true);
        }}
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
};

// =============================================================================
// MAIN APP WITH ROUTER
// =============================================================================
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            {/* Landing page */}
            <Route path="/" element={<LandingPage />} />

            {/* Demo mode - no auth required */}
            <Route path="/demo" element={<DemoRoute />} />

            {/* Doctor login page */}
            <Route path="/doctor/login" element={<DoctorLoginRoute />} />

            {/* Doctor portal - clinic specific (must be after /doctor/login) */}
            <Route path="/doctor/:clinicId" element={<DoctorRoute />} />

            {/* Patient login page - clinic specific */}
            <Route path="/patient/:clinicId/login" element={<PatientLoginRoute />} />

            {/* Patient portal - clinic specific (redirects to login if not authenticated) */}
            <Route path="/patient/:clinicId" element={<PatientRoute />} />

            {/* Super admin portal */}
            <Route path="/admin" element={<AdminRoute />} />

            {/* Catch-all redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
