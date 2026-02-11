import React from 'react';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';
type LogoVariant = 'eye' | 'mira' | 'image';

interface LogoProps {
  size?: LogoSize;
  /** 'eye' = standalone eye mark, 'mira' = M flowing into eye SVG, 'image' = transparent PNG */
  variant?: LogoVariant;
  className?: string;
}

const eyeSizeMap = {
  sm: { width: 32, height: 20 },
  md: { width: 48, height: 30 },
  lg: { width: 64, height: 40 },
  xl: { width: 80, height: 52 },
};

const imageSizeMap = {
  sm: { width: 40, height: 40 },
  md: { width: 64, height: 64 },
  lg: { width: 96, height: 96 },
  xl: { width: 140, height: 140 },
};

const miraSizeMap = {
  sm: { width: 57, height: 30 },
  md: { width: 95, height: 50 },
  lg: { width: 133, height: 70 },
  xl: { width: 200, height: 105 },
};

/* ─────────────────────────────────────────────
   Variant: "eye" — Standalone eye mark
   ───────────────────────────────────────────── */
const EyeLogo: React.FC<{ width: number; height: number; className: string }> = ({ width, height, className }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 80 52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="ccEyeGrad" x1="0" y1="10" x2="80" y2="42">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#6366F1" />
      </linearGradient>
      <linearGradient id="ccIrisGrad" x1="32" y1="18" x2="48" y2="34">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="50%" stopColor="#4F46E5" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
      <radialGradient id="ccIrisRadial" cx="50%" cy="45%" r="50%">
        <stop offset="0%" stopColor="#818CF8" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
      </radialGradient>
      <filter id="ccEyeGlow">
        <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.2" />
      </filter>
      <filter id="ccIrisGlow">
        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.35" />
      </filter>
    </defs>

    {/* Eye outer shape */}
    <path
      d="M4 26C4 26 16 6 40 6C64 6 76 26 76 26C76 26 64 46 40 46C16 46 4 26 4 26Z"
      fill="none" stroke="url(#ccEyeGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      filter="url(#ccEyeGlow)"
    />

    {/* Inner almond fill */}
    <path
      d="M12 26C12 26 22 12 40 12C58 12 68 26 68 26C68 26 58 40 40 40C22 40 12 26 12 26Z"
      fill="url(#ccEyeGrad)" opacity="0.06"
    />

    {/* Iris outer ring */}
    <circle cx="40" cy="26" r="13" fill="none" stroke="url(#ccEyeGrad)" strokeWidth="1.5" opacity="0.3" />

    {/* Iris — layered for depth */}
    <circle cx="40" cy="26" r="11" fill="url(#ccIrisGrad)" filter="url(#ccIrisGlow)" />
    <circle cx="40" cy="26" r="11" fill="url(#ccIrisRadial)" />

    {/* Iris detail rings */}
    <circle cx="40" cy="26" r="8" fill="none" stroke="white" strokeWidth="0.4" opacity="0.2" />
    <circle cx="40" cy="26" r="5.5" fill="none" stroke="white" strokeWidth="0.3" opacity="0.15" />

    {/* Pupil */}
    <circle cx="40" cy="26" r="4" fill="#1E1B4B" />

    {/* Light reflections */}
    <circle cx="36" cy="22" r="2.5" fill="white" opacity="0.85" />
    <circle cx="44.5" cy="23.5" r="1" fill="white" opacity="0.5" />
    <circle cx="38" cy="30" r="0.7" fill="white" opacity="0.25" />

    {/* Upper eyelid crease */}
    <path
      d="M10 24C10 24 20 8 40 8C60 8 70 24 70 24"
      fill="none" stroke="url(#ccEyeGrad)" strokeWidth="0.8" opacity="0.2" strokeLinecap="round"
    />
  </svg>
);

/* ─────────────────────────────────────────────
   Variant: "mira" — M flowing into eye
   ───────────────────────────────────────────── */
const MiraLogo: React.FC<{ width: number; height: number; className: string }> = ({ width, height, className }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 400 210"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="miraGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="35%" stopColor="#06b6d4" />
        <stop offset="70%" stopColor="#0891b2" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>
    </defs>

    {/* M — left vertical leg (tall, clearly visible) */}
    <path
      d="M 25 188 V 42"
      stroke="url(#miraGrad)" strokeWidth="16" strokeLinecap="round" fill="none"
    />

    {/* M — V-shape (shallow) + right peak flowing into wave → merges into eye */}
    <path
      d="M 25 42 L 72 120 L 120 42 C 136 14, 170 4, 192 36 C 212 64, 216 98, 210 112"
      stroke="url(#miraGrad)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />

    {/* Eye — filled almond outline with pointed corners (evenodd cutout) */}
    <path
      d="M 198 112 C 228 38, 325 16, 395 112 C 325 208, 228 186, 198 112 Z
         M 218 112 C 240 56, 320 40, 378 112 C 320 184, 240 168, 218 112 Z"
      fill="url(#miraGrad)" fillRule="evenodd"
    />

    {/* Iris */}
    <circle cx="300" cy="112" r="35" fill="#1e3a8a" />

    {/* Star sparkle in iris */}
    <path
      d="M 290 95 L 292.5 99.5 L 297 102 L 292.5 104.5 L 290 109 L 287.5 104.5 L 283 102 L 287.5 99.5 Z"
      fill="white" opacity="0.85"
    />

    {/* Small light reflection */}
    <circle cx="307" cy="100" r="3.5" fill="white" opacity="0.45" />
  </svg>
);

/* ─────────────────────────────────────────────
   Main Logo component
   ───────────────────────────────────────────── */
const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'image', className = '' }) => {
  if (variant === 'image') {
    const { width, height } = imageSizeMap[size];
    return (
      <img
        src="/assets/mira_eye_transparent_logo2.png"
        alt="Mira"
        width={width}
        height={height}
        className={className}
        style={{ objectFit: 'contain' }}
      />
    );
  }

  if (variant !== 'eye') {
    const { width, height } = eyeSizeMap[size];
    return <EyeLogo width={width} height={height} className={className} />;
  }

  const { width, height } = miraSizeMap[size];
  return <MiraLogo width={width} height={height} className={className} />;
};

export default Logo;
