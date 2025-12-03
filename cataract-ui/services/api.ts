import { ModuleItem } from '../types';

const API_BASE = 'http://localhost:8000'; // Adjust if your backend port differs

export interface Patient {
    patient_id: string;
    name: { first: string; last: string };
    dob: string;
    chat_history?: ChatMessage[];
    // Add other fields as needed from your JSON
}

export interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
    suggestions?: string[];
    timestamp?: string;
}

export interface AskResponse {
    answer: string;
    suggestions: string[];
    router_summary: any;
    context_sources: any;
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
    }
};
