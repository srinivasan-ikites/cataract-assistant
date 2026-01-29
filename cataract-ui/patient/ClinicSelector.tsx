import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Loader, { LoaderStyles } from '../components/Loader';
import { Building2, MapPin, ChevronRight, Search } from 'lucide-react';

interface ClinicInfo {
  clinic_id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

const ClinicSelector: React.FC = () => {
  const navigate = useNavigate();
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadClinics = async () => {
      try {
        setLoading(true);
        const data = await api.getActiveClinics();
        setClinics(data);
        setError(null);
      } catch (err: any) {
        console.error('[ClinicSelector] Failed to load clinics:', err);
        setError(err.message || 'Failed to load clinics');
      } finally {
        setLoading(false);
      }
    };
    loadClinics();
  }, []);

  const handleSelectClinic = (clinicId: string) => {
    navigate(`/patient/${clinicId}/login`);
  };

  const filteredClinics = clinics.filter(clinic => {
    const query = searchQuery.toLowerCase();
    const nameMatch = clinic.name?.toLowerCase().includes(query);
    const cityMatch = clinic.address?.city?.toLowerCase().includes(query);
    const stateMatch = clinic.address?.state?.toLowerCase().includes(query);
    return nameMatch || cityMatch || stateMatch;
  });

  const formatAddress = (address?: ClinicInfo['address']) => {
    if (!address) return null;
    const parts = [address.city, address.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <LoaderStyles />
        <Loader
          size="xl"
          variant="medical"
          message="Loading clinics"
          subMessage="Please wait..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-rose-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Unable to Load Clinics</h2>
          <p className="text-slate-600">{error}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Select Your Clinic
          </h1>
          <p className="text-slate-600">
            Choose your eye clinic to access your personalized cataract surgery education portal.
          </p>
        </div>

        {/* Search */}
        {clinics.length > 3 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by clinic name or location..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700"
              />
            </div>
          </div>
        )}

        {/* Clinic List */}
        {filteredClinics.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {searchQuery ? 'No clinics match your search' : 'No clinics available'}
            </h3>
            <p className="text-slate-500 text-sm">
              {searchQuery
                ? 'Try searching with different keywords.'
                : 'Please contact support if you believe this is an error.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClinics.map((clinic) => (
              <button
                key={clinic.clinic_id}
                onClick={() => handleSelectClinic(clinic.clinic_id)}
                className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:border-blue-300 hover:shadow-md transition-all group text-left"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">
                    {clinic.name}
                  </h3>
                  {formatAddress(clinic.address) && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {formatAddress(clinic.address)}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicSelector;
