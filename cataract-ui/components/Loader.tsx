import React, { useEffect, useState } from 'react';
import { Eye, Sparkles } from 'lucide-react';

type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';
type LoaderVariant = 'default' | 'medical' | 'minimal' | 'pulse';

interface LoaderProps {
  /** Size of the loader */
  size?: LoaderSize;
  /** Visual variant */
  variant?: LoaderVariant;
  /** Optional message to display */
  message?: string;
  /** Optional sub-message */
  subMessage?: string;
  /** Whether to show as full-screen overlay */
  fullScreen?: boolean;
  /** Custom className for container */
  className?: string;
  /** Show progress indicator (animated dots) */
  showProgress?: boolean;
}

const sizeConfig = {
  sm: { icon: 16, ring: 32, text: 'text-xs', gap: 'gap-2' },
  md: { icon: 24, ring: 48, text: 'text-sm', gap: 'gap-3' },
  lg: { icon: 32, ring: 64, text: 'text-base', gap: 'gap-4' },
  xl: { icon: 48, ring: 96, text: 'text-lg', gap: 'gap-5' },
};

/**
 * Beautiful, modern loader component with multiple variants
 * Designed for medical/clinical applications with a professional feel
 */
const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  variant = 'default',
  message,
  subMessage,
  fullScreen = false,
  className = '',
  showProgress = true,
}) => {
  const [dots, setDots] = useState('');
  const config = sizeConfig[size];

  // Animated dots for progress indication
  useEffect(() => {
    if (!showProgress) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, [showProgress]);

  const renderDefaultLoader = () => (
    <div className="relative flex items-center justify-center">
      {/* Outer rotating ring */}
      <div
        className="absolute rounded-full border-2 border-slate-200 animate-[spin_3s_linear_infinite]"
        style={{ width: config.ring, height: config.ring }}
      >
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-lg shadow-blue-200" />
      </div>
      
      {/* Inner counter-rotating ring */}
      <div
        className="absolute rounded-full border border-blue-100 animate-[spin_2s_linear_infinite_reverse]"
        style={{ width: config.ring * 0.75, height: config.ring * 0.75 }}
      >
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
      </div>
      
      {/* Center icon */}
      <div className="relative z-10 text-blue-600 animate-pulse">
        <Eye size={config.icon} strokeWidth={1.5} />
      </div>
    </div>
  );

  const renderMedicalLoader = () => (
    <div className="relative flex items-center justify-center">
      {/* Pulsing background */}
      <div
        className="absolute rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 animate-[pulse_2s_ease-in-out_infinite]"
        style={{ width: config.ring * 1.2, height: config.ring * 1.2 }}
      />
      
      {/* Spinning gradient ring */}
      <div
        className="absolute rounded-full animate-[spin_2s_linear_infinite]"
        style={{
          width: config.ring,
          height: config.ring,
          background: 'conic-gradient(from 0deg, transparent, #3B82F6, #6366F1, transparent)',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))',
        }}
      />
      
      {/* Center icon with glow */}
      <div className="relative z-10 p-2 bg-white rounded-full shadow-lg shadow-blue-100">
        <Eye size={config.icon} className="text-blue-600" strokeWidth={2} />
      </div>
    </div>
  );

  const renderMinimalLoader = () => (
    <div className="flex items-center justify-center" style={{ width: config.ring, height: config.ring }}>
      <div className="relative w-full h-full">
        {/* Three orbiting dots */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 animate-[spin_1.5s_linear_infinite]"
            style={{ animationDelay: `${i * 0.2}s` }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-blue-500"
              style={{
                width: config.icon / 3,
                height: config.icon / 3,
                opacity: 1 - i * 0.25,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderPulseLoader = () => (
    <div className="relative flex items-center justify-center" style={{ width: config.ring, height: config.ring }}>
      {/* Expanding rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 border-blue-400 animate-[ping_2s_ease-out_infinite]"
          style={{
            width: config.ring * 0.6,
            height: config.ring * 0.6,
            animationDelay: `${i * 0.5}s`,
            opacity: 0,
          }}
        />
      ))}
      
      {/* Static center */}
      <div className="relative z-10 p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-lg">
        <Sparkles size={config.icon * 0.6} className="text-white" />
      </div>
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'medical':
        return renderMedicalLoader();
      case 'minimal':
        return renderMinimalLoader();
      case 'pulse':
        return renderPulseLoader();
      default:
        return renderDefaultLoader();
    }
  };

  const content = (
    <div className={`flex flex-col items-center justify-center ${config.gap} ${className}`}>
      {renderLoader()}
      
      {(message || subMessage) && (
        <div className="text-center mt-4 space-y-1">
          {message && (
            <p className={`font-semibold text-slate-700 ${config.text}`}>
              {message}
              {showProgress && <span className="inline-block w-6 text-left">{dots}</span>}
            </p>
          )}
          {subMessage && (
            <p className={`text-slate-400 ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
              {subMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
        {content}
      </div>
    );
  }

  return content;
};

/**
 * Page-level loader for sections like Clinic Setup and Patient Onboarding
 * Shows a beautiful loading state with context-aware messaging
 */
interface PageLoaderProps {
  /** The type of content being loaded */
  context?: 'clinic' | 'patient' | 'general';
  /** Custom message override */
  message?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({ context = 'general', message }) => {
  const contextMessages = {
    clinic: {
      message: 'Loading clinic configuration',
      subMessage: 'Fetching medications, packages, and staff information',
    },
    patient: {
      message: 'Loading patient record',
      subMessage: 'Retrieving medical history and clinical data',
    },
    general: {
      message: 'Loading',
      subMessage: 'Please wait a moment',
    },
  };

  const { message: defaultMsg, subMessage } = contextMessages[context];

  return (
    <div className="h-full min-h-[400px] flex items-center justify-center py-20">
      <Loader
        size="lg"
        variant="medical"
        message={message || defaultMsg}
        subMessage={subMessage}
      />
    </div>
  );
};

/**
 * Inline loader for smaller sections (e.g., dropdown loading)
 */
export const InlineLoader: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex items-center gap-2 py-2">
    <Loader size="sm" variant="minimal" showProgress={false} />
    {message && <span className="text-xs text-slate-400">{message}</span>}
  </div>
);

/**
 * Button loader for loading states within buttons
 */
export const ButtonLoader: React.FC = () => (
  <div className="flex items-center justify-center">
    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  </div>
);

/**
 * Skeleton loader for content placeholders
 */
interface SkeletonProps {
  /** Width class (e.g., 'w-full', 'w-32') */
  width?: string;
  /** Height class (e.g., 'h-4', 'h-10') */
  height?: string;
  /** Whether it's circular */
  circle?: boolean;
  /** Custom className */
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = 'w-full',
  height = 'h-4',
  circle = false,
  className = '',
}) => (
  <div
    className={`
      ${circle ? 'rounded-full' : 'rounded-lg'}
      ${width} ${height}
      bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
      bg-[length:200%_100%]
      animate-[shimmer_1.5s_ease-in-out_infinite]
      ${className}
    `}
  />
);

/**
 * Card skeleton for loading cards
 */
export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton width="w-12" height="h-12" circle />
      <div className="flex-1 space-y-2">
        <Skeleton width="w-1/3" height="h-4" />
        <Skeleton width="w-1/2" height="h-3" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton height="h-3" />
      <Skeleton width="w-4/5" height="h-3" />
      <Skeleton width="w-2/3" height="h-3" />
    </div>
  </div>
);

/**
 * Form skeleton for loading form sections
 */
export const FormSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-6">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton width="w-24" height="h-3" />
        <Skeleton height="h-10" />
      </div>
    ))}
  </div>
);

// Add keyframes to global styles (should be in your CSS or added via style tag)
const GlobalStyles = () => (
  <style>{`
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `}</style>
);

// Export the global styles component for use in App.tsx
export { GlobalStyles as LoaderStyles };

export default Loader;
