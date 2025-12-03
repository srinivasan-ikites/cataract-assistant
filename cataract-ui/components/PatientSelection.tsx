import React, { useEffect, useState } from 'react';
import { User, ChevronRight, Activity } from 'lucide-react';
import { api, Patient } from '../services/api';

interface PatientSelectionProps {
    onSelect: (patient: Patient) => void;
}

const PatientSelection: React.FC<PatientSelectionProps> = ({ onSelect }) => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.getPatients()
            .then(setPatients)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="animate-spin text-blue-600" size={40} />
                    <p className="text-slate-500 font-medium">Loading Patient Records...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="text-red-500" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Connection Error</h2>
                    <p className="text-slate-600 mb-6">{error}. Is the backend running?</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Welcome to Cataract Counsellor</h1>
                    <p className="text-slate-600 text-lg">Select a patient profile to begin the session.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {patients.map((patient) => (
                        <button
                            key={patient.patient_id}
                            onClick={() => onSelect(patient)}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all text-left group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
                                <ChevronRight />
                            </div>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    {patient.name.first[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">
                                        {patient.name.first} {patient.name.last}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-mono">ID: {patient.patient_id}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">DOB</span>
                                    <span className="font-medium text-slate-700">{patient.dob}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Status</span>
                                    <span className="font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs">Active</span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PatientSelection;
