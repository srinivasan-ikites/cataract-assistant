/**
 * Patient Portal - Main entry point for patients
 *
 * Handles:
 * - Authentication state (login/logged-in)
 * - Shows PatientLogin if not authenticated
 * - Shows PatientDashboard if authenticated (to be built)
 */

import React, { useState, useEffect } from 'react';
import { Loader2, LogOut, User, Calendar, BookOpen } from 'lucide-react';
import PatientLogin from './PatientLogin';
import { patientAuthStorage, patientAuthApi, PatientAuthData } from '../services/api';

// For now, hardcode clinic - in production, this would come from URL or subdomain
// const DEFAULT_CLINIC_ID = 'CLINIC-00002'; // Change this to test with different clinics
const DEFAULT_CLINIC_ID = 'VIC-MCLEAN-001'; // Change this to test with different clinics
// const DEFAULT_CLINIC_NAME = 'testing-clinic2';
const DEFAULT_CLINIC_NAME = 'McLean Eye Clinic';

const PatientPortal: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [patient, setPatient] = useState<PatientAuthData | null>(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      if (patientAuthStorage.isAuthenticated()) {
        // Verify token is still valid
        const profile = await patientAuthApi.getProfile();
        if (profile) {
          setPatient(profile as PatientAuthData);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[PatientPortal] Auth check error:', err);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    const storedPatient = patientAuthStorage.getPatient();
    setPatient(storedPatient);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await patientAuthApi.logout();
    setPatient(null);
    setIsAuthenticated(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-blue-500" />
          <p className="text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return (
      <PatientLogin
        clinicId={DEFAULT_CLINIC_ID}
        clinicName={DEFAULT_CLINIC_NAME}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // Authenticated - show patient dashboard (basic for now)
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Welcome, {patient?.name?.first || 'Patient'}!
            </h1>
            <p className="text-sm text-slate-500">{patient?.clinic_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content - Placeholder for now */}
      <main className="max-w-4xl mx-auto p-6">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white mb-6">
          <h2 className="text-xl font-bold mb-2">Your Cataract Surgery Journey</h2>
          <p className="text-blue-100">
            Access personalized education content and track your surgery preparation.
          </p>
        </div>

        {/* Patient Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            Your Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Patient ID</p>
              <p className="font-mono font-semibold text-slate-900">{patient?.patient_id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="font-semibold text-slate-900">
                {patient?.name?.first} {patient?.name?.last}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Clinic</p>
              <p className="font-semibold text-slate-900">{patient?.clinic_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Clinic ID</p>
              <p className="font-mono text-slate-600">{patient?.clinic_id}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions - Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <BookOpen size={24} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Education Content</h3>
            <p className="text-sm text-slate-500">
              Learn about your cataract surgery and what to expect
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Calendar size={24} className="text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Surgery Schedule</h3>
            <p className="text-sm text-slate-500">
              View your appointments and preparation timeline
            </p>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-8 p-4 bg-slate-100 rounded-xl text-center">
          <p className="text-sm text-slate-600">
            Full patient dashboard coming soon! This is a preview of the authenticated state.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PatientPortal;
