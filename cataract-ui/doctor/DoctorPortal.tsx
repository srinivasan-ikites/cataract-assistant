import React, { useState, useEffect } from 'react';
import {
  Users,
  LogOut,
  Bell,
  Search,
  LayoutDashboard,
  Hospital,
  Scan,
  Upload,
  AlertCircle,
  PanelLeftClose,
  Building2
} from 'lucide-react';
import PatientList from './PatientList';
import PatientOnboarding from './PatientOnboarding';
import ClinicSetup from './ClinicSetup';
import { api, Clinic } from '../services/api';

type View = 'dashboard' | 'onboarding' | 'clinic' | 'patients' | 'appointments';

// Sidebar localStorage key
const SIDEBAR_COLLAPSED_KEY = 'medcore_sidebar_collapsed';

const DoctorPortal: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [clinicId] = useState('VIC-MCLEAN-001'); // Default clinic
  const [patientList, setPatientList] = useState<string[]>([]); // Track patient IDs for navigation
  const [clinicData, setClinicData] = useState<Clinic | null>(null);

  // Sidebar collapsed state - default to true (collapsed/icon-only mode)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored !== null ? JSON.parse(stored) : true; // Default collapsed
  });

  // Fetch clinic data on mount
  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        const data = await api.getClinicDetails(clinicId);
        setClinicData(data);
      } catch (err) {
        console.error('Failed to fetch clinic data:', err);
      }
    };
    fetchClinicData();
  }, [clinicId]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  // Get clinic name with fallback
  const clinicName = clinicData?.clinic_profile?.name || 'MedCore';

  const navigateToOnboarding = (pid: string, allPatients?: string[]) => {
    setSelectedPatientId(pid);
    if (allPatients) {
      setPatientList(allPatients);
    }
    setCurrentView('onboarding');
  };

  // Navigate to previous/next patient
  const handlePatientNavigation = (direction: 'prev' | 'next') => {
    if (!selectedPatientId || patientList.length === 0) return;
    const currentIndex = patientList.indexOf(selectedPatientId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < patientList.length) {
      setSelectedPatientId(patientList[newIndex]);
    }
  };

  // Check if navigation is available
  const currentPatientIndex = selectedPatientId ? patientList.indexOf(selectedPatientId) : -1;
  const hasPrevPatient = currentPatientIndex > 0;
  const hasNextPatient = currentPatientIndex < patientList.length - 1 && currentPatientIndex !== -1;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="space-y-10 animate-[fadeIn_0.5s_ease-out]">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'OCR Reviews Pending', value: '5', icon: <Scan size={24} />, badge: 'High Prio', color: 'text-blue-600', bg: 'bg-blue-50', badgeBg: 'bg-blue-100', badgeText: 'text-blue-600' },
                { label: 'New Uploads', value: '12', icon: <Upload size={24} />, badge: '+2 Today', color: 'text-emerald-600', bg: 'bg-emerald-50', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-600' },
                { label: 'Total Patients', value: '428', icon: <Users size={24} />, color: 'text-purple-600', bg: 'bg-purple-50', badge: null },
                { label: 'Critical Alerts', value: '3', icon: <AlertCircle size={24} />, badge: 'Action Req', color: 'text-rose-600', bg: 'bg-rose-50', badgeBg: 'bg-rose-100', badgeText: 'text-rose-600' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                      {stat.icon}
                    </div>
                    {stat.badge && (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${stat.badgeBg} ${stat.badgeText}`}>
                        {stat.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900 leading-none mb-2">{stat.value}</p>
                    <p className="text-sm font-medium text-slate-500 tracking-tight">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <PatientList onSelectPatient={navigateToOnboarding} clinicId={clinicId} />
          </div>
        );
      case 'onboarding':
        return selectedPatientId ? (
          <PatientOnboarding
            patientId={selectedPatientId}
            clinicId={clinicId}
            onBack={() => setCurrentView('dashboard')}
            onNavigate={handlePatientNavigation}
            hasPrev={hasPrevPatient}
            hasNext={hasNextPatient}
          />
        ) : null;
      case 'clinic':
        return <ClinicSetup clinicId={clinicId} onBack={() => setCurrentView('dashboard')} />;
      case 'patients':
        return <PatientList onSelectPatient={navigateToOnboarding} clinicId={clinicId} />;
      default:
        return <PatientList onSelectPatient={navigateToOnboarding} clinicId={clinicId} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col shrink-0 relative z-30 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Logo Section with Toggle */}
        <div className={`${sidebarCollapsed ? 'p-4' : 'p-6 pb-4'} transition-all duration-300`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-6`}>
            <div
              className={`flex items-center gap-3 ${sidebarCollapsed ? '' : 'px-2'} group cursor-pointer`}
              onClick={() => sidebarCollapsed && toggleSidebar()}
              title={sidebarCollapsed ? 'Expand sidebar' : undefined}
            >
              <div className={`w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100 transition-transform duration-500 group-hover:scale-105 shrink-0 ${sidebarCollapsed ? 'hover:ring-2 hover:ring-blue-300' : ''}`}>
                <Building2 className="text-white" size={20} strokeWidth={2.5} />
              </div>
              <span className={`font-bold text-lg tracking-tight text-blue-900 transition-all duration-300 truncate ${
                sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100 max-w-[140px]'
              }`}>
                {clinicName}
              </span>
            </div>
            {/* Toggle Button - Top Right */}
            {!sidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={18} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
              { id: 'patients', label: 'Patients', icon: <Users size={20} /> },
              { id: 'clinic', label: 'Clinic Data', icon: <Hospital size={20} /> },
            ].map((item) => {
              const isActive = currentView === item.id || (item.id === 'dashboard' && currentView === 'onboarding');
              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => {
                      if (item.id === 'dashboard' || item.id === 'clinic' || item.id === 'patients') {
                        setCurrentView(item.id as View);
                      }
                    }}
                    className={`w-full flex items-center gap-4 ${sidebarCollapsed ? 'justify-center px-3' : 'px-4'} py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'text-slate-500 font-semibold hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-600 transition-colors'}`}>
                      {item.icon}
                    </div>
                    <span className={`text-sm whitespace-nowrap transition-all duration-300 ${
                      sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                  {/* Tooltip - only show when collapsed */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>


        {/* User Profile Section */}
        <div className={`mt-auto ${sidebarCollapsed ? 'p-3' : 'p-6'} border-t border-slate-100 transition-all duration-300`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : 'px-2'} mb-2 group cursor-pointer relative`}>
            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
              <img src="https://i.pravatar.cc/100?u=drb" alt="Dr. Baveja" className="w-full h-full object-cover" />
            </div>
            <div className={`overflow-hidden text-left transition-all duration-300 ${
              sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}>
              <p className="text-sm font-bold text-slate-900 truncate">Dr. Baveja</p>
              <p className="text-xs text-slate-500 font-medium truncate">General Practitioner</p>
            </div>
            {/* Tooltip for user when collapsed */}
            {sidebarCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                <p className="font-semibold">Dr. Baveja</p>
                <p className="text-xs text-slate-300">General Practitioner</p>
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800"></div>
              </div>
            )}
          </div>
          <div className="relative group">
            <button className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'justify-center px-3' : 'px-4'} py-3 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 text-sm font-semibold`}>
              <LogOut size={18} className="shrink-0" />
              <span className={`transition-all duration-300 ${
                sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
              }`}>
                Sign Out
              </span>
            </button>
            {/* Tooltip for sign out when collapsed */}
            {sidebarCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                Sign Out
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800"></div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="h-[80px] bg-white border-b border-slate-200 px-10 flex items-center justify-between shrink-0 z-20 sticky top-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Welcome, Dr. Baveja</h2>
            {/* <p className="text-xs text-slate-500 font-medium mt-0.5">You have 5 tasks pending today.</p> */}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl w-[320px] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 border border-transparent transition-all">
              <Search size={18} className="text-slate-300" />
              <input 
                type="text" 
                placeholder="Search patients, ID..." 
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-300 font-medium"
              />
            </div>
            <button className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all relative group">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white shadow-sm group-hover:scale-125 transition-transform"></span>
            </button>
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
          <div className="max-w-[1400px] mx-auto">
            {renderView()}
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
};

export default DoctorPortal;

