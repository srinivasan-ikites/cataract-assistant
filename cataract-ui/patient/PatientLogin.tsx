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
  Shield,
  Eye,
} from 'lucide-react';
import { patientAuthApi, RequestOTPResponse } from '../services/api';

interface PatientLoginProps {
  clinicId: string;
  clinicName?: string;
  onLoginSuccess: () => void;
}

type Step = 'phone' | 'otp';

const PatientLogin: React.FC<PatientLoginProps> = ({ clinicId, clinicName, onLoginSuccess }) => {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(0);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone
    const cleanPhone = phone.replace(/\D/g, '');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200 mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Portal</h1>
          {clinicName && (
            <p className="text-slate-500 mt-1">{clinicName}</p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          {/* Dev Mode OTP Toast */}
          {devOtp && step === 'otp' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-[fadeIn_0.3s_ease-out]">
              <Eye className="text-amber-600 shrink-0 mt-0.5" size={20} />
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
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-400">
                    <Phone size={18} />
                    <span className="text-slate-600 font-medium">+91</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit number"
                    className="w-full pl-24 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  We'll send you a one-time verification code
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Get OTP
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Step 2: OTP Verification */
            <form onSubmit={handleOtpSubmit}>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Enter OTP
                  </label>
                  {otpExpiry > 0 && (
                    <span className="text-xs text-slate-500">
                      Expires in {formatTime(otpExpiry)}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-500 mb-4">
                  Code sent to <span className="font-semibold text-slate-700">+91 {phone}</span>
                </p>

                {/* OTP Input Boxes */}
                <div className="flex gap-2 justify-center mb-4">
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
                      className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
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
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
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
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Verify & Login
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Secure patient portal for your cataract surgery journey
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default PatientLogin;
