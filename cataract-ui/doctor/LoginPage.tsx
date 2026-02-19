/**
 * Login Page for Clinic Users (Doctors, Staff, Admins)
 *
 * Features:
 * - Email + Password login
 * - Error display
 * - Loading state
 * - Split-screen branded layout
 */

import React, { useState, FormEvent } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, Mail, Lock } from 'lucide-react';
import Logo from '../components/Logo';
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
    const [rememberMe, setRememberMe] = useState(false);
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
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 md:p-6">
            {/* Main Card */}
            <div className="relative w-full max-w-[1040px] rounded-2xl shadow-2xl shadow-slate-300/50 overflow-hidden flex flex-col md:flex-row bg-white animate-[scaleIn_0.3s_ease-out]">

                {/* ─── Left: Branded Panel ─── */}
                <div className="hidden md:flex md:w-[44%] relative overflow-hidden flex-col items-center justify-center px-10 py-12 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-900">
                    {/* Soft decorations — circles only */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border-[3px] border-white/[0.08]" />
                        <div className="absolute bottom-20 right-12 w-32 h-32 rounded-full border-[2px] border-white/[0.06]" />
                        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full border-[2px] border-white/[0.05]" />
                        {/* Subtle dot grid */}
                        <div className="absolute inset-0 opacity-[0.04]"
                            style={{
                                backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
                                backgroundSize: '20px 20px',
                            }}
                        />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center text-center">
                        {/* Logo in light circle — high contrast for the blue logo */}
                        <div className="w-28 h-28 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 flex items-center justify-center mb-8 shadow-xl shadow-black/10">
                            <Logo size="xl" />
                        </div>

                        {/* Heading — Playfair Display italic */}
                        <h1
                            className="text-4xl text-white leading-tight mb-4"
                            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 600 }}
                        >
                            Welcome to Mira
                        </h1>

                        {/* Tagline */}
                        <p className="text-white/75 text-base leading-relaxed max-w-[280px]">
                            Your trusted AI assistant for cataract patient education.
                            <br />
                            Empowering clarity, one patient at a time.
                        </p>
                    </div>
                </div>

                {/* ─── Right: Form Panel ─── */}
                <div className="flex-1 relative px-8 py-10 md:px-12 md:py-12">
                    {/* Subtle dot pattern background */}
                    <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#0d9488 1px, transparent 1px)',
                            backgroundSize: '22px 22px',
                        }}
                    />

                    <div className="relative z-10 max-w-md mx-auto">
                        {/* Mobile-only branding (compact) */}
                        <div className="md:hidden flex flex-col items-center mb-8">
                            <Logo size="lg" />
                            <h1
                                className="text-2xl text-teal-800 mt-3"
                                style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 600 }}
                            >
                                Welcome to Mira
                            </h1>
                        </div>

                        {/* Form Header */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Sign In</h2>
                            <p className="text-slate-500 text-sm mt-1.5">Access the Clinic Staff Portal</p>
                        </div>

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
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="doctor@clinic.com"
                                        disabled={isLoading}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        autoComplete="email"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        disabled={isLoading}
                                        className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

                            {/* Remember Me + Forgot Password */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30 cursor-pointer"
                                    />
                                    <span className="text-sm text-slate-600">Remember me</span>
                                </label>
                                <button
                                    type="button"
                                    className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                                    onClick={() => alert('Password reset coming soon!')}
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-teal-200 hover:shadow-xl hover:shadow-teal-300/50 hover:brightness-110 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:shadow-lg"
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
                        <div className="relative my-7">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 bg-white text-slate-400 font-medium">
                                    Clinic Staff Portal
                                </span>
                            </div>
                        </div>

                        {/* Help Text */}
                        <div className="text-center text-sm text-slate-500 space-y-2">
                            <p>
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    className="font-semibold text-teal-600 hover:text-teal-700 transition-colors"
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

                        {/* Footer */}
                        <div className="text-center mt-8 space-y-1">
                            <p className="text-xs text-slate-400">
                                &copy; {new Date().getFullYear()} Mira AI. All rights reserved.
                            </p>
                            <p className="text-xs text-slate-400">
                                Protected by reCAPTCHA and Subject to{' '}
                                <span className="underline cursor-pointer hover:text-slate-500">Privacy Policy</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
