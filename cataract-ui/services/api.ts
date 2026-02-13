import { ModuleItem } from '../types';

// const API_BASE = 'http://localhost:8000';
const API_BASE = 'https://cataract-assistant.ikites.ai/api';
// const API_BASE = 'http://172.16.0.158:8000'; // Use LAN IP so mobile can reach backend
// const API_BASE = 'https://cataract-assistant.onrender.com'; // Adjust if your backend port differs

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'clinic_admin' | 'clinic_user';
    clinic_id: string | null;
    clinic_name: string | null;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: AuthUser;
}

export interface UserProfileResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    clinic_id: string | null;
    clinic_name: string | null;
    status: string;
}

// =============================================================================
// AUTH TOKEN STORAGE
// =============================================================================

const TOKEN_KEY = 'cataract_access_token';
const REFRESH_TOKEN_KEY = 'cataract_refresh_token';
const USER_KEY = 'cataract_user';

export const authStorage = {
    getAccessToken: (): string | null => localStorage.getItem(TOKEN_KEY),
    getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
    getUser: (): AuthUser | null => {
        const data = localStorage.getItem(USER_KEY);
        return data ? JSON.parse(data) : null;
    },

    setTokens: (accessToken: string, refreshToken: string, user: AuthUser) => {
        console.log('[Auth Storage] Saving tokens and user data');
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    clearTokens: () => {
        console.log('[Auth Storage] Clearing tokens and user data');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    isAuthenticated: (): boolean => {
        return !!localStorage.getItem(TOKEN_KEY);
    },
};

// =============================================================================
// AUTH API FUNCTIONS
// =============================================================================

export const authApi = {
    /**
     * Login with email and password
     */
    async login(email: string, password: string): Promise<LoginResponse> {
        console.log('[Auth API] Attempting login for:', email);

        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Login failed' }));
            console.log('[Auth API] Login failed:', error.detail);
            throw new Error(error.detail || 'Login failed');
        }

        const data: LoginResponse = await res.json();
        console.log('[Auth API] Login successful for:', data.user.name);

        // Store tokens
        authStorage.setTokens(data.access_token, data.refresh_token, data.user);

        return data;
    },

    /**
     * Logout - clear tokens and call backend
     */
    async logout(): Promise<void> {
        console.log('[Auth API] Logging out');

        const token = authStorage.getAccessToken();

        // Clear local storage first
        authStorage.clearTokens();

        // Try to call backend logout (non-critical)
        if (token) {
            try {
                await fetch(`${API_BASE}/api/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
            } catch (e) {
                console.log('[Auth API] Backend logout call failed (non-critical)');
            }
        }
    },

    /**
     * Get current user profile from backend
     * Used to validate if the stored token is still valid
     */
    async getCurrentUser(): Promise<UserProfileResponse | null> {
        const token = authStorage.getAccessToken();

        if (!token) {
            console.log('[Auth API] No token found, user not authenticated');
            return null;
        }

        console.log('[Auth API] Fetching current user profile');

        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!res.ok) {
                console.log('[Auth API] Token invalid or expired');
                // Token is invalid, try to refresh
                const refreshed = await authApi.refreshToken();
                if (!refreshed) {
                    authStorage.clearTokens();
                    return null;
                }
                // Retry with new token
                return authApi.getCurrentUser();
            }

            const user = await res.json();
            console.log('[Auth API] Current user:', user.name);
            return user;
        } catch (e) {
            console.log('[Auth API] Error fetching user:', e);
            return null;
        }
    },

    /**
     * Refresh the access token using refresh token
     */
    async refreshToken(): Promise<boolean> {
        const refreshToken = authStorage.getRefreshToken();

        if (!refreshToken) {
            console.log('[Auth API] No refresh token available');
            return false;
        }

        console.log('[Auth API] Attempting token refresh');

        try {
            const res = await fetch(`${API_BASE}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (!res.ok) {
                console.log('[Auth API] Token refresh failed');
                return false;
            }

            const data: LoginResponse = await res.json();
            console.log('[Auth API] Token refreshed successfully');

            authStorage.setTokens(data.access_token, data.refresh_token, data.user);
            return true;
        } catch (e) {
            console.log('[Auth API] Token refresh error:', e);
            return false;
        }
    }
};

// =============================================================================
// AUTHENTICATED FETCH HELPER
// =============================================================================

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Custom event dispatched when authentication fails completely
 * (token expired and refresh failed)
 */
export const AUTH_SESSION_EXPIRED_EVENT = 'auth-session-expired';

/**
 * Dispatch auth session expired event
 * This allows React components to listen and react (show login, etc.)
 */
function dispatchSessionExpired(reason: string = 'Session expired') {
    console.log('[Auth] Session expired:', reason);
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT, {
        detail: { reason }
    }));
}

/**
 * Fetch with authentication header
 * Automatically adds the Authorization header with the access token
 *
 * ENHANCED: Now handles token expiration by:
 * 1. Detecting 401 responses
 * 2. Attempting to refresh the token
 * 3. Retrying the original request with new token
 * 4. Dispatching 'auth-session-expired' event if refresh fails
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = authStorage.getAccessToken();

    const headers = new Headers(options.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });

    // If not 401, return the response as-is
    if (response.status !== 401) {
        return response;
    }

    // --- Handle 401 Unauthorized ---
    console.log('[authFetch] Got 401, attempting token refresh...');

    // If already refreshing, wait for that to complete
    if (isRefreshing && refreshPromise) {
        const refreshSuccess = await refreshPromise;
        if (refreshSuccess) {
            // Retry with new token
            const newToken = authStorage.getAccessToken();
            const retryHeaders = new Headers(options.headers);
            if (newToken) {
                retryHeaders.set('Authorization', `Bearer ${newToken}`);
            }
            return fetch(url, { ...options, headers: retryHeaders });
        } else {
            // Refresh failed, return original 401 response
            return response;
        }
    }

    // Start refresh process
    isRefreshing = true;
    refreshPromise = authApi.refreshToken();

    try {
        const refreshSuccess = await refreshPromise;

        if (refreshSuccess) {
            console.log('[authFetch] Token refreshed, retrying request...');
            // Retry the original request with new token
            const newToken = authStorage.getAccessToken();
            const retryHeaders = new Headers(options.headers);
            if (newToken) {
                retryHeaders.set('Authorization', `Bearer ${newToken}`);
            }
            return fetch(url, { ...options, headers: retryHeaders });
        } else {
            console.log('[authFetch] Token refresh failed, session expired');
            // Clear tokens and notify the app
            authStorage.clearTokens();
            dispatchSessionExpired('Your session has expired. Please log in again.');
            return response;
        }
    } finally {
        isRefreshing = false;
        refreshPromise = null;
    }
}

export interface Patient {
    patient_id: string;
    clinic_id?: string;
    name: { first: string; last: string };
    dob: string;
    chat_history?: ChatMessage[];
    module_content?: Record<string, any>;
    clinical_context?: {
        // Per-eye clinical data (v2 schema)
        od_right?: {
            pathology?: string;
            primary_cataract_type?: 'nuclear_sclerosis' | 'cortical' | 'posterior_subcapsular' | 'combined' | 'congenital' | '';
            visual_acuity?: { ucva?: string; bcva?: string };
            biometry?: any;
        };
        os_left?: {
            pathology?: string;
            primary_cataract_type?: 'nuclear_sclerosis' | 'cortical' | 'posterior_subcapsular' | 'combined' | 'congenital' | '';
            visual_acuity?: { ucva?: string; bcva?: string };
            biometry?: any;
        };
        ocular_comorbidities?: string[];
        clinical_alerts?: Array<{ trigger: string; alert_msg: string }>;
        // Legacy fields (kept for backward compatibility)
        diagnosis?: {
            icd_10_code?: string;
            type?: string;
            pathology?: string;
            anatomical_status?: string;
            primary_cataract_type?: string;
        };
        measurements?: any;
        comorbidities?: string[];
        symptoms_reported_by_patient?: string[];
    };
    surgical_recommendations_by_doctor?: {
        doctor_ref_id?: string;
        decision_date?: string;
        candidate_for_laser?: boolean;
        recommended_lens_options?: Array<{
            name: string;
            description?: string;
            reason?: string;
            is_selected_preference: boolean;
        }>;
        scheduling?: {
            surgery_date?: string;
            arrival_time?: string;
            pre_op_start_date?: string;
            post_op_visit_1?: string;
            post_op_visit_2?: string;
        };
        selected_implants?: any;
        // Legacy, keeping for type safety during migration but deprecated
        pre_op_instructions?: {
            antibiotic_name?: string;
            frequency?: string;
        };
    };
    medications?: {
        pre_op?: {
            antibiotic_id?: number;
            antibiotic_name?: string;
            frequency_id?: number;
            frequency?: string;
            progress?: { [date: string]: string[] };
        };
        day_of_surgery?: any;
        post_op?: {
            is_dropless: boolean;
            is_combination: boolean;
            combination_name?: string;
            antibiotic?: {
                name: string;
                frequency: number;
                frequency_label: string;
                weeks: number;
            };
            nsaid?: {
                name: string;
                frequency: number;
                frequency_label: string;
                weeks: number;
            };
            steroid?: {
                name: string;
                taper_schedule: number[];
                weeks: number;
            };
            glaucoma?: {
                resume: boolean;
                medications: string[];
            };
            progress?: { [date: string]: { [medKey: string]: boolean } };
        };
    };
    lifestyle?: {
        hobbies?: string[];
        visual_priorities?: string;
        attitude_toward_glasses?: string;
    };
    surgical_plan?: {
        candidacy_profile?: {
            od_right?: {
                is_candidate_multifocal?: boolean;
                is_candidate_edof?: boolean;
                is_candidate_toric?: boolean;
                is_candidate_lal?: boolean;
            };
            os_left?: {
                is_candidate_multifocal?: boolean;
                is_candidate_edof?: boolean;
                is_candidate_toric?: boolean;
                is_candidate_lal?: boolean;
            };
        };
        offered_packages?: string[];
        offered_packages_od?: string[];
        offered_packages_os?: string[];
        patient_selection?: {
            selected_package_id?: string;
            status?: string;
            selection_date?: string;
        };
        patient_selection_od?: {
            selected_package_id?: string;
            status?: string;
            selection_date?: string;
        };
        patient_selection_os?: {
            selected_package_id?: string;
            status?: string;
            selection_date?: string;
        };
        operative_logistics?: {
            od_right?: {
                status?: string;
                surgery_date?: string;
                arrival_time?: string;
                lens_order?: {
                    model_name?: string;
                    model_code?: string;
                    power?: string;
                    cylinder?: string;
                    axis_alignment?: string;
                };
            };
            os_left?: {
                status?: string;
                surgery_date?: string;
                arrival_time?: string;
                lens_order?: {
                    model_name?: string;
                    model_code?: string;
                    power?: string;
                    cylinder?: string;
                    axis_alignment?: string;
                };
            };
        };
        same_plan_both_eyes?: boolean;
    };
    medical_history?: any;
    documents?: any;
    extra?: any;
    // Metadata fields (returned by backend)
    _uuid?: string;
    _clinic_uuid?: string;
    _created_at?: string;
    _updated_at?: string;
    status?: string;
}

export interface Clinic {
    clinic_profile: {
        clinic_id: string;
        name: string;
        parent_organization?: string;
        address?: any;
        contact_info?: { phone_work?: string; fax?: string };
        branding?: {
            logo_url?: string;
            primary_color_hex?: string;
        };
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

/**
 * Doctor Context Response - All clinic configuration needed for Doctor's View
 * Matches the structure returned by /clinics/{clinic_id}/doctor-context endpoint
 */
export interface DoctorContextResponse {
    status?: string;
    clinic_id?: string;
    medications: {
        pre_op: {
            antibiotics: Array<{ id: number; name: string }>;
            frequencies: Array<{ id: number; name: string; times_per_day: number }>;
            default_start_days: number;
        };
        post_op: {
            antibiotics: Array<{
                id: number;
                name: string;
                default_frequency: number;
                default_weeks: number;
                allergy_note?: string;
            }>;
            nsaids: Array<{
                id: number;
                name: string;
                default_frequency: number;
                frequency_label: string;
                default_weeks: number;
                variable_frequency?: boolean;
            }>;
            steroids: Array<{
                id: number;
                name: string;
                default_taper: number[];
                default_weeks: number;
            }>;
            glaucoma_drops: Array<{
                id: number;
                name: string;
                category: string;
            }>;
            combination_drops: Array<{
                id: number;
                name: string;
                components: string[];
            }>;
        };
        dropless_option: {
            available: boolean;
            description: string;
            medications: string[];
        };
        frequency_options: Array<{ id: number; label: string; times_per_day: number }>;
    };
    staff?: Array<{
        provider_id: string;
        name: string;
        role: string;
        specialty?: string;
    }>;
    surgical_packages: Array<{
        package_id: string;
        display_name: string;
        description?: string;
        price_cash: number;
        includes_laser: boolean;
        allowed_lens_codes: string[];
    }>;
    lens_inventory: Record<string, any>;
    lens_categories?: string[];
}

export const api = {
    async getPatients(clinicId?: string): Promise<Patient[]> {
        const url = clinicId
            ? `${API_BASE}/patients?clinic_id=${encodeURIComponent(clinicId)}`
            : `${API_BASE}/patients`;
        const res = await authFetch(url);  // Uses authFetch - requires authentication
        if (!res.ok) throw new Error('Failed to fetch patients');
        return res.json();
    },

    async createPatient(data: {
        clinic_id: string;
        first_name: string;
        last_name: string;
        phone: string;
        dob?: string;
        gender?: string;
        email?: string;
    }): Promise<{ status: string; patient: Patient }> {
        const res = await authFetch(`${API_BASE}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to create patient' }));
            throw new Error(error.detail || 'Failed to create patient');
        }
        return res.json();
    },

    async getPatientDetails(id: string): Promise<Patient> {
        const res = await authFetch(`${API_BASE}/patients/${id}`);  // Uses authFetch - requires authentication
        if (!res.ok) throw new Error('Failed to fetch patient details');
        return res.json();
    },

    async askAgent(patientId: string, question: string, clinicId?: string): Promise<AskResponse> {
        const res = await fetch(`${API_BASE}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: patientId, question, clinic_id: clinicId }),
        });
        if (!res.ok) throw new Error('Failed to ask agent');
        return res.json();
    },

    async pregenerateModules(patientId: string, clinicId?: string): Promise<{ status: string }> {
        const res = await fetch(`${API_BASE}/pregenerate-modules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: patientId, clinic_id: clinicId }),
        });
        if (!res.ok) throw new Error('Failed to pregenerate modules');
        return res.json();
    },

    async getClinicDetails(clinicId: string): Promise<Clinic> {
        const res = await fetch(`${API_BASE}/clinics/${clinicId}`);
        if (!res.ok) throw new Error('Failed to fetch clinic details');
        return res.json();
    },

    /**
     * Get list of all active clinics (public endpoint for patient portal selection)
     */
    async getActiveClinics(): Promise<{ clinic_id: string; name: string; address?: any }[]> {
        const res = await fetch(`${API_BASE}/clinics`);
        if (!res.ok) throw new Error('Failed to fetch clinics');
        const data = await res.json();
        return data.clinics || [];
    },

    // --- Doctor Portal Endpoints (Require Authentication) ---
    async uploadPatientDocs(clinicId: string, patientId: string, files: File[]): Promise<any> {
        const formData = new FormData();
        formData.append('clinic_id', clinicId);
        formData.append('patient_id', patientId);
        files.forEach(file => formData.append('files', file));

        // Use authFetch for authenticated request
        const res = await authFetch(`${API_BASE}/doctor/uploads/patient`, {
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
                } catch {/* ignore */ }
            }
            throw new Error(msg);
        }

        return res.json();
    },

    async uploadClinicDocs(clinicId: string, files: File[]): Promise<any> {
        const formData = new FormData();
        formData.append('clinic_id', clinicId);
        files.forEach(file => formData.append('files', file));

        const res = await authFetch(`${API_BASE}/doctor/uploads/clinic`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to upload clinic documents');
        return res.json();
    },

    async getExtractedPatient(clinicId: string, patientId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/extractions/patient?clinic_id=${clinicId}&patient_id=${patientId}`);
        if (!res.ok) throw new Error('Failed to fetch extracted patient data');
        return res.json();
    },

    async getExtractedClinic(clinicId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/extractions/clinic?clinic_id=${clinicId}`);
        if (!res.ok) throw new Error('Failed to fetch extracted clinic data');
        return res.json();
    },

    async getPatientFiles(clinicId: string, patientId: string): Promise<{ files: Array<{ name: string; size?: number; mime_type?: string; created_at?: string }>, count: number }> {
        const res = await authFetch(`${API_BASE}/doctor/patient-files?clinic_id=${clinicId}&patient_id=${patientId}`);
        if (!res.ok) {
            console.warn('Failed to fetch patient files');
            return { files: [], count: 0 };
        }
        return res.json();
    },

    async saveReviewedPatient(clinicId: string, patientId: string, data: any): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/review/patient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinic_id: clinicId, patient_id: patientId, data }),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to save patient data' }));
            throw new Error(error.detail || 'Failed to save patient data');
        }
        return res.json();
    },

    async saveReviewedClinic(clinicId: string, data: any): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/review/clinic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinic_id: clinicId, data }),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to save clinic data' }));
            throw new Error(error.detail || 'Failed to save clinic data');
        }
        return res.json();
    },

    async getReviewedPatient(clinicId: string, patientId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/reviewed/patient?clinic_id=${clinicId}&patient_id=${patientId}`);
        if (!res.ok) return null; // Might not exist yet
        return res.json();
    },

    async getReviewedClinic(clinicId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/reviewed/clinic?clinic_id=${clinicId}`);
        if (!res.ok) return null; // Might not exist yet
        return res.json();
    },

    async getClinicConfig(clinicId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/clinics/${clinicId}`);
        if (!res.ok) return null;
        return res.json();
    },

    async getClinicMedications(clinicId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/clinics/${clinicId}/medications`);
        if (!res.ok) return null;
        return res.json();
    },

    async getClinicPackages(clinicId: string): Promise<any> {
        const res = await fetch(`${API_BASE}/clinics/${clinicId}/packages`);
        if (!res.ok) return null;
        return res.json();
    },

    async getClinicLensInventory(clinicId: string, category?: string): Promise<any> {
        const url = category 
            ? `${API_BASE}/clinics/${clinicId}/lens-inventory?category=${category}`
            : `${API_BASE}/clinics/${clinicId}/lens-inventory`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
    },

    /**
     * Get all clinic context needed for Doctor's View in a single call.
     * Returns medications, staff, packages, and lens inventory.
     * Optimized for performance - reduces multiple API calls to one.
     * REQUIRES AUTHENTICATION - only accessible to logged-in doctors.
     */
    async getDoctorContext(clinicId: string): Promise<DoctorContextResponse | null> {
        const res = await authFetch(`${API_BASE}/clinics/${clinicId}/doctor-context`);
        if (!res.ok) return null;
        return res.json();
    },

    async deletePatientData(clinicId: string, patientId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/doctor/patient?clinic_id=${clinicId}&patient_id=${patientId}`, {
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
                } catch {/* ignore */ }
            }
            throw new Error(msg);
        }
        return res.json();
    },

    async clearPatientChat(patientId: string): Promise<void> {
        const res = await authFetch(`${API_BASE}/patients/${patientId}/chat/clear`, {
            method: 'POST',
        });
        if (!res.ok) {
            // We don't want to break the UI on failure, but log for debugging
            // eslint-disable-next-line no-console
            console.error('Failed to clear patient chat history');
        }
    },

    // =========================================================================
    // FORMS & DOCUMENTS
    // =========================================================================

    async getFormTemplates(clinicId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/forms/templates?clinic_id=${clinicId}`);
        if (!res.ok) throw new Error('Failed to fetch form templates');
        return res.json();
    },

    async uploadFormTemplate(clinicId: string, formType: string, file: File): Promise<any> {
        const formData = new FormData();
        formData.append('clinic_id', clinicId);
        formData.append('form_type', formType);
        formData.append('file', file);

        const res = await authFetch(`${API_BASE}/forms/templates/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            let msg = 'Failed to upload form template';
            try { const body = await res.json(); msg = body?.detail || msg; } catch {}
            throw new Error(msg);
        }
        return res.json();
    },

    async deleteFormTemplate(clinicId: string, formType: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/forms/templates/${formType}?clinic_id=${clinicId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete form template');
        return res.json();
    },

    async getPatientForms(clinicId: string, patientId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/forms?clinic_id=${clinicId}&patient_id=${patientId}`);
        if (!res.ok) throw new Error('Failed to fetch patient forms');
        return res.json();
    },

    async uploadSignedForm(clinicId: string, patientId: string, formType: string, eye: string, file: File): Promise<any> {
        const formData = new FormData();
        formData.append('clinic_id', clinicId);
        formData.append('patient_id', patientId);
        formData.append('form_type', formType);
        formData.append('eye', eye);
        formData.append('file', file);

        const res = await authFetch(`${API_BASE}/forms/signed/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            let msg = 'Failed to upload signed form';
            try { const body = await res.json(); msg = body?.detail || msg; } catch {}
            throw new Error(msg);
        }
        return res.json();
    },

    async getFormDownloadUrl(clinicId: string, formType: string, docType: 'blank' | 'signed', patientId?: string, eye?: string): Promise<string> {
        let url = `${API_BASE}/forms/download/${formType}?clinic_id=${clinicId}&doc_type=${docType}`;
        if (patientId) url += `&patient_id=${patientId}`;
        if (eye) url += `&eye=${eye}`;

        const res = await authFetch(url);
        if (!res.ok) throw new Error('Failed to get download URL');
        const data = await res.json();
        return data.url;
    },

    // =========================================================================
    // DASHBOARD STATISTICS
    // =========================================================================

    /**
     * Get dashboard statistics for the current clinic
     * Returns total patients, today's surgeries, pending reviews, alerts, and surgery schedule
     */
    async getDashboardStats(): Promise<DashboardResponse | null> {
        try {
            const res = await authFetch(`${API_BASE}/dashboard/stats`);
            if (!res.ok) {
                console.error('[API] Failed to fetch dashboard stats:', res.status);
                return null;
            }
            return res.json();
        } catch (e) {
            console.error('[API] Error fetching dashboard stats:', e);
            return null;
        }
    },

    // =========================================================================
    // USER MANAGEMENT (Clinic Admin)
    // =========================================================================

    /**
     * List all users in the current clinic
     */
    async getClinicUsers(): Promise<ClinicUsersResponse> {
        const res = await authFetch(`${API_BASE}/api/users`);
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    /**
     * Invite a new user to the clinic
     */
    async inviteUser(data: InviteUserRequest): Promise<any> {
        const res = await authFetch(`${API_BASE}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to invite user' }));
            throw new Error(error.detail || 'Failed to invite user');
        }
        return res.json();
    },

    /**
     * Update a user's information
     */
    async updateUser(userId: string, data: UpdateUserRequest): Promise<any> {
        const res = await authFetch(`${API_BASE}/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to update user' }));
            throw new Error(error.detail || 'Failed to update user');
        }
        return res.json();
    },

    /**
     * Deactivate a user (soft delete)
     */
    async deactivateUser(userId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/api/users/${userId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to deactivate user' }));
            throw new Error(error.detail || 'Failed to deactivate user');
        }
        return res.json();
    },

    /**
     * Reactivate a suspended user
     */
    async reactivateUser(userId: string): Promise<any> {
        const res = await authFetch(`${API_BASE}/api/users/${userId}/reactivate`, {
            method: 'POST',
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to reactivate user' }));
            throw new Error(error.detail || 'Failed to reactivate user');
        }
        return res.json();
    },

    // =========================================================================
    // CLINIC REGISTRATION (Self-Service)
    // =========================================================================

    /**
     * Register a new clinic (self-service)
     * Creates both the clinic and the first admin user
     */
    async registerClinic(data: RegisterClinicRequest): Promise<RegisterClinicResponse> {
        const res = await fetch(`${API_BASE}/api/auth/register-clinic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Registration failed' }));
            throw new Error(error.detail || 'Registration failed');
        }
        return res.json();
    },
};

// =============================================================================
// TYPE DEFINITIONS FOR USER MANAGEMENT
// =============================================================================

export interface ClinicUser {
    id: string;
    email: string;
    name: string;
    role: 'clinic_admin' | 'clinic_user';
    status: 'active' | 'suspended' | 'invited';
    phone?: string;
    specialization?: string;
    created_at: string;
    updated_at?: string;
}

export interface ClinicUsersResponse {
    status: string;
    clinic_id: string;
    clinic_name: string;
    total: number;
    users: ClinicUser[];
}

export interface InviteUserRequest {
    email: string;
    name: string;
    role: 'clinic_admin' | 'clinic_user';
    password: string;
    phone?: string;
    specialization?: string;
}

export interface UpdateUserRequest {
    name?: string;
    role?: 'clinic_admin' | 'clinic_user';
    phone?: string;
    specialization?: string;
    status?: 'active' | 'suspended';
}

// =============================================================================
// CLINIC REGISTRATION TYPES
// =============================================================================

export interface RegisterClinicRequest {
    clinic_name: string;
    clinic_address?: string;
    clinic_city?: string;
    clinic_state?: string;
    clinic_zip?: string;
    clinic_phone?: string;
    admin_name: string;
    admin_email: string;
    admin_password: string;
}

export interface RegisterClinicResponse {
    message: string;
    clinic_id: string;
    clinic_name: string;
    admin_email: string;
    status: string;
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface DashboardStats {
    total_patients: number;
    todays_surgeries: number;
    pending_review: number;
    alerts: number;
}

export interface TodaySurgery {
    patient_id: string;
    patient_uuid: string;
    patient_name: string;
    eye: 'OD' | 'OS';
    arrival_time: string;
    surgery_type: string;
    lens: string;
    is_ready: boolean;
    status: 'ready' | 'pending';
}

export interface DashboardResponse {
    status: string;
    clinic_id: string;
    stats: DashboardStats;
    todays_surgery_schedule: TodaySurgery[];
    generated_at: string;
}

// =============================================================================
// ADMIN API TYPES (Super Admin)
// =============================================================================

export interface AdminClinic {
    id: string;
    clinic_id: string;
    name: string;
    address: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
    };
    contact: {
        phone?: string;
        email?: string;
    };
    settings: Record<string, any>;
    status: 'active' | 'pending' | 'suspended' | 'inactive';
    created_at: string;
    updated_at: string;
}

export interface AdminClinicsResponse {
    status: string;
    total: number;
    clinics: AdminClinic[];
}

export interface AdminClinicStatsResponse {
    status: string;
    clinic_id: string;
    clinic_name: string;
    stats: {
        patients: { total: number; by_status: Record<string, number> };
        users: { total: number; active: number };
    };
}

export interface AdminOverviewResponse {
    status: string;
    overview: {
        clinics: { total: number; active: number };
        patients: { total: number };
        users: { total: number };
    };
}

// =============================================================================
// ADMIN API FUNCTIONS (Super Admin)
// =============================================================================

// =============================================================================
// PATIENT AUTH API (OTP-based)
// =============================================================================

const PATIENT_TOKEN_KEY = 'cataract_patient_token';
const PATIENT_DATA_KEY = 'cataract_patient_data';

export interface PatientAuthData {
    id: string;
    patient_id: string;
    name: { first: string; last: string };
    clinic_id: string;
    clinic_name: string;
}

export interface RequestOTPResponse {
    message: string;
    phone: string;
    expires_in_seconds: number;
    dev_otp?: string; // Only in dev mode
}

export interface VerifyOTPResponse {
    message: string;
    access_token: string;
    token_type: string;
    expires_in_days: number;
    patient: PatientAuthData;
}

export const patientAuthStorage = {
    getToken: (): string | null => localStorage.getItem(PATIENT_TOKEN_KEY),
    getPatient: (): PatientAuthData | null => {
        const data = localStorage.getItem(PATIENT_DATA_KEY);
        return data ? JSON.parse(data) : null;
    },
    setAuth: (token: string, patient: PatientAuthData) => {
        localStorage.setItem(PATIENT_TOKEN_KEY, token);
        localStorage.setItem(PATIENT_DATA_KEY, JSON.stringify(patient));
    },
    clearAuth: () => {
        localStorage.removeItem(PATIENT_TOKEN_KEY);
        localStorage.removeItem(PATIENT_DATA_KEY);
    },
    isAuthenticated: (): boolean => !!localStorage.getItem(PATIENT_TOKEN_KEY),
};

export const patientAuthApi = {
    /**
     * Request OTP for patient login
     */
    async requestOTP(phone: string, clinicId: string): Promise<RequestOTPResponse> {
        const res = await fetch(`${API_BASE}/api/patient/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, clinic_id: clinicId }),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to send OTP' }));
            throw new Error(error.detail || 'Failed to send OTP');
        }
        return res.json();
    },

    /**
     * Verify OTP and login
     */
    async verifyOTP(phone: string, otp: string, clinicId: string): Promise<VerifyOTPResponse> {
        const res = await fetch(`${API_BASE}/api/patient/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp, clinic_id: clinicId }),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Invalid OTP' }));
            throw new Error(error.detail || 'Invalid OTP');
        }
        const data: VerifyOTPResponse = await res.json();
        // Store auth data
        patientAuthStorage.setAuth(data.access_token, data.patient);
        return data;
    },

    /**
     * Get current patient profile
     */
    async getProfile(): Promise<PatientAuthData | null> {
        const token = patientAuthStorage.getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE}/api/patient/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            patientAuthStorage.clearAuth();
            return null;
        }
        return res.json();
    },

    /**
     * Get current patient's full data (clinical context, module content, etc.)
     * This uses patient auth, not clinic user auth.
     */
    async getMyData(): Promise<Patient | null> {
        const token = patientAuthStorage.getToken();
        if (!token) return null;

        const res = await fetch(`${API_BASE}/api/patient/auth/me/data`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to fetch patient data' }));
            throw new Error(error.detail || 'Failed to fetch patient data');
        }
        return res.json();
    },

    /**
     * Update medication progress (pre_op or post_op drops)
     * Used by BeforeSurgeryModal and AfterSurgeryModal when patient is logged in
     */
    async updateMedicationProgress(
        medicationType: 'pre_op' | 'post_op',
        progress: Record<string, any>
    ): Promise<{ status: string; message: string }> {
        const token = patientAuthStorage.getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const res = await fetch(`${API_BASE}/api/patient/auth/me/medications`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                medication_type: medicationType,
                progress: progress,
            }),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to save medication progress' }));
            throw new Error(error.detail || 'Failed to save medication progress');
        }

        return res.json();
    },

    /**
     * Clear the current patient's chat history
     */
    async clearMyChat(): Promise<void> {
        const token = patientAuthStorage.getToken();
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/patient/auth/me/chat`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            console.error('Failed to clear patient chat history');
        }
    },

    /**
     * Get combined forms status (templates + signed copies) for current patient
     */
    async getMyForms(): Promise<any> {
        const token = patientAuthStorage.getToken();
        if (!token) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE}/forms/patient-view`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to load forms' }));
            throw new Error(error.detail || 'Failed to load forms');
        }
        return res.json();
    },

    /**
     * Get download URL for a form (blank template or signed copy)
     */
    async getFormDownloadUrl(formType: string, docType: 'blank' | 'signed', eye?: string): Promise<string> {
        const token = patientAuthStorage.getToken();
        if (!token) throw new Error('Not authenticated');

        let url = `${API_BASE}/forms/patient-download/${formType}?doc_type=${docType}`;
        if (eye) url += `&eye=${eye}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to get download URL' }));
            throw new Error(error.detail || 'Failed to get download URL');
        }
        const data = await res.json();
        return data.url;
    },

    /**
     * Logout patient
     */
    async logout(): Promise<void> {
        const token = patientAuthStorage.getToken();
        patientAuthStorage.clearAuth();
        if (token) {
            try {
                await fetch(`${API_BASE}/api/patient/auth/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
            } catch (e) {
                // Ignore logout errors
            }
        }
    },
};

export const adminApi = {
    /**
     * Get all clinics (super admin only)
     */
    async getClinics(statusFilter?: string): Promise<AdminClinicsResponse> {
        const url = statusFilter
            ? `${API_BASE}/api/admin/clinics?status_filter=${statusFilter}`
            : `${API_BASE}/api/admin/clinics`;
        const res = await authFetch(url);
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to fetch clinics' }));
            throw new Error(error.detail || 'Failed to fetch clinics');
        }
        return res.json();
    },

    /**
     * Get clinic details (super admin only)
     */
    async getClinicDetails(clinicUuid: string): Promise<{ status: string; clinic: AdminClinic }> {
        const res = await authFetch(`${API_BASE}/api/admin/clinics/${clinicUuid}`);
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to fetch clinic' }));
            throw new Error(error.detail || 'Failed to fetch clinic');
        }
        return res.json();
    },

    /**
     * Update clinic (super admin only) - used for approving/rejecting
     */
    async updateClinic(clinicUuid: string, data: {
        name?: string;
        status?: 'active' | 'pending' | 'suspended' | 'inactive';
        address?: Record<string, any>;
        contact?: Record<string, any>;
    }): Promise<{ status: string; clinic: AdminClinic }> {
        const res = await authFetch(`${API_BASE}/api/admin/clinics/${clinicUuid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to update clinic' }));
            throw new Error(error.detail || 'Failed to update clinic');
        }
        return res.json();
    },

    /**
     * Get clinic stats (super admin only)
     */
    async getClinicStats(clinicUuid: string): Promise<AdminClinicStatsResponse> {
        const res = await authFetch(`${API_BASE}/api/admin/clinics/${clinicUuid}/stats`);
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to fetch clinic stats' }));
            throw new Error(error.detail || 'Failed to fetch clinic stats');
        }
        return res.json();
    },

    /**
     * Get platform overview (super admin only)
     */
    async getOverview(): Promise<AdminOverviewResponse> {
        const res = await authFetch(`${API_BASE}/api/admin/overview`);
        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: 'Failed to fetch overview' }));
            throw new Error(error.detail || 'Failed to fetch overview');
        }
        return res.json();
    },
};
