import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  LogOut,
  Bell,
  Search,
  LayoutDashboard,
  Hospital,
  Scan,
  AlertCircle,
  PanelLeftClose,
  Building2,
  Loader2,
  UserCog,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import PatientList from './PatientList';
import PatientOnboarding from './PatientOnboarding';
import ClinicSetup from './ClinicSetup';
import UserManagement from './UserManagement';
import { api, Clinic, DashboardResponse } from '../services/api';
import { useAuth } from '../contexts/AuthContext';


type View = 'dashboard' | 'onboarding' | 'clinic' | 'patients' | 'appointments' | 'team';

// Sidebar localStorage key
const SIDEBAR_COLLAPSED_KEY = 'medcore_sidebar_collapsed';

// =============================================================================
// PROPS INTERFACE
// =============================================================================

interface DoctorPortalProps {
  clinicId: string;
}

interface DoctorPortalContentProps {
  clinicId: string;
}

// =============================================================================
// MAIN PORTAL CONTENT (Authenticated View)
// =============================================================================

const DoctorPortalContent: React.FC<DoctorPortalContentProps> = ({ clinicId: urlClinicId }) => {
  const { user, logout } = useAuth();

  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  // Use clinic_id from URL (passed down), fallback to user's clinic
  const clinicId = urlClinicId || user?.clinic_id || 'VIC-MCLEAN-001';
  const [patientList, setPatientList] = useState<string[]>([]); // Track patient IDs for navigation
  const [clinicData, setClinicData] = useState<Clinic | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  console.log('[DoctorPortal] Rendering for user:', user?.name, '| Clinic:', user?.clinic_name);

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

  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      setDashboardLoading(true);
      const data = await api.getDashboardStats();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [clinicId, fetchDashboardStats]);

  // Refresh stats when returning to dashboard view
  useEffect(() => {
    if (currentView === 'dashboard') {
      fetchDashboardStats();
    }
  }, [currentView, fetchDashboardStats]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  // Get clinic name and logo - prefer from clinic data, then from auth user
  const clinicName = clinicData?.clinic_profile?.name || user?.clinic_name || 'Clinic';
  const clinicLogoUrl = clinicData?.clinic_profile?.branding?.logo_url;

  // Handle logout
  const handleLogout = async () => {
    console.log('[DoctorPortal] User clicked logout');
    await logout();
    // The parent component will handle showing the login page
  };

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
        // Get stats from API or use defaults
        const stats = dashboardData?.stats || {
          total_patients: 0,
          todays_surgeries: 0,
          pending_review: 0,
          alerts: 0,
        };
        const todaysSurgeries = dashboardData?.todays_surgery_schedule || [];

        // Get current date formatted nicely
        const today = new Date();
        const dateString = today.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        return (
          <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: "Today's Surgeries",
                  value: dashboardLoading ? '...' : stats.todays_surgeries.toString(),
                  icon: <Calendar size={24} />,
                  badge: todaysSurgeries.length > 0 ? 'Scheduled' : null,
                  color: 'text-teal-600',
                  bg: 'bg-teal-50',
                  badgeBg: 'bg-teal-100',
                  badgeText: 'text-teal-600'
                },
                {
                  label: 'Pending Review',
                  value: dashboardLoading ? '...' : stats.pending_review.toString(),
                  icon: <Scan size={24} />,
                  badge: stats.pending_review > 0 ? 'Action Req' : null,
                  color: 'text-amber-600',
                  bg: 'bg-amber-50',
                  badgeBg: 'bg-amber-100',
                  badgeText: 'text-amber-600'
                },
                {
                  label: 'Total Patients',
                  value: dashboardLoading ? '...' : stats.total_patients.toString(),
                  icon: <Users size={24} />,
                  color: 'text-purple-600',
                  bg: 'bg-purple-50',
                  badge: null
                },
                {
                  label: 'Alerts',
                  value: dashboardLoading ? '...' : stats.alerts.toString(),
                  icon: <AlertCircle size={24} />,
                  badge: stats.alerts > 0 ? 'High Risk' : null,
                  color: 'text-rose-600',
                  bg: 'bg-rose-50',
                  badgeBg: 'bg-rose-100',
                  badgeText: 'text-rose-600'
                },
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

            {/* Today's Surgery Schedule */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-50">
                    <Calendar size={20} className="text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Today's Surgery Schedule</h3>
                    <p className="text-sm text-slate-400 font-medium">{dateString}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {todaysSurgeries.length > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-600 text-xs font-bold">
                      {todaysSurgeries.length} {todaysSurgeries.length === 1 ? 'Surgery' : 'Surgeries'}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchDashboardStats(); }}
                    disabled={dashboardLoading}
                    className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-50"
                    title="Refresh"
                  >
                    <RefreshCw size={16} className={dashboardLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {dashboardLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Loading schedule...</p>
                </div>
              ) : todaysSurgeries.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar size={28} className="text-slate-400" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-700 mb-2">No Surgeries Today</h4>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    There are no surgeries scheduled for today. Check back tomorrow or review pending patients.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <th className="px-8 py-4 text-left">Time</th>
                        <th className="px-6 py-4 text-left">Patient</th>
                        <th className="px-6 py-4 text-left">Eye</th>
                        <th className="px-6 py-4 text-left">Procedure</th>
                        <th className="px-6 py-4 text-left">IOL</th>
                        <th className="px-8 py-4 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {todaysSurgeries.map((surgery, idx) => (
                        <tr
                          key={`${surgery.patient_id}-${surgery.eye}-${idx}`}
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => navigateToOnboarding(surgery.patient_id)}
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-slate-400" />
                              <span className="text-sm font-bold text-slate-900">{surgery.arrival_time || 'TBD'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
                                {surgery.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{surgery.patient_name}</p>
                                <p className="text-xs text-slate-400">#{surgery.patient_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <Eye size={16} className="text-slate-400" />
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                surgery.eye === 'OD'
                                  ? 'bg-teal-50 text-teal-600'
                                  : 'bg-violet-50 text-violet-600'
                              }`}>
                                {surgery.eye} ({surgery.eye === 'OD' ? 'Right' : 'Left'})
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm font-medium text-slate-700">{surgery.surgery_type}</span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm text-slate-600">{surgery.lens}</span>
                          </td>
                          <td className="px-8 py-5">
                            {surgery.is_ready ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
                                <CheckCircle2 size={14} />
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-bold">
                                <Clock size={14} />
                                Pre-Op Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
      case 'team':
        return <UserManagement />;
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
        {/* Clinic Header with Toggle */}
        <div className={`${sidebarCollapsed ? 'py-4' : 'p-4 pb-4'} transition-all duration-300`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2'} mb-6`}>
            {/* Clinic logo or default icon */}
            <div
              className="shrink-0 cursor-pointer group"
              onClick={() => sidebarCollapsed && toggleSidebar()}
              title={sidebarCollapsed ? 'Expand sidebar' : clinicName}
            >
              {clinicLogoUrl ? (
                <img
                  src={clinicLogoUrl}
                  alt={clinicName}
                  className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-200 group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Eye size={18} className="text-teal-600" />
                </div>
              )}
            </div>
            {/* Clinic name + collapse toggle */}
            {!sidebarCollapsed && (
              <>
                <span className="font-bold text-base tracking-tight text-slate-800 truncate flex-1 min-w-0" title={clinicName}>
                  {clinicName}
                </span>
                <button
                  onClick={toggleSidebar}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all duration-200"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose size={16} />
                </button>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className={`space-y-1 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
              { id: 'patients', label: 'Patients', icon: <Users size={20} /> },
              { id: 'clinic', label: 'Clinic Data', icon: <Hospital size={20} /> },
              { id: 'team', label: 'Team', icon: <UserCog size={20} /> },
            ].map((item) => {
              const isActive = currentView === item.id || (item.id === 'dashboard' && currentView === 'onboarding');
              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => {
                      if (item.id === 'dashboard' || item.id === 'clinic' || item.id === 'patients' || item.id === 'team') {
                        setCurrentView(item.id as View);
                      }
                    }}
                    className={`flex items-center rounded-xl transition-all duration-200 ${
                      sidebarCollapsed
                        ? `w-10 h-10 justify-center ${isActive ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:text-slate-600 hover:bg-slate-50'}`
                        : `w-full px-4 py-3 gap-4 ${isActive ? 'bg-teal-50 text-teal-600 font-semibold' : 'text-slate-500 font-semibold hover:text-slate-700 hover:bg-slate-50'}`
                    }`}
                  >
                    <div className={`shrink-0 ${isActive ? 'text-teal-600' : ''}`}>
                      {item.icon}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-sm whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
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
        <div className={`mt-auto ${sidebarCollapsed ? 'py-3 flex flex-col items-center' : 'p-6'} border-t border-slate-100 transition-all duration-300`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? '' : 'px-2'} mb-2 group cursor-pointer relative`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center border border-slate-200 shrink-0">
              <span className="text-white font-bold text-sm">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden text-left">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-500 font-medium truncate capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</p>
              </div>
            )}
            {/* Tooltip for user when collapsed */}
            {sidebarCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                <p className="font-semibold">{user?.name || 'User'}</p>
                <p className="text-xs text-slate-300 capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</p>
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800"></div>
              </div>
            )}
          </div>
          <div className="relative group">
            <button
              onClick={handleLogout}
              className={`flex items-center rounded-xl transition-all duration-200 text-sm font-semibold ${
                sidebarCollapsed
                  ? 'w-10 h-10 justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  : 'w-full px-4 py-3 gap-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              <LogOut size={18} className="shrink-0" />
              {!sidebarCollapsed && (
                <span>Sign Out</span>
              )}
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
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Welcome, {user?.name || 'Doctor'}</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {dashboardData?.stats.todays_surgeries ? ` • ${dashboardData.stats.todays_surgeries} surgery today` : ''}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl w-[320px] focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100 border border-transparent transition-all">
              <Search size={18} className="text-slate-300" />
              <input 
                type="text" 
                placeholder="Search patients, ID..." 
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-300 font-medium"
              />
            </div>
            <button className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all relative group">
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

// =============================================================================
// MAIN EXPORT - Just renders the portal content
// Auth is handled by DoctorRoute in App.tsx
// =============================================================================

const DoctorPortal: React.FC<DoctorPortalProps> = ({ clinicId }) => {
  console.log('[DoctorPortal] Rendering for clinic:', clinicId);
  return <DoctorPortalContent clinicId={clinicId} />;
};

export default DoctorPortal;

