import React, { useState, useEffect } from 'react';
import { ModuleItem } from '../types';
import { useTheme } from '../theme';
import {
  ScanEye,
  Sparkles,
  Aperture,
  ShieldAlert,
  CalendarClock,
  ClipboardCheck,
  FileHeart,
  HelpCircle,
  Info,
  ArrowRight
} from 'lucide-react';

const getIcon = (name: string, size = 32, color = "currentColor") => {
  const props = { size, className: color, strokeWidth: 1.5 };
  switch (name) {
    case 'type': return <ScanEye {...props} />;
    case 'surgery': return <Sparkles {...props} />;
    case 'risk': return <ShieldAlert {...props} />;
    case 'iol': return <Aperture {...props} />;
    case 'options': return <HelpCircle {...props} />;
    case 'day': return <CalendarClock {...props} />;
    case 'preop': return <ClipboardCheck {...props} />;
    case 'postop': return <Info {...props} />;
    case 'forms': return <FileHeart {...props} />;
    default: return <ScanEye {...props} />;
  }
};

// 1. Define color palettes for the 3D sides (Top, Bottom, Left, Back)
const themePalette: Record<string, any> = {
  default: {
    top: 'bg-blue-400',
    bottom: 'bg-blue-800',
    left: 'bg-blue-600',
    back: 'bg-blue-900',
    rightResting: 'bg-blue-600',
    rightBorder: 'border-blue-500',
    textTitle: 'text-blue-900',
    textBody: 'text-slate-600',
    pillText: 'text-blue-600',
    pillBg: 'bg-blue-50',
    borderActive: 'border-blue-200',
  },
  magenta: {
    top: 'bg-pink-400',
    bottom: 'bg-pink-800',
    left: 'bg-pink-600',
    back: 'bg-pink-900',
    rightResting: 'bg-pink-600',
    rightBorder: 'border-pink-500',
    textTitle: 'text-pink-900',
    textBody: 'text-slate-600',
    pillText: 'text-pink-600',
    pillBg: 'bg-pink-50',
    borderActive: 'border-pink-200',
  },
  lavender: {
    top: 'bg-violet-400',
    bottom: 'bg-violet-800',
    left: 'bg-violet-600',
    back: 'bg-violet-900',
    rightResting: 'bg-violet-600',
    rightBorder: 'border-violet-500',
    textTitle: 'text-violet-900',
    textBody: 'text-slate-600',
    pillText: 'text-violet-600',
    pillBg: 'bg-violet-50',
    borderActive: 'border-violet-200',
  },
  turquoise: {
    top: 'bg-cyan-400',
    bottom: 'bg-cyan-800',
    left: 'bg-cyan-600',
    back: 'bg-cyan-900',
    rightResting: 'bg-cyan-600',
    rightBorder: 'border-cyan-500',
    textTitle: 'text-cyan-900',
    textBody: 'text-slate-600',
    pillText: 'text-cyan-600',
    pillBg: 'bg-cyan-50',
    borderActive: 'border-cyan-200',
  },
  gradient: {
    top: 'bg-violet-400',
    bottom: 'bg-violet-800',
    left: 'bg-violet-600',
    back: 'bg-violet-900',
    rightResting: 'bg-violet-600',
    rightBorder: 'border-violet-500',
    textTitle: 'text-violet-900',
    textBody: 'text-slate-600',
    pillText: 'text-violet-600',
    pillBg: 'bg-violet-50',
    borderActive: 'border-violet-200',
  },
};

interface Cube3DProps {
  item: ModuleItem;
  onClick: (item: ModuleItem) => void;
}

