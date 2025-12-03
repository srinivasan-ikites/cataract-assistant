
// import React, { useState } from 'react';
// import Header from './components/Header';
// import Footer from './components/Footer';
// import Cube3D from './components/Cube3D';
// import DetailModal from './components/DetailModal';
// import FAQOverlay from './components/FAQOverlay';
// import ThemeSwitcher from './components/ThemeSwitcher';
// import PatientSidebar from './components/PatientSidebar';
// import { ModuleItem } from './types';
// import { ThemeProvider, useTheme } from './theme';
// import PatientSelection from './components/PatientSelection';
// import { Patient, api } from './services/api';

// // The 9 main modules as requested
// const MODULES: ModuleItem[] = [
//   { id: '1', title: 'Cataract Type', iconName: 'type', shortDescription: 'Understand the different types of cataracts and which one you might have.' },
//   { id: '2', title: 'What is Cataract Surgery?', iconName: 'surgery', shortDescription: 'Learn how the procedure works to restore your vision.' },
//   { id: '3', title: 'Risks & Complications', iconName: 'risk', shortDescription: 'An honest look at the potential risks involved in the procedure.' },
//   { id: '4', title: 'What is an IOL?', iconName: 'iol', shortDescription: 'Explanation of Intraocular Lenses and their function.' },
//   { id: '5', title: 'My IOL Options', iconName: 'options', shortDescription: 'Explore the premium and standard lens options available to you.' },
//   { id: '6', title: 'Day of Surgery', iconName: 'day', shortDescription: 'A step-by-step guide on what to expect when you arrive.' },
//   { id: '7', title: 'Preoperative Instructions', iconName: 'preop', shortDescription: 'Important steps to take before your surgery date.' },
//   { id: '8', title: 'Postoperative Instructions', iconName: 'postop', shortDescription: 'Care guidelines to ensure a smooth and safe recovery.' },
//   { id: '9', title: 'Forms & Documents', iconName: 'forms', shortDescription: 'Access necessary consent forms and medical history documents.' },
// ];

// const AppContent: React.FC = () => {
//   const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
//   const { currentTheme, classes } = useTheme();

//   // If no patient selected, show selection screen
//   if (!currentPatient) {
//     return <PatientSelection onSelect={(p) => {
//       // Fetch full details (including history) when selected
//       api.getPatientDetails(p.patient_id).then(setCurrentPatient);
//     }} />;
//   }

//   // Helper to get soft background gradient colors based on theme
//   const getThemeBlobs = () => {
//     switch (currentTheme.id) {
//       case 'magenta': return 'from-pink-300/30 to-rose-300/30';
//       case 'lavender': return 'from-violet-300/30 to-purple-300/30';
//       case 'turquoise': return 'from-cyan-300/30 to-teal-300/30';
//       case 'gradient': return 'from-cyan-300/30 to-violet-300/30';
//       default: return 'from-blue-300/30 to-indigo-300/30';
//     }
//   };

//   // Helper for text gradient
//   const getTextGradient = () => {
//     switch (currentTheme.id) {
//       case 'magenta': return 'from-pink-600 to-rose-600';
//       case 'lavender': return 'from-violet-600 to-purple-600';
//       case 'turquoise': return 'from-cyan-600 to-teal-600';
//       case 'gradient': return 'from-cyan-500 to-violet-600';
//       default: return 'from-blue-600 to-indigo-600';
//     }
//   };

//   const blobGradient = getThemeBlobs();
//   const textGradient = getTextGradient();

//   return (
//     <div className={`min-h-screen flex flex-col ${classes.appBackground} transition-colors duration-500 relative overflow-hidden`}>

//       {/* --- BACKGROUND LAYER --- */}
//       <div className="absolute inset-0 z-0 pointer-events-none">
//         {/* Gradient Overlay for depth */}
//         <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 via-white to-violet-50/50"></div>

//         {/* Dot Pattern Overlay */}
//         <div className="absolute inset-0 opacity-[0.25]"
//           style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
//         </div>

//         {/* Dynamic Ambient Orbs (Main lights) */}
//         <div className={`absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br ${blobGradient} rounded-full blur-3xl opacity-50 transition-all duration-1000`}></div>
//         <div className={`absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] bg-gradient-to-tl ${blobGradient} rounded-full blur-3xl opacity-50 transition-all duration-1000`}></div>

//         {/* Vision-themed bokeh circles (lens effect) */}
//         <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl animate-pulse"></div>
//         <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-violet-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
//         <div className="absolute bottom-1/3 left-1/2 w-56 h-56 bg-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
//         <div className="absolute top-2/3 right-1/3 w-40 h-40 bg-cyan-300/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>

//         {/* Radial gradients (mimics clarity/lens focus) */}
//         <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-radial from-cyan-200/20 via-transparent to-transparent rounded-full blur-2xl"></div>
//         <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-gradient-radial from-violet-200/20 via-transparent to-transparent rounded-full blur-2xl"></div>
//       </div>

//       {/* --- MAIN CONTENT LAYER --- */}
//       <div className="relative z-10 flex flex-col min-h-screen">
//         <Header
//           onProfileClick={() => setIsSidebarOpen(true)}
//           patientName={`${currentPatient.name.first} ${currentPatient.name.last}`}
//           patientId={currentPatient.patient_id}
//           patientDob={currentPatient.dob}
//         />

//         <main className="flex-grow flex flex-col items-center py-16 px-4">
//           <div className="max-w-7xl w-full flex flex-col items-center">

