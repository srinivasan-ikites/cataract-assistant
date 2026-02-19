/**
 * Patient Login Page - OTP based authentication
 *
 * Flow:
 * 1. Patient enters phone number
 * 2. OTP is sent (in dev mode, shown in toast)
 * 3. Patient enters OTP
 * 4. On success, redirected to patient portal
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye as EyeIcon,
  ShieldCheck,
} from 'lucide-react';
import { patientAuthApi, RequestOTPResponse } from '../services/api';
import Logo from '../components/Logo';

interface PatientLoginProps {
  clinicId: string;
  clinicName?: string;
  clinicLogoUrl?: string;
  onLoginSuccess: () => void;
}

type Step = 'phone' | 'otp';

const PatientLogin: React.FC<PatientLoginProps> = ({ clinicId, clinicName, clinicLogoUrl, onLoginSuccess }) => {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Format phone number as US format: (XXX) XXX XXXX
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  // Get raw digits from formatted phone
  const getPhoneDigits = (formatted: string): string => {
    return formatted.replace(/\D/g, '');
  };

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // OTP expiry timer
  useEffect(() => {
    if (otpExpiry > 0) {
      const timer = setTimeout(() => setOtpExpiry(otpExpiry - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpExpiry]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');

    // If user cleared the field, allow it
    if (digits.length === 0) {
      setPhone('');
      setError(null);
      return;
    }

    const formatted = formatPhoneNumber(digits);
    setPhone(formatted);
    setError(null);
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone
    const cleanPhone = getPhoneDigits(phone);
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response: RequestOTPResponse = await patientAuthApi.requestOTP(cleanPhone, clinicId);

      // Set countdown for resend (60 seconds)
      setCountdown(60);
      setOtpExpiry(response.expires_in_seconds);

      // In dev mode, show the OTP
      if (response.dev_otp) {
        setDevOtp(response.dev_otp);
      }

      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      // Focus last filled or next empty
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    } else {
      // Single digit
      const newOtp = [...otp];
      newOtp[index] = value.replace(/\D/g, '');
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
    setError(null);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      await patientAuthApi.verifyOTP(cleanPhone, otpValue, clinicId);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setError(null);
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const response = await patientAuthApi.requestOTP(cleanPhone, clinicId);
      setCountdown(60);
      setOtpExpiry(response.expires_in_seconds);
      if (response.dev_otp) {
        setDevOtp(response.dev_otp);
      }
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayName = clinicName || clinicId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 md:p-6">
      {/* Main Card */}
      <div className="relative w-full max-w-[1040px] rounded-2xl shadow-2xl shadow-slate-300/50 overflow-hidden flex flex-col md:flex-row bg-white animate-[scaleIn_0.3s_ease-out]">

        {/* ─── Left: Branded Panel (desktop only) ─── */}
        <div className="hidden md:flex md:w-[44%] relative overflow-hidden flex-col items-center justify-center px-10 py-12 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800">
          {/* Soft decorations */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border-[3px] border-white/[0.08]" />
            <div className="absolute bottom-20 right-12 w-32 h-32 rounded-full border-[2px] border-white/[0.06]" />
            <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full border-[2px] border-white/[0.05]" />
            <div className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Clinic logo or default eye */}
            <div className="w-24 h-24 rounded-full bg-white/80 backdrop-blur-sm border border-white/40 flex items-center justify-center mb-8 shadow-xl shadow-black/10">
              {clinicLogoUrl ? (
                <img src={clinicLogoUrl} alt={displayName} className="w-16 h-16 rounded-full object-contain" />
              ) : (
                <EyeIcon size={36} className="text-violet-600" />
              )}
            </div>

            {/* Heading */}
            <h1
              className="text-4xl text-white leading-tight mb-3"
              style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'normal', fontWeight: 600 }}
            >
              {displayName}
            </h1>

            {/* Tagline */}
            <p className="text-white/75 text-base leading-relaxed max-w-[280px]">
              Your personalized cataract surgery guide.
              <br />
              Everything you need to know, in one place.
            </p>

            {/* Trust badge */}
            <div className="mt-8 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm border border-white/10">
              <ShieldCheck size={16} className="text-white/70" />
              <span className="text-white/70 text-sm">Secure &amp; encrypted portal</span>
            </div>
          </div>
        </div>

        {/* ─── Right: Form Panel ─── */}
        <div className="flex-1 relative px-8 py-10 md:px-12 md:py-12">
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#7c3aed 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          <div className="relative z-10 max-w-md mx-auto">
            {/* Mobile-only compact branding */}
            <div className="md:hidden flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center mb-3">
                {clinicLogoUrl ? (
                  <img src={clinicLogoUrl} alt={displayName} className="w-10 h-10 rounded-full object-contain" />
                ) : (
                  <EyeIcon size={28} className="text-violet-600" />
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-800">{displayName}</h1>
              <p className="text-slate-500 text-sm mt-1">Your personalized surgery guide</p>
            </div>

            {/* Form Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                {step === 'phone' ? 'Welcome' : 'Verify Your Number'}
              </h2>
              <p className="text-slate-500 text-sm mt-1.5">
                {step === 'phone'
                  ? 'Enter your phone number to access your surgery guide'
                  : <>Code sent to <span className="font-semibold text-slate-700">+1 {phone}</span></>
                }
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                step === 'phone'
                  ? 'bg-violet-600 text-white'
                  : 'bg-emerald-500 text-white'
              }`}>
                {step === 'otp' ? <CheckCircle size={16} /> : '1'}
              </div>
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full bg-violet-500 rounded-full transition-all duration-500 ${
                  step === 'otp' ? 'w-full' : 'w-0'
                }`} />
              </div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                step === 'otp'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}>
                2
              </div>
            </div>

            {/* Dev Mode OTP Toast */}
            {devOtp && step === 'otp' && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-[fadeIn_0.3s_ease-out]">
                <EyeIcon className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Dev Mode - OTP</p>
                  <p className="text-2xl font-mono font-bold text-amber-900 tracking-widest mt-1">
                    {devOtp}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    This is only shown in development mode
                  </p>
                </div>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 animate-[fadeIn_0.2s_ease-out]">
                <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            {step === 'phone' ? (
              /* Step 1: Phone Number */
              <form onSubmit={handlePhoneSubmit}>
                <div className="mb-6">
                  <label className="block text-base font-semibold text-slate-700 mb-2">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400">
                      <Phone size={18} />
                      <span className="text-slate-600 font-medium">+1</span>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="(555) 123 4567"
                      className="w-full pl-20 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    We'll send you a one-time verification code
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || getPhoneDigits(phone).length !== 10}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-lg font-semibold rounded-xl shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300/50 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                >
                  {loading ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Get OTP
                      <ArrowRight size={22} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2: OTP Verification */
              <form onSubmit={handleOtpSubmit}>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-base font-semibold text-slate-700">
                      Enter Verification Code
                    </label>
                    {otpExpiry > 0 && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        Expires in {formatTime(otpExpiry)}
                      </span>
                    )}
                  </div>

                  {/* OTP Input Boxes */}
                  <div className="flex gap-2.5 justify-center mb-5">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { otpInputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all"
                        disabled={loading}
                      />
                    ))}
                  </div>

                  {/* Resend OTP */}
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-slate-500">
                        Resend OTP in <span className="font-semibold">{countdown}s</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="text-sm font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1.5 mx-auto"
                      >
                        <RefreshCw size={14} />
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join('').length !== 6}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-lg font-semibold rounded-xl shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300/50 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
                >
                  {loading ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={22} />
                      Verify &amp; Login
                    </>
                  )}
                </button>

                {/* Change Phone */}
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setOtp(['', '', '', '', '', '']);
                    setDevOtp(null);
                    setError(null);
                  }}
                  className="w-full mt-4 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Change phone number
                </button>
              </form>
            )}

            {/* Footer */}
            <div className="mt-8 space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-sm text-slate-400">
                <ShieldCheck size={15} />
                <span>Secure, encrypted patient portal</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <span>Powered by</span>
                <Logo size="sm" />
              </div>
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

export default PatientLogin;