const Cube3D: React.FC<Cube3DProps> = ({ item, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [halfSize, setHalfSize] = useState("7rem");

  // Random animation offsets for the "float" effect
  const [floatDelay, setFloatDelay] = useState("0s");
  const [floatDuration, setFloatDuration] = useState("6s");

  // Calculated entrance delay based on ID for the "drop in" effect
  // Assuming IDs are numeric "1", "2", etc.
  const index = parseInt(item.id) || 0;
  const dropDelay = `${(index - 1) * 0.15}s`;

  const { classes, currentTheme } = useTheme();
  const colors = themePalette[currentTheme?.id] || themePalette['default'];

  // Responsive sizing & Random Animation logic
  useEffect(() => {
    // 1. Calculate size based on screen
    const updateSize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) {
        setHalfSize("7rem");
      } else {
        setHalfSize("4.25rem");
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // 2. Generate random animation values to desynchronize the float
    // We use a negative delay so the float animation starts "mid-cycle" immediately
    setFloatDelay(`${-Math.random() * 5}s`);
    // Vary duration slightly (between 5s and 7s) so they drift organically
    setFloatDuration(`${10 + Math.random() * 6}s`);

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const faceClass = `absolute inset-0 rounded-xl flex flex-col items-center justify-center backface-visible overflow-hidden transition-all duration-500`;

  const handleInteraction = () => {
    const hasHover = window.matchMedia('(hover: hover)').matches;
    if (hasHover) {
      onClick(item);
    } else {
      if (isFlipped) onClick(item);
      else setIsFlipped(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsFlipped(false);
  };

  const isShowingInfo = isHovered || isFlipped;

  return (
    <>
      <style>
        {`
          @keyframes dropIn {
            0% { opacity: 0; transform: translateY(-60px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes floatCube {
            0% { transform: rotateX(-5deg) rotateY(-10deg); }
            50% { transform: rotateX(-12deg) rotateY(10deg); }
            100% { transform: rotateX(-5deg) rotateY(-10deg); }
          }
          @keyframes floatShadow {
            0% { transform: translateX(-50%) scale(1); opacity: 0.2; }
            50% { transform: translateX(-50%) scale(0.85); opacity: 0.15; }
            100% { transform: translateX(-50%) scale(1); opacity: 0.2; }
          }
          .cube-floater {
            transform-style: preserve-3d;
            transform: rotateX(-5deg) rotateY(-8deg);
            transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
            width: 100%;
            height: 100%;
          }
        `}
      </style>

      {/* OUTER CONTAINER: Handles the "Drop In" Entrance Animation 
        - Perspective container
        - Grid placement
        - Entrance animation (dropIn)
      */}
      <div
        className={`relative w-[8.5rem] h-[8.5rem] md:w-[14rem] md:h-[14rem] group cursor-pointer perspective-1000 mx-auto my-6`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onClick={handleInteraction}
        style={{
          perspective: "1200px",
          // The drop-in animation plays once on mount
          animation: `dropIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) backwards`,
          animationDelay: dropDelay
        }}
      >
        {/* WRAPPER: Handles the Continuous "Float" Animation
          - Runs infinitely
          - Randomized start/duration to look organic
          - Pauses ONLY the float when interacting, but keeps the current tilt frame if we wanted (or resets)
          - Note: We disable the animation string when showing info to prevent fighting with the hover rotation
        */}
        <div
          className="cube-floater"
          style={{
            animation: !isShowingInfo ? `floatCube ${floatDuration} ease-in-out infinite` : "none",
            animationDelay: !isShowingInfo ? floatDelay : undefined,
            transform: isShowingInfo ? "rotateX(0deg) rotateY(0deg)" : undefined
          }}
        >

          {/* INNER CONTAINER: Handles the Interactive Rotation
            - Rotates -90deg on Y axis to show info
            - Smooth transition
          */}
          <div
            className={`relative w-full h-full transition-transform duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) transform-style-3d`}
            style={{
              transformStyle: "preserve-3d",
              // We only rotate Y here. The Tilt (X and Y) comes from the parent .cube-floater
              transform: isShowingInfo ? "rotateY(-90deg)" : "rotateY(0deg)",
            }}
          >

            {/* --- FRONT FACE --- */}
            <div
              className={`${faceClass} ${classes.cube.frontGradient} overflow-hidden transition-shadow duration-500`}
              style={{
                transform: `translateZ(${halfSize})`,
                boxShadow: isShowingInfo
                  ? 'inset -8px 0 20px rgba(0,0,0,0.12)'
                  : '0 24px 48px rgba(0,0,0,0.14), 0 0 38px rgba(104,140,255,0.28), inset 0 1px 0 rgba(255,255,255,0.3)'
              }}
            >
              {/* Soft glow wash — hidden when flipped so it doesn't bleed as a light strip */}
              <div className={`absolute inset-[-12%] bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.24),rgba(124,152,255,0.14),transparent_62%)] pointer-events-none transition-opacity duration-500 ${isShowingInfo ? 'opacity-0' : 'opacity-90'}`}></div>
              {/* Top edge glint */}
              <div className={`absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none transition-opacity duration-500 ${isShowingInfo ? 'opacity-0' : 'opacity-100'}`}></div>

              {/* Optional: Large faint watermark icon (kept here commented in case you want it) */}
              {/* <div className="absolute -bottom-4 -right-4 opacity-10 text-white rotate-12 scale-150 pointer-events-none">
                {getIcon(item.iconName, 120, "text-white")}
              </div> */}
             
              {/* <div className={`${classes.cube.frontIconBg} p-4 md:p-5 rounded-full mb-3 
              md:mb-5 shadow-inner relative z-10 backdrop-blur-md bg-white/12 border 
              border-white/30 overflow-hidden transition-transform duration-300 
              group-hover:scale-110`}> */}
              {/* Holographic icon badge with glow */}
              <div className={`${classes.cube.frontIconBg} p-4 md:p-5 rounded-full mb-3 md:mb-5 shadow-inner relative z-10 backdrop-blur-md bg-white/12 border border-white/30 overflow-hidden transition-transform duration-300 group-hover:scale-110 shadow-[0_0_28px_rgba(255,255,255,0.26),0_12px_30px_rgba(0,0,0,0.18)]`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.22),transparent_62%)] pointer-events-none"></div>
                <div className="hidden md:block relative text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                  {getIcon(item.iconName, 44, "text-white")}
                </div>
                <div className="block md:hidden relative text-white drop-shadow-md">
                  {getIcon(item.iconName, 28, "text-white")}
                </div>
              </div>
              <h3 className={`text-sm md:text-xl font-medium ${classes.cube.frontTitle} text-center px-2 md:px-6 tracking-wide leading-tight text-white relative z-10 drop-shadow-lg`}>
                {item.title}
              </h3>
            </div>

            {/* --- RIGHT FACE --- */}
            <div
              className={`${faceClass} ${isShowingInfo ? `bg-white ${colors.borderActive}` : `${colors.rightResting} ${colors.rightBorder}`}`}
              style={{ transform: `rotateY(90deg) translateZ(${halfSize})`, boxShadow: isShowingInfo ? '0 16px 40px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)' : 'inset 8px 0 20px rgba(0,0,0,0.1)' }}
            >
              <div className={`w-full h-full p-3 md:p-6 flex flex-col justify-center items-center text-center transition-opacity duration-300 ${isShowingInfo ? 'opacity-100 delay-200' : 'opacity-0'}`}>
                
                  <p className={`text-sm md:text-xl font-bold leading-tight ${colors.textTitle} line-clamp-4 md:line-clamp-4 mb-4`}>
                    {item.shortDescription}
                  </p>
                
                <div className={`flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${colors.pillText} ${colors.pillBg} py-2 px-4 rounded-full mx-auto`}>
                  Details <ArrowRight size={12} className="md:w-3.5 md:h-3.5" />
                </div>
              </div>

              <div className={`absolute inset-0 ${colors.back}/40 ${isShowingInfo ? 'opacity-0' : 'opacity-100'}`}></div>
            </div>

            {/* --- OTHER SIDES --- */}
            <div className={`${faceClass} ${colors.back}`} style={{ transform: `rotateY(180deg) translateZ(${halfSize})`, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.15)' }}></div>
            <div className={`${faceClass} ${colors.left}`} style={{ transform: `rotateY(-90deg) translateZ(${halfSize})`, boxShadow: 'inset -8px 0 20px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.08)' }}></div>
            <div className={`${faceClass} ${colors.top}`} style={{ transform: `rotateX(90deg) translateZ(${halfSize})`, boxShadow: 'inset 0 8px 20px rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.1)' }}></div>
            <div className={`${faceClass} ${colors.bottom}`} style={{ transform: `rotateX(-90deg) translateZ(${halfSize})`, boxShadow: 'inset 0 0 24px rgba(0,0,0,0.2)' }}></div>
          </div>
        </div>
                
        {/* Floating Shadow - Also gets the drop-in animation! */}
        <div
          className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/20 blur-xl rounded-[100%] transition-all duration-500`}
          style={{
            // Combine drop animation (fade in) with float animation
            // Note: We use a separate keyframe for shadow drop to avoid moving it vertically too much, mainly opacity
            animation: `${!isShowingInfo ? `floatShadow ${floatDuration} ease-in-out infinite` : "none"}, dropIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) backwards`,
            animationDelay: `${!isShowingInfo ? floatDelay : "0s"}, ${dropDelay}`,
            opacity: isShowingInfo ? 0.4 : undefined,
            transform: isShowingInfo ? "translateX(-50%) scale(0.6)" : undefined
          }}
        ></div>
      </div>
    </>
  );
};

export default Cube3D;