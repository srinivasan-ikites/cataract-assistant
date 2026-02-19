import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Phone, User, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

interface RegisterPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string;
  onSuccess: (patientId: string) => void;
}

const RegisterPatientModal: React.FC<RegisterPatientModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});
  const toast = useToast();
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFirstName('');
      setLastName('');
      setPhone('');
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  // Format phone number as US format: (XXX) XXX XXXX
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');

    // If user cleared the field, allow it
    if (digits.length === 0) {
      setPhone('');
      if (errors.phone) {
        setErrors((prev) => ({ ...prev, phone: undefined }));
      }
      return;
    }

    const formatted = formatPhoneNumber(digits);
    setPhone(formatted);
    // Clear error when user types
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) {
      newErrors.phone = 'Phone number is required';
    } else if (phoneDigits.length !== 10) {
      newErrors.phone = 'Phone number must be 10 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const phoneDigits = phone.replace(/\D/g, '');
      const result = await api.createPatient({
        clinic_id: clinicId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phoneDigits,
      });

      toast.success('Patient Registered', `${firstName} ${lastName} has been added successfully`);
      onSuccess(result.patient.patient_id);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to register patient';
      toast.error('Registration Failed', errorMsg);

      // Show specific field error if it's a duplicate phone
      if (errorMsg.toLowerCase().includes('phone') && errorMsg.toLowerCase().includes('exists')) {
        setErrors((prev) => ({ ...prev, phone: 'This phone number is already registered' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 !m-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isSubmitting ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-200">
              <UserPlus size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Register Patient</h2>
              <p className="text-xs text-slate-500">Add a new patient to your clinic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* First Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              First Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={firstInputRef}
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                }}
                disabled={isSubmitting}
                placeholder="Enter first name"
                className={`
                  w-full pl-11 pr-4 py-3 rounded-xl border text-sm
                  transition-all outline-none
                  ${errors.firstName
                    ? 'border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
              />
            </div>
            {errors.firstName && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Last Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
                }}
                disabled={isSubmitting}
                placeholder="Enter last name"
                className={`
                  w-full pl-11 pr-4 py-3 rounded-xl border text-sm
                  transition-all outline-none
                  ${errors.lastName
                    ? 'border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
              />
            </div>
            {errors.lastName && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.lastName}</p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                disabled={isSubmitting}
                placeholder="(555) 123 4567"
                className={`
                  w-full pl-11 pr-4 py-3 rounded-xl border text-sm
                  transition-all outline-none
                  ${errors.phone
                    ? 'border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                    : 'border-slate-200 bg-slate-50 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 focus:bg-white'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
              />
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.phone}</p>
            )}
            <p className="mt-1.5 text-xs text-slate-400">
              Required for patient login via OTP
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-teal-200 hover:shadow-xl hover:from-teal-700 hover:to-teal-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Register Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPatientModal;
