/**
 * Admin Dashboard for Super Admins
 *
 * Features:
 * - Platform overview stats
 * - List all clinics with status
 * - Approve/Reject pending clinics
 * - View clinic details
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  UserCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  Activity,
  Shield,
  MapPin,
  Phone,
  Calendar,
  TrendingUp,
  Monitor,
  Smartphone,
  Globe,
} from 'lucide-react';
import { adminApi, AdminClinic, AdminOverviewResponse } from '../services/api';

type AdminTab = 'clinics' | 'activity';

function parseBrowser(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Postman')) return 'Postman';
  if (ua.includes('curl')) return 'curl';
  return 'Other';
}

function parseOS(ua: string | null): string {
  if (!ua) return '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return '';
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });
}

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse['overview'] | null>(null);
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedClinic, setSelectedClinic] = useState<AdminClinic | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('clinics');
  const [loginActivity, setLoginActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      const [overviewRes, clinicsRes] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getClinics(statusFilter || undefined),
      ]);

      setOverview(overviewRes.overview);
      setClinics(clinicsRes.clinics);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLoginActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await adminApi.getLoginActivity(200);
      setLoginActivity(res.activity || []);
    } catch (err: any) {
      console.error('Failed to fetch login activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity' && loginActivity.length === 0) {
      fetchLoginActivity();
    }
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
    if (activeTab === 'activity') fetchLoginActivity();
  };

  const handleApprove = async (clinic: AdminClinic) => {
    if (!confirm(`Approve clinic "${clinic.name}"? This will allow their admin to login.`)) return;

    setActionLoading(clinic.id);
    try {
      await adminApi.updateClinic(clinic.id, { status: 'active' });
      // Update local state
      setClinics(prev =>
        prev.map(c => (c.id === clinic.id ? { ...c, status: 'active' } : c))
      );
      if (selectedClinic?.id === clinic.id) {
        setSelectedClinic({ ...selectedClinic, status: 'active' });
      }
    } catch (err: any) {
      alert(`Failed to approve: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (clinic: AdminClinic) => {
    if (!confirm(`Suspend clinic "${clinic.name}"? Their users won't be able to login.`)) return;

    setActionLoading(clinic.id);
    try {
      await adminApi.updateClinic(clinic.id, { status: 'suspended' });
      setClinics(prev =>
        prev.map(c => (c.id === clinic.id ? { ...c, status: 'suspended' } : c))
      );
      if (selectedClinic?.id === clinic.id) {
        setSelectedClinic({ ...selectedClinic, status: 'suspended' });
      }
    } catch (err: any) {
      alert(`Failed to suspend: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (clinic: AdminClinic) => {
    setActionLoading(clinic.id);
    try {
      await adminApi.updateClinic(clinic.id, { status: 'active' });
      setClinics(prev =>
        prev.map(c => (c.id === clinic.id ? { ...c, status: 'active' } : c))
      );
      if (selectedClinic?.id === clinic.id) {
        setSelectedClinic({ ...selectedClinic, status: 'active' });
      }
    } catch (err: any) {
      alert(`Failed to reactivate: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <CheckCircle size={12} /> Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            <Clock size={12} /> Pending
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <XCircle size={12} /> Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const pendingCount = clinics.filter(c => c.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-teal-500" />
          <p className="text-slate-500 font-medium">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Shield className="text-teal-600" size={28} />
            Admin Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Manage clinics and monitor platform activity</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-800">
              {pendingCount} clinic{pendingCount > 1 ? 's' : ''} pending approval
            </p>
            <p className="text-sm text-amber-700">
              Review and approve new clinic registrations below
            </p>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
          >
            View Pending
          </button>
        </div>
      )}

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <Building2 size={24} className="text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Clinics</p>
                <p className="text-2xl font-bold text-slate-900">{overview.clinics.total}</p>
                <p className="text-xs text-green-600 font-medium">
                  {overview.clinics.active} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{overview.users.total}</p>
                <p className="text-xs text-slate-500 font-medium">Across all clinics</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <UserCheck size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Patients</p>
                <p className="text-2xl font-bold text-slate-900">{overview.patients.total}</p>
                <p className="text-xs text-slate-500 font-medium">Platform-wide</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('clinics')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'clinics'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 size={16} className="inline mr-2 -mt-0.5" />
          Clinics
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'activity'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity size={16} className="inline mr-2 -mt-0.5" />
          Login Activity
          {loginActivity.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
              {loginActivity.length}
            </span>
          )}
        </button>
      </div>

      {/* Login Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent Login Activity</h2>
            <button
              onClick={fetchLoginActivity}
              disabled={activityLoading}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              {activityLoading ? <Loader2 size={16} className="animate-spin" /> : 'Refresh'}
            </button>
          </div>

          {activityLoading && loginActivity.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin text-teal-500 mx-auto" />
              <p className="text-slate-500 mt-3 text-sm">Loading activity...</p>
            </div>
          ) : loginActivity.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Activity size={32} className="mx-auto mb-3 text-slate-300" />
              <p>No login activity recorded yet.</p>
              <p className="text-sm mt-1">Activity will appear here when users log in.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-5 py-3 font-semibold text-slate-600">Time</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">User</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Type</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Clinic</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Location</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">Browser</th>
                    <th className="px-5 py-3 font-semibold text-slate-600">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginActivity.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        <Clock size={14} className="inline mr-1.5 text-slate-400 -mt-0.5" />
                        {formatTime(item.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{item.user_name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{item.email || item.phone || ''}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.user_type === 'patient'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-teal-100 text-teal-700'
                        }`}>
                          {item.user_type === 'patient' ? (
                            <><Smartphone size={12} /> Patient</>
                          ) : (
                            <><Monitor size={12} /> {item.role === 'super_admin' ? 'Admin' : 'Doctor'}</>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{item.clinic_name || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        <MapPin size={14} className="inline mr-1.5 text-slate-400 -mt-0.5" />
                        {item.city && item.country
                          ? `${item.city}, ${item.country}`
                          : item.country || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        <Globe size={14} className="inline mr-1.5 text-slate-400 -mt-0.5" />
                        {parseBrowser(item.user_agent)}{parseOS(item.user_agent) ? ` / ${parseOS(item.user_agent)}` : ''}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{item.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Clinics Section */}
      {activeTab === 'clinics' && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Clinics Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Clinics</h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Clinics List */}
        <div className="divide-y divide-slate-100">
          {clinics.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No clinics found {statusFilter && `with status "${statusFilter}"`}
            </div>
          ) : (
            clinics.map((clinic) => (
              <div
                key={clinic.id}
                className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                  selectedClinic?.id === clinic.id ? 'bg-teal-50' : ''
                }`}
                onClick={() => setSelectedClinic(clinic)}
              >
                <div className="flex items-center gap-4">
                  {/* Clinic Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    clinic.status === 'pending' ? 'bg-amber-100' :
                    clinic.status === 'active' ? 'bg-teal-100' : 'bg-slate-100'
                  }`}>
                    <Building2 size={24} className={
                      clinic.status === 'pending' ? 'text-amber-600' :
                      clinic.status === 'active' ? 'text-teal-600' : 'text-slate-500'
                    } />
                  </div>

                  {/* Clinic Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">{clinic.name}</h3>
                      {getStatusBadge(clinic.status)}
                    </div>
                    <p className="text-sm text-slate-500 font-mono">{clinic.clinic_id}</p>
                    {clinic.address?.city && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin size={12} />
                        {clinic.address.city}{clinic.address.state && `, ${clinic.address.state}`}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {clinic.status === 'pending' && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleApprove(clinic); }}
                          disabled={actionLoading === clinic.id}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionLoading === clinic.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSuspend(clinic); }}
                          disabled={actionLoading === clinic.id}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {clinic.status === 'active' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSuspend(clinic); }}
                        disabled={actionLoading === clinic.id}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    )}
                    {clinic.status === 'suspended' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReactivate(clinic); }}
                        disabled={actionLoading === clinic.id}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* Selected Clinic Details */}
      {selectedClinic && activeTab === 'clinics' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {selectedClinic.name}
                {getStatusBadge(selectedClinic.status)}
              </h2>
              <p className="text-sm text-slate-500 font-mono mt-1">{selectedClinic.clinic_id}</p>
            </div>
            <button
              onClick={() => setSelectedClinic(null)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Address */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <MapPin size={16} /> Address
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                {selectedClinic.address?.street || 'No street'}<br />
                {selectedClinic.address?.city || '-'}, {selectedClinic.address?.state || '-'} {selectedClinic.address?.zip || ''}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Phone size={16} /> Contact
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                {selectedClinic.contact?.phone || 'No phone'}
                {selectedClinic.contact?.email && (
                  <><br />{selectedClinic.contact.email}</>
                )}
              </div>
            </div>

            {/* Created Date */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Calendar size={16} /> Registered
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                {new Date(selectedClinic.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {/* UUID */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Activity size={16} /> Internal ID
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 text-xs font-mono text-slate-500 break-all">
                {selectedClinic.id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
