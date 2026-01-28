/**
 * Authentication Context
 *
 * Provides authentication state and functions to the entire app.
 * Handles:
 * - Login/Logout
 * - Checking if user is authenticated
 * - Loading user profile on app start
 * - Auto-redirect to login if not authenticated
 *
 * Usage:
 *   const { user, login, logout, isAuthenticated, isLoading } = useAuth();
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, authApi, authStorage, AUTH_SESSION_EXPIRED_EVENT } from '../services/api';

// =============================================================================
// TYPES
// =============================================================================

interface AuthContextType {
    // State
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check authentication status on mount
    useEffect(() => {
        const checkAuth = async () => {
            console.log('[AuthContext] Checking authentication status...');

            // First, check if we have stored tokens
            if (!authStorage.isAuthenticated()) {
                console.log('[AuthContext] No stored tokens found');
                setIsLoading(false);
                return;
            }

            // Try to get user from storage first (for quick UI)
            const storedUser = authStorage.getUser();
            if (storedUser) {
                console.log('[AuthContext] Found stored user:', storedUser.name);
                setUser(storedUser);
            }

            // Validate token with backend
            try {
                const userProfile = await authApi.getCurrentUser();

                if (userProfile) {
                    console.log('[AuthContext] Token valid, user:', userProfile.name);
                    // Update user with fresh data from backend
                    const updatedUser: AuthUser = {
                        id: userProfile.id,
                        email: userProfile.email,
                        name: userProfile.name,
                        role: userProfile.role as AuthUser['role'],
                        clinic_id: userProfile.clinic_id,
                        clinic_name: userProfile.clinic_name,
                    };
                    setUser(updatedUser);
                } else {
                    console.log('[AuthContext] Token invalid, clearing auth');
                    setUser(null);
                    authStorage.clearTokens();
                }
            } catch (e) {
                console.log('[AuthContext] Auth check failed:', e);
                setUser(null);
                authStorage.clearTokens();
            }

            setIsLoading(false);
        };

        checkAuth();
    }, []);

    // Listen for session expired events from authFetch
    useEffect(() => {
        const handleSessionExpired = (event: Event) => {
            const customEvent = event as CustomEvent<{ reason: string }>;
            console.log('[AuthContext] Session expired event received:', customEvent.detail?.reason);

            // Clear user state
            setUser(null);

            // Set error message so UI can display it
            setError(customEvent.detail?.reason || 'Your session has expired. Please log in again.');
        };

        window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);

        return () => {
            window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
        };
    }, []);

    // Login function
    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        console.log('[AuthContext] Login attempt for:', email);
        setError(null);
        setIsLoading(true);

        try {
            const response = await authApi.login(email, password);
            console.log('[AuthContext] Login successful:', response.user.name);
            setUser(response.user);
            setIsLoading(false);
            return true;
        } catch (e: any) {
            console.log('[AuthContext] Login failed:', e.message);
            setError(e.message || 'Login failed');
            setIsLoading(false);
            return false;
        }
    }, []);

    // Logout function
    const logout = useCallback(async () => {
        console.log('[AuthContext] Logging out...');
        setIsLoading(true);

        await authApi.logout();
        setUser(null);
        setError(null);

        console.log('[AuthContext] Logged out successfully');
        setIsLoading(false);
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Context value
    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        clearError,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// =============================================================================
// HOOK
// =============================================================================

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};

// =============================================================================
// EXPORTS
// =============================================================================

export default AuthContext;
