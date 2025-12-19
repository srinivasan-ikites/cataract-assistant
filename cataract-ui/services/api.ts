import { ModuleItem } from '../types';

const API_BASE = 'http://localhost:8000'; // Adjust if your backend port differs
// const API_BASE = 'https://cataract-assistant.onrender.com'; // Adjust if your backend port differs

export interface Patient {
    patient_id: string;
    clinic_id?: string;
    name: { first: string; last: string };
    dob: string;
    chat_history?: ChatMessage[];
    module_content?: Record<string, any>;
    clinical_context?: any;
    surgical_selection?: any;
    lifestyle_preferences?: any;
    extra?: any;
    // Add other fields as needed from your JSON
}

export interface Clinic {
    clinic_profile: {
        clinic_id: string;
        name: string;
        parent_organization?: string;
        address?: any;
        contact_info?: { phone_work?: string; fax?: string };
    };
    staff_directory?: Array<{
        provider_id: string;
        name: string;
        role?: string;
        specialty?: string;
    }>;
    standard_pricing_packages?: any;
    standard_operating_procedures?: any;
    legal_policies?: any;
}

export interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
    suggestions?: string[];
    timestamp?: string;
    media?: any[];
    sources?: any[];
}

export interface AskResponse {
    answer: string;
    suggestions: string[];
    router_summary: any;
    context_sources: any;
    media?: any[];
    sources?: any[];
}

export const api = {
    async getPatients(): Promise<Patient[]> {
        const res = await fetch(`${API_BASE}/patients`);
        if (!res.ok) throw new Error('Failed to fetch patients');
        return res.json();
    },

    async getPatientDetails(id: string): Promise<Patient> {
        const res = await fetch(`${API_BASE}/patients/${id}`);
        if (!res.ok) throw new Error('Failed to fetch patient details');
        return res.json();
    },

    async askAgent(patientId: string, question: string): Promise<AskResponse> {
        const res = await fetch(`${API_BASE}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: patientId, question }),
        });
        if (!res.ok) throw new Error('Failed to ask agent');
        return res.json();
    },

    async pregenerateModules(patientId: string): Promise<{ status: string }> {
        const res = await fetch(`${API_BASE}/pregenerate-modules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: patientId }),
        });
        if (!res.ok) throw new Error('Failed to pregenerate modules');
        return res.json();
    },

    async getClinicDetails(clinicId: string): Promise<Clinic> {
        const res = await fetch(`${API_BASE}/clinics/${clinicId}`);
        if (!res.ok) throw new Error('Failed to fetch clinic details');
        return res.json();
    },
};
