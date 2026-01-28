import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Package,
  Pill,
  Eye,
  Users,
} from 'lucide-react';
import { api, Clinic } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ClinicSettingsProps {
  clinicId: string;
}

const ClinicSettings: React.FC<ClinicSettingsProps> = ({ clinicId }) => {
  const { user } = useAuth();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isClinicAdmin = user?.role === 'clinic_admin';

  // Fetch clinic data
  useEffect(() => {
    fetchClinicData();
  }, [clinicId]);

  const fetchClinicData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getClinicDetails(clinicId);
      setClinic(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load clinic data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-slate-600">{error}</p>
        <button
          onClick={fetchClinicData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const clinicProfile = clinic?.clinic_profile || {};
  const address = clinicProfile.address || {};
  const contact = clinicProfile.contact || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clinic Settings</h1>
        <p className="text-slate-500 mt-1">View and manage your clinic information</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* Clinic Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Building2 size={20} />
            Clinic Profile
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Clinic Name */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Clinic Name</label>
              <p className="text-lg font-semibold text-slate-900">{clinicProfile.name || 'Not set'}</p>
            </div>

            {/* Clinic ID */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Clinic ID</label>
              <p className="text-lg font-mono text-slate-700">{clinicProfile.clinic_id || clinicId}</p>
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <MapPin size={14} />
                Address
              </label>
              <p className="text-slate-700">
                {address.street && <span>{address.street}<br /></span>}
                {address.city && <span>{address.city}, </span>}
                {address.state && <span>{address.state} </span>}
                {address.zip && <span>{address.zip}</span>}
                {!address.street && !address.city && <span className="text-slate-400">No address set</span>}
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Phone size={14} />
                Phone
              </label>
              <p className="text-slate-700">{contact.phone || <span className="text-slate-400">Not set</span>}</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Mail size={14} />
                Email
              </label>
              <p className="text-slate-700">{contact.email || <span className="text-slate-400">Not set</span>}</p>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Globe size={14} />
                Website
              </label>
              <p className="text-slate-700">{contact.website || <span className="text-slate-400">Not set</span>}</p>
            </div>

            {/* Hours */}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Clock size={14} />
                Hours
              </label>
              <p className="text-slate-700">{contact.hours || <span className="text-slate-400">Not set</span>}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {clinic?.surgical_packages?.length || 0}
              </p>
              <p className="text-sm text-slate-500">Surgical Packages</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <Pill size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {Object.keys(clinic?.medications || {}).length > 0 ? 'Configured' : '0'}
              </p>
              <p className="text-sm text-slate-500">Medications</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Eye size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {Object.keys(clinic?.lens_inventory || {}).length || 0}
              </p>
              <p className="text-sm text-slate-500">Lens Categories</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Users size={24} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {clinic?.staff_directory?.length || 0}
              </p>
              <p className="text-sm text-slate-500">Staff Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Surgical Packages */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package size={20} />
            Surgical Packages
          </h2>
        </div>
        <div className="p-6">
          {clinic?.surgical_packages && clinic.surgical_packages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clinic.surgical_packages.map((pkg: any, index: number) => (
                <div
                  key={pkg.package_id || index}
                  className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <h3 className="font-semibold text-slate-900">{pkg.display_name || pkg.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{pkg.description || 'No description'}</p>
                  {pkg.price_cash && (
                    <p className="text-lg font-bold text-green-600 mt-2">
                      ${pkg.price_cash.toLocaleString()}
                    </p>
                  )}
                  {pkg.includes_laser && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      Includes Laser
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No surgical packages configured</p>
          )}
        </div>
      </div>

      {/* Lens Inventory Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Eye size={20} />
            Lens Inventory
          </h2>
        </div>
        <div className="p-6">
          {clinic?.lens_inventory && Object.keys(clinic.lens_inventory).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(clinic.lens_inventory).map(([category, lenses]: [string, any]) => (
                <div
                  key={category}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <h3 className="font-semibold text-slate-900">{category}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {Array.isArray(lenses) ? lenses.length : Object.keys(lenses).length} lens options
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No lens inventory configured</p>
          )}
        </div>
      </div>

      {/* Staff Directory */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users size={20} />
            Staff Directory
          </h2>
        </div>
        <div className="p-6">
          {clinic?.staff_directory && clinic.staff_directory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clinic.staff_directory.map((staff: any, index: number) => (
                <div
                  key={staff.provider_id || index}
                  className="flex items-center gap-3 border border-slate-200 rounded-lg p-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {staff.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{staff.name}</p>
                    <p className="text-sm text-slate-500">{staff.role || staff.specialty}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No staff members configured</p>
          )}
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium">Note:</p>
        <p>
          To update clinic configuration (packages, medications, lens inventory), please use the
          Clinic Setup page or contact your system administrator.
        </p>
      </div>
    </div>
  );
};

export default ClinicSettings;
