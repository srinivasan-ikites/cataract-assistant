/**
 * Login Page for Clinic Users (Doctors, Staff, Admins)
 *
 * Features:
 * - Email + Password login
 * - Error display
 * - Loading state
 * - Remember me (optional future feature)
 */

import React, { useState, FormEvent } from 'react';
import { Eye, EyeOff, LogIn, Building2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
    onLoginSuccess?: () => void;
    onRegister?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onRegister }) => {
    const { login, isLoading, error, clearError } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        clearError();

        // Basic validation
        if (!email.trim()) {
            setLocalError('Please enter your email');
            return;
        }
        if (!password) {
            setLocalError('Please enter your password');
            return;
        }

        console.log('[LoginPage] Submitting login form');

        const success = await login(email, password);

        if (success) {
            console.log('[LoginPage] Login successful, calling onLoginSuccess');
            onLoginSuccess?.();
        }
    };

    const displayError = localError || error;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.15] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                }}
            />

            {/* Login Card */}
            <div className="relative w-full max-w-md">
                {/* Logo and Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
                        <Building2 className="text-white" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Cataract Counsellor
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm font-medium">
                        Sign in to your clinic portal
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Alert */}
                        {displayError && (
                            <div className={`flex items-start gap-3 p-4 border rounded-xl animate-[fadeIn_0.2s_ease-out] ${
                                displayError.toLowerCase().includes('session') || displayError.toLowerCase().includes('expired')
                                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                                    : 'bg-rose-50 border-rose-100 text-rose-700'
                            }`}>
                                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-sm">
                                        {displayError.toLowerCase().includes('session') || displayError.toLowerCase().includes('expired')
                                            ? 'Session Expired'
                                            : 'Login Failed'}
                                    </p>
                                    <p className={`text-sm mt-0.5 ${
                                        displayError.toLowerCase().includes('session') || displayError.toLowerCase().includes('expired')
                                            ? 'text-amber-600'
                                            : 'text-rose-600'
                                    }`}>{displayError}</p>
                                </div>
                            </div>
                        )}

                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="doctor@clinic.com"
                                disabled={isLoading}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                autoComplete="email"
                                autoFocus
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    disabled={isLoading}
                                    className="w-full px-4 py-3 pr-12 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={isLoading}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Forgot Password Link (placeholder for future) */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                onClick={() => alert('Password reset coming soon!')}
                            >
                                Forgot password?
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    <span>Sign In</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-white text-slate-400 font-medium">
                                Clinic Staff Portal
                            </span>
                        </div>
                    </div>

                    {/* Help Text */}
                    <div className="text-center text-sm text-slate-500 space-y-2">
                        <p>
                            New clinic?{' '}
                            <button
                                type="button"
                                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                onClick={onRegister}
                            >
                                Register your clinic
                            </button>
                        </p>
                        <p>
                            Staff member?{' '}
                            <button
                                type="button"
                                className="font-semibold text-slate-600 hover:text-slate-700 transition-colors"
                                onClick={() => alert('Contact your clinic administrator for access.')}
                            >
                                Contact your admin
                            </button>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400 mt-6">
                    &copy; {new Date().getFullYear()} Cataract Counsellor. All rights reserved.
                </p>
            </div>

            {/* CSS for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