//             {/* Hero / Title Section */}
//             <div className="text-center mb-16 max-w-3xl px-6 animate-[fadeIn_0.8s_ease-out]">
//               {/* Badge */}
//               <div className="inline-block mb-5">
//                 <span className="inline-flex items-center gap-2 text-xs md:text-sm font-semibold tracking-[0.15em] uppercase px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-200/40 backdrop-blur-glass">
//                   <svg className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20">
//                     <circle cx="10" cy="10" r="3" className="text-cyan-500" />
//                   </svg>
//                   <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">
//                     Patient Education Portal
//                   </span>
//                 </span>
//               </div>

//               {/* Main Heading */}
//               <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-800 mb-5 tracking-tight leading-tight">
//                 Your Journey to <br className="hidden md:block" />
//                 <span className={`bg-clip-text text-transparent bg-gradient-to-r ${textGradient} inline-block mt-1`}>
//                   Clearer Vision
//                 </span>
//               </h2>

//               {/* Subheading */}
//               <p className="text-slate-600 text-base md:text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto font-normal">
//                 Explore the interactive guide below to understand every step of your cataract surgery procedure with confidence.
//               </p>
//             </div>

//             {/* The 3x3 Cube Grid */}
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12 md:gap-x-24 md:gap-y-20 pb-24">
//               {MODULES.map((mod) => (
//                 <Cube3D
//                   key={mod.id}
//                   item={mod}
//                   onClick={setSelectedModule}
//                 />
//               ))}
//             </div>
//           </div>
//         </main>

//         <Footer />
//       </div>

//       {/* Modals & Overlays */}
//       <DetailModal
//         item={selectedModule}
//         onClose={() => setSelectedModule(null)}
//       />

//       <PatientSidebar
//         isOpen={isSidebarOpen}
//         onClose={() => setIsSidebarOpen(false)}
//         patient={currentPatient}
//       />

//       <FAQOverlay patient={currentPatient} />
//       <ThemeSwitcher />
//     </div>
//   );
// }

// const App: React.FC = () => {
//   return (
//     <ThemeProvider>
//       <AppContent />
//     </ThemeProvider>
//   );
// };

// export default App;



import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Cube3D from './components/Cube3D';
import DetailModal from './components/DetailModal';
import FAQOverlay from './components/FAQOverlay';
import ThemeSwitcher from './components/ThemeSwitcher';
import PatientSidebar from './components/PatientSidebar';
import { ModuleItem } from './types';
import { ThemeProvider, useTheme } from './theme';
import PatientSelection from './components/PatientSelection';
import { Patient, api } from './services/api';

// The 9 main modules as requested
const MODULES: ModuleItem[] = [
  { id: '1', title: 'Cataract Type', iconName: 'type', shortDescription: 'Understand the different types of cataracts and which one you might have.' },
  { id: '2', title: 'What is Cataract Surgery?', iconName: 'surgery', shortDescription: 'Learn how the procedure works to restore your vision.' },
  { id: '3', title: 'Risks & Complications', iconName: 'risk', shortDescription: 'An honest look at the potential risks involved in the procedure.' },
  { id: '4', title: 'What is an IOL?', iconName: 'iol', shortDescription: 'Explanation of Intraocular Lenses and their function.' },
  { id: '5', title: 'My IOL Options', iconName: 'options', shortDescription: 'Explore the premium and standard lens options available to you.' },
  { id: '6', title: 'Day of Surgery', iconName: 'day', shortDescription: 'A step-by-step guide on what to expect when you arrive.' },
  { id: '7', title: 'Preoperative Instructions', iconName: 'preop', shortDescription: 'Important steps to take before your surgery date.' },
  { id: '8', title: 'Postoperative Instructions', iconName: 'postop', shortDescription: 'Care guidelines to ensure a smooth and safe recovery.' },
  { id: '9', title: 'Forms & Documents', iconName: 'forms', shortDescription: 'Access necessary consent forms and medical history documents.' },
];

const AppContent: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const { currentTheme, classes } = useTheme();

  // If no patient selected, show selection screen
  if (!currentPatient) {
    return <PatientSelection onSelect={(p) => {
      // Fetch full details (including history) when selected
      api.getPatientDetails(p.patient_id).then(setCurrentPatient);
    }} />;
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

        <main className="flex-grow flex flex-col items-center py-16 px-4">
          <div className="max-w-7xl w-full flex flex-col items-center">

            {/* Hero / Title Section */}
            <div className="text-center mb-16 max-w-3xl px-6 animate-[fadeIn_0.8s_ease-out]">
              <span className="inline-block text-xs md:text-sm font-bold tracking-[0.2em] text-slate-500 uppercase mb-3 bg-white/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
                Patient Education Portal
              </span>

              <h2 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6 tracking-tight leading-tight drop-shadow-sm">
                Your Journey to <br />
                <span className={`bg-clip-text text-transparent bg-gradient-to-r ${textGradient} pb-2`}>
                  Clearer Vision
                </span>
              </h2>

              <p className="text-slate-700 font-medium text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
                Explore the interactive guide below to understand every step of your cataract surgery procedure with confidence.
              </p>
            </div>

            {/* The 3x3 Cube Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-12 md:gap-x-24 md:gap-y-20 pb-24">
              {MODULES.map((mod) => (
                <Cube3D
                  key={mod.id}
                  item={mod}
                  onClick={setSelectedModule}
                />
              ))}
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Modals & Overlays */}
      <DetailModal
        item={selectedModule}
        onClose={() => setSelectedModule(null)}
      />

      <PatientSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        patient={currentPatient}
      />

      <FAQOverlay patient={currentPatient} />
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