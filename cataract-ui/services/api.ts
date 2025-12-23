import { ModuleItem } from '../types';

// const API_BASE = 'http://localhost:8000'; // align with backend
// const API_BASE = 'http://172.16.0.158:8000'; // Use LAN IP so mobile can reach backend
const API_BASE = 'https://cataract-assistant.onrender.com'; // Adjust if your backend port differs

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
    blocks?: Array<{
        type: 'text' | 'heading' | 'list' | 'numbered_steps' | 'callout' | 'warning' | 'timeline';
        content?: string;
        title?: string;
        items?: string[];
        steps?: string[];
        phases?: Array<{ phase: string; description: string }>;
    }>;
    suggestions?: string[];
    timestamp?: string;
    media?: any[];
    sources?: any[];
}

export interface AskResponse {
    answer: string;
    blocks?: Array<{
        type: 'text' | 'heading' | 'list' | 'numbered_steps' | 'callout' | 'warning' | 'timeline';
        content?: string;
        title?: string;
        items?: string[];
        steps?: string[];
        phases?: Array<{ phase: string; description: string }>;
    }>;
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

    // --- Doctor Portal Endpoints ---
    async uploadPatientDocs(clinicId: string, patientId: string, files: File[]): Promise<any> {
        const formData = new FormData();
        formData.append('clinic_id', clinicId);
        formData.append('patient_id', patientId);
        files.forEach(file => formData.append('files', file));
        
        const res = await fetch(`${API_BASE}/doctor/uploads/patient`, {
            method: 'POST',
            body: formData,
        });

        if (!res.ok) {
            let msg = 'Failed to upload patient documents';
            try {
                const body = await res.json();
                msg = body?.detail || body?.message || msg;
            } catch {
                try {
                    msg = await res.text();
                } catch {/* ignore */}
            }
            throw new Error(msg);
        }

        return res.json();
    },

    async uploadClinicDocs(clinicId: string, files: File[]): Promise<any> {
        const formData = new FormData();
        formData.append('clinic_id', clinicId);
        files.forEach(file => formData.append('files', file));
        
        const res = await fetch(`${API_BASE}/doctor/uploads/clinic`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to upload clinic documents');
        return res.json();
    },

    async getExtractedPatient(clinicId: string, patientId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/extractions/patient?clinic_id=${clinicId}&patient_id=${patientId}`);
        if (!res.ok) throw new Error('Failed to fetch extracted patient data');
        return res.json();
    },

    async getExtractedClinic(clinicId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/extractions/clinic?clinic_id=${clinicId}`);
        if (!res.ok) throw new Error('Failed to fetch extracted clinic data');
        return res.json();
    },

    async saveReviewedPatient(clinicId: string, patientId: string, data: any): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/review/patient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinic_id: clinicId, patient_id: patientId, data }),
        });
        if (!res.ok) throw new Error('Failed to save reviewed patient data');
        return res.json();
    },

    async saveReviewedClinic(clinicId: string, data: any): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/review/clinic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinic_id: clinicId, data }),
        });
        if (!res.ok) throw new Error('Failed to save reviewed clinic data');
        return res.json();
    },

    async getReviewedPatient(clinicId: string, patientId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/reviewed/patient?clinic_id=${clinicId}&patient_id=${patientId}`);
        if (!res.ok) return null; // Might not exist yet
        return res.json();
    },

    async getReviewedClinic(clinicId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/reviewed/clinic?clinic_id=${clinicId}`);
        if (!res.ok) return null; // Might not exist yet
        return res.json();
    },

    async deletePatientData(clinicId: string, patientId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/doctor/patient?clinic_id=${clinicId}&patient_id=${patientId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            let msg = 'Failed to delete patient data';
            try {
                const body = await res.json();
                msg = body?.detail || body?.message || msg;
            } catch {
                try {
                    msg = await res.text();
                } catch {/* ignore */}
            }
            throw new Error(msg);
        }
        return res.json();
    },

    async clearPatientChat(patientId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/patients/${patientId}/chat/clear`, {
            method: 'POST',
        });
        if (!res.ok) {
            // We don't want to break the UI on failure, but log for debugging
            // eslint-disable-next-line no-console
            console.error('Failed to clear patient chat history');
        }
    },
};
