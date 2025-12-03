// import React, { useState, useEffect } from 'react';
// import { ModuleItem } from '../types';
// import { useTheme } from '../theme';
// import {
//   Eye,
//   Activity,
//   AlertTriangle,
//   Disc,
//   HelpCircle,
//   Calendar,
//   ClipboardList,
//   FileText,
//   Info,
//   ArrowRight
// } from 'lucide-react';

// const getIcon = (name: string, size = 32, color = "currentColor") => {
//   const props = { size, className: color };
//   switch (name) {
//     case 'type': return <Eye {...props} />;
//     case 'surgery': return <Activity {...props} />;
//     case 'risk': return <AlertTriangle {...props} />;
//     case 'iol': return <Disc {...props} />;
//     case 'options': return <HelpCircle {...props} />;
//     case 'day': return <Calendar {...props} />;
//     case 'preop': return <ClipboardList {...props} />;
//     case 'postop': return <Info {...props} />;
//     case 'forms': return <FileText {...props} />;
//     default: return <Eye {...props} />;
//   }
// };

// // 1. Define color palettes for the 3D sides (Top, Bottom, Left, Back)
// const themePalette: Record<string, any> = {
//   default: {
//     top: 'bg-blue-400',
//     bottom: 'bg-blue-950',
//     left: 'bg-blue-600',
//     back: 'bg-blue-900',
//     rightResting: 'bg-blue-700',
//     rightBorder: 'border-blue-800',
//     textTitle: 'text-blue-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-blue-600',
//     pillBg: 'bg-blue-50',
//     borderActive: 'border-blue-100',
//   },
//   magenta: {
//     top: 'bg-pink-400',
//     bottom: 'bg-pink-950',
//     left: 'bg-pink-600',
//     back: 'bg-pink-900',
//     rightResting: 'bg-pink-700',
//     rightBorder: 'border-pink-800',
//     textTitle: 'text-pink-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-pink-600',
//     pillBg: 'bg-pink-50',
//     borderActive: 'border-pink-100',
//   },
//   lavender: {
//     top: 'bg-violet-400',
//     bottom: 'bg-violet-950',
//     left: 'bg-violet-600',
//     back: 'bg-violet-900',
//     rightResting: 'bg-violet-700',
//     rightBorder: 'border-violet-800',
//     textTitle: 'text-violet-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-violet-600',
//     pillBg: 'bg-violet-50',
//     borderActive: 'border-violet-100',
//   },
//   turquoise: {
//     top: 'bg-cyan-400',
//     bottom: 'bg-cyan-950',
//     left: 'bg-cyan-600',
//     back: 'bg-cyan-900',
//     rightResting: 'bg-cyan-700',
//     rightBorder: 'border-cyan-800',
//     textTitle: 'text-cyan-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-cyan-600',
//     pillBg: 'bg-cyan-50',
//     borderActive: 'border-cyan-100',
//   },
//   gradient: {
//     top: 'bg-violet-400',
//     bottom: 'bg-violet-950',
//     left: 'bg-violet-600',
//     back: 'bg-violet-900',
//     rightResting: 'bg-violet-700',
//     rightBorder: 'border-violet-800',
//     textTitle: 'text-violet-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-violet-600',
//     pillBg: 'bg-violet-50',
//     borderActive: 'border-violet-100',
//   },
// };

// interface Cube3DProps {
//   item: ModuleItem;
//   onClick: (item: ModuleItem) => void;
// }

// const Cube3D: React.FC<Cube3DProps> = ({ item, onClick }) => {
//   const [isHovered, setIsHovered] = useState(false);
//   const [isFlipped, setIsFlipped] = useState(false);
//   const [halfSize, setHalfSize] = useState("7.5rem");
//   const { classes, currentTheme } = useTheme();

//   const colors = themePalette[currentTheme?.id] || themePalette['default'];

//   // Responsive sizing logic
//   useEffect(() => {
//     const updateSize = () => {
//       if (window.matchMedia('(min-width: 768px)').matches) {
//         setHalfSize("7.5rem");
//       } else {
//         setHalfSize("4.5rem");
//       }
//     };
//     updateSize();
//     window.addEventListener('resize', updateSize);
//     return () => window.removeEventListener('resize', updateSize);
//   }, []);

//   const faceClass = `absolute inset-0 rounded-xl flex flex-col items-center justify-center backface-visible overflow-hidden transition-all duration-500 shadow-sm border border-white/10`;

//   const handleInteraction = () => {
//     const hasHover = window.matchMedia('(hover: hover)').matches;
//     if (hasHover) {
//       onClick(item);
//     } else {
//       if (isFlipped) onClick(item);
//       else setIsFlipped(true);
//     }
//   };

//   const handleMouseLeave = () => {
//     setIsHovered(false);
//     setIsFlipped(false);
//   };

//   const isShowingInfo = isHovered || isFlipped;

//   return (
//     <div
//       className={`relative w-36 h-36 md:w-60 md:h-60 group cursor-pointer perspective-1000 mx-auto my-6`}
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={handleMouseLeave}
//       onClick={handleInteraction}
//       style={{ perspective: "1200px" }}
//     >
//       <div
//         className={`relative w-full h-full transition-transform duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) transform-style-3d`}
//         style={{
//           transformStyle: "preserve-3d",
//           // UPDATED TRANSFORMS:
//           // 1. Removed rotateZ(2deg) to fix the "odd/crooked" look.
//           // 2. Reduced rotateX to 5deg for a cleaner, less "top-down" view.
//           // 3. Adjusted rotateY to -12deg for a subtle "teaser" of the right side without twisting too much.
//           transform: isShowingInfo
//             ? "rotateY(-90deg)"
//             : "rotateX(5deg) rotateY(-12deg)",
//         }}
//       >

//         {/* --- FRONT FACE --- */}
//         <div
//           className={`${faceClass} ${classes.cube.frontGradient} shadow-2xl`}
//           style={{ transform: `translateZ(${halfSize})` }}
//         >
//           <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>

//           <div className={`${classes.cube.frontIconBg} p-3 md:p-5 rounded-full mb-3 md:mb-5 shadow-inner relative z-10`}>
//             <div className="hidden md:block">{getIcon(item.iconName, 40, "text-white")}</div>
//             <div className="block md:hidden">{getIcon(item.iconName, 24, "text-white")}</div>
//           </div>
//           <h3 className={`text-sm md:text-xl font-medium ${classes.cube.frontTitle} text-center px-2 md:px-6 tracking-wide leading-tight text-white relative z-10 drop-shadow-md`}>
//             {item.title}
//           </h3>
//         </div>

//         {/* --- RIGHT FACE --- */}
//         <div
//           className={`${faceClass} ${isShowingInfo ? `bg-white ${colors.borderActive}` : `${colors.rightResting} ${colors.rightBorder}`}`}
//           style={{ transform: `rotateY(90deg) translateZ(${halfSize})` }}
//         >
//           <div className={`w-full h-full p-3 md:p-6 flex flex-col justify-between text-center transition-opacity duration-300 ${isShowingInfo ? 'opacity-100 delay-200' : 'opacity-0'}`}>
//             <div>
//               <h4 className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-3 ${colors.textTitle} opacity-80`}>
//                 Overview
//               </h4>
//               <p className={`text-[10px] md:text-sm font-normal leading-relaxed ${colors.textBody} line-clamp-4`}>
//                 {item.shortDescription}
//               </p>
//             </div>
//             <div className={`flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${colors.pillText} ${colors.pillBg} py-2 px-4 rounded-full mx-auto`}>
//               Read More <ArrowRight size={12} className="md:w-3.5 md:h-3.5" />
//             </div>
//           </div>

//           <div className={`absolute inset-0 ${colors.back}/40 ${isShowingInfo ? 'opacity-0' : 'opacity-100'}`}></div>
//         </div>

//         {/* --- OTHER SIDES --- */}
//         <div className={`${faceClass} ${colors.back}`} style={{ transform: `rotateY(180deg) translateZ(${halfSize})` }}></div>
//         <div className={`${faceClass} ${colors.left}`} style={{ transform: `rotateY(-90deg) translateZ(${halfSize})` }}></div>
//         <div className={`${faceClass} ${colors.top}`} style={{ transform: `rotateX(90deg) translateZ(${halfSize})` }}></div>
//         <div className={`${faceClass} ${colors.bottom}`} style={{ transform: `rotateX(-90deg) translateZ(${halfSize})` }}></div>
//       </div>

//       <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/20 blur-xl rounded-[100%] transition-all duration-500 ${isHovered ? 'scale-75 opacity-20' : 'scale-100 opacity-40'}`}></div>
//     </div>
//   );
// };

// export default Cube3D;






import React, { useState, useEffect } from 'react';
import { ModuleItem } from '../types';
import { useTheme } from '../theme';
import {
  Eye,
  Activity,
  AlertTriangle,
  Disc,
  HelpCircle,
  Calendar,
  ClipboardList,
  FileText,
  Info,
  ArrowRight
} from 'lucide-react';

const getIcon = (name: string, size = 32, color = "currentColor") => {
  const props = { size, className: color };
  switch (name) {
    case 'type': return <Eye {...props} />;
    case 'surgery': return <Activity {...props} />;
    case 'risk': return <AlertTriangle {...props} />;
    case 'iol': return <Disc {...props} />;
    case 'options': return <HelpCircle {...props} />;
    case 'day': return <Calendar {...props} />;
    case 'preop': return <ClipboardList {...props} />;
    case 'postop': return <Info {...props} />;
    case 'forms': return <FileText {...props} />;
    default: return <Eye {...props} />;
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
  const [halfSize, setHalfSize] = useState("7.5rem");

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
        setHalfSize("7.5rem");
      } else {
        setHalfSize("4.5rem");
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // 2. Generate random animation values to desynchronize the float
    // We use a negative delay so the float animation starts "mid-cycle" immediately
    setFloatDelay(`${-Math.random() * 5}s`);
    // Vary duration slightly (between 5s and 7s) so they drift organically
    setFloatDuration(`${20 + Math.random() * 20}s`);

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const faceClass = `absolute inset-0 rounded-lg flex flex-col items-center justify-center backface-visible overflow-hidden transition-all duration-500 shadow-sm border border-white/20`;

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
        className={`relative w-36 h-36 md:w-60 md:h-60 group cursor-pointer perspective-1000 mx-auto my-6`}
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
            animationDelay: !isShowingInfo ? floatDelay : undefined
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
              className={`${faceClass} ${classes.cube.frontGradient} shadow-2xl`}
              style={{ transform: `translateZ(${halfSize})` }}
            >
              {/* Subtle top highlight for 3D bevel effect */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/40"></div>

              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>

              <div className={`${classes.cube.frontIconBg} p-3 md:p-5 rounded-full mb-3 md:mb-5 shadow-inner relative z-10`}>
                <div className="hidden md:block">{getIcon(item.iconName, 40, "text-white")}</div>
                <div className="block md:hidden">{getIcon(item.iconName, 24, "text-white")}</div>
              </div>
              <h3 className={`text-sm md:text-xl font-medium ${classes.cube.frontTitle} text-center px-2 md:px-6 tracking-wide leading-tight text-white relative z-10 drop-shadow-md`}>
                {item.title}
              </h3>
            </div>

            {/* --- RIGHT FACE --- */}
            <div
              className={`${faceClass} ${isShowingInfo ? `bg-white ${colors.borderActive}` : `${colors.rightResting} ${colors.rightBorder}`}`}
              style={{ transform: `rotateY(90deg) translateZ(${halfSize})` }}
            >
              <div className={`w-full h-full p-3 md:p-6 flex flex-col justify-between text-center transition-opacity duration-300 ${isShowingInfo ? 'opacity-100 delay-200' : 'opacity-0'}`}>
                <div>
                  <h4 className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-3 ${colors.textTitle} opacity-80`}>
                    Overview
                  </h4>
                  <p className={`text-[10px] md:text-sm font-normal leading-relaxed ${colors.textBody} line-clamp-4`}>
                    {item.shortDescription}
                  </p>
                </div>
                <div className={`flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${colors.pillText} ${colors.pillBg} py-2 px-4 rounded-full mx-auto`}>
                  Read More <ArrowRight size={12} className="md:w-3.5 md:h-3.5" />
                </div>
              </div>

              <div className={`absolute inset-0 ${colors.back}/40 ${isShowingInfo ? 'opacity-0' : 'opacity-100'}`}></div>
            </div>

            {/* --- OTHER SIDES --- */}
            <div className={`${faceClass} ${colors.back}`} style={{ transform: `rotateY(180deg) translateZ(${halfSize})` }}></div>
            <div className={`${faceClass} ${colors.left}`} style={{ transform: `rotateY(-90deg) translateZ(${halfSize})` }}></div>
            <div className={`${faceClass} ${colors.top}`} style={{ transform: `rotateX(90deg) translateZ(${halfSize})` }}></div>
            <div className={`${faceClass} ${colors.bottom}`} style={{ transform: `rotateX(-90deg) translateZ(${halfSize})` }}></div>
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





// import React, { useState, useEffect } from 'react';
// import { ModuleItem } from '../types';
// import { useTheme } from '../theme';
// import {
//   Eye,
//   Activity,
//   AlertTriangle,
//   Disc,
//   HelpCircle,
//   Calendar,
//   ClipboardList,
//   FileText,
//   Info,
//   ArrowRight
// } from 'lucide-react';

// const getIcon = (name: string, size = 32, color = "currentColor") => {
//   const props = { size, className: color };
//   switch (name) {
//     case 'type': return <Eye {...props} />;
//     case 'surgery': return <Activity {...props} />;
//     case 'risk': return <AlertTriangle {...props} />;
//     case 'iol': return <Disc {...props} />;
//     case 'options': return <HelpCircle {...props} />;
//     case 'day': return <Calendar {...props} />;
//     case 'preop': return <ClipboardList {...props} />;
//     case 'postop': return <Info {...props} />;
//     case 'forms': return <FileText {...props} />;
//     default: return <Eye {...props} />;
//   }
// };

// // 1. Define color palettes for the 3D sides (Top, Bottom, Left, Back)
// const themePalette: Record<string, any> = {
//   default: {
//     top: 'bg-blue-400',
//     bottom: 'bg-blue-800',
//     left: 'bg-blue-600',
//     back: 'bg-blue-900',
//     rightResting: 'bg-blue-600',
//     rightBorder: 'border-blue-500',
//     textTitle: 'text-blue-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-blue-600',
//     pillBg: 'bg-blue-50',
//     borderActive: 'border-blue-200',
//   },
//   magenta: {
//     top: 'bg-pink-400',
//     bottom: 'bg-pink-800',
//     left: 'bg-pink-600',
//     back: 'bg-pink-900',
//     rightResting: 'bg-pink-600',
//     rightBorder: 'border-pink-500',
//     textTitle: 'text-pink-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-pink-600',
//     pillBg: 'bg-pink-50',
//     borderActive: 'border-pink-200',
//   },
//   lavender: {
//     top: 'bg-violet-400',
//     bottom: 'bg-violet-800',
//     left: 'bg-violet-600',
//     back: 'bg-violet-900',
//     rightResting: 'bg-violet-600',
//     rightBorder: 'border-violet-500',
//     textTitle: 'text-violet-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-violet-600',
//     pillBg: 'bg-violet-50',
//     borderActive: 'border-violet-200',
//   },
//   turquoise: {
//     top: 'bg-cyan-400',
//     bottom: 'bg-cyan-800',
//     left: 'bg-cyan-600',
//     back: 'bg-cyan-900',
//     rightResting: 'bg-cyan-600',
//     rightBorder: 'border-cyan-500',
//     textTitle: 'text-cyan-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-cyan-600',
//     pillBg: 'bg-cyan-50',
//     borderActive: 'border-cyan-200',
//   },
//   gradient: {
//     top: 'bg-violet-400',
//     bottom: 'bg-violet-800',
//     left: 'bg-violet-600',
//     back: 'bg-violet-900',
//     rightResting: 'bg-violet-600',
//     rightBorder: 'border-violet-500',
//     textTitle: 'text-violet-900',
//     textBody: 'text-slate-600',
//     pillText: 'text-violet-600',
//     pillBg: 'bg-violet-50',
//     borderActive: 'border-violet-200',
//   },
// };

// interface Cube3DProps {
//   item: ModuleItem;
//   onClick: (item: ModuleItem) => void;
// }

// const Cube3D: React.FC<Cube3DProps> = ({ item, onClick }) => {
//   const [isHovered, setIsHovered] = useState(false);
//   const [isFlipped, setIsFlipped] = useState(false);
//   const [halfSize, setHalfSize] = useState("7.5rem");
//   // Add state for random animation offsets
//   const [animDelay, setAnimDelay] = useState("0s");
//   const [animDuration, setAnimDuration] = useState("6s");

//   const { classes, currentTheme } = useTheme();

//   const colors = themePalette[currentTheme?.id] || themePalette['default'];

//   // Responsive sizing & Random Animation logic
//   useEffect(() => {
//     // 1. Calculate size based on screen
//     const updateSize = () => {
//       if (window.matchMedia('(min-width: 768px)').matches) {
//         setHalfSize("7.5rem");
//       } else {
//         setHalfSize("4.5rem");
//       }
//     };
//     updateSize();
//     window.addEventListener('resize', updateSize);

//     // 2. Generate random animation values to desynchronize cubes
//     // Delay between -5s and 0s effectively starts the animation at a random point in its loop immediately
//     setAnimDelay(`${-Math.random() * 5}s`);
//     // Vary duration slightly (between 5s and 7s) so they drift organically
//     setAnimDuration(`${5 + Math.random() * 2}s`);

//     return () => window.removeEventListener('resize', updateSize);
//   }, []);

//   const faceClass = `absolute inset-0 rounded-lg flex flex-col items-center justify-center backface-visible overflow-hidden transition-all duration-500 shadow-sm border border-white/20`;

//   const handleInteraction = () => {
//     const hasHover = window.matchMedia('(hover: hover)').matches;
//     if (hasHover) {
//       onClick(item);
//     } else {
//       if (isFlipped) onClick(item);
//       else setIsFlipped(true);
//     }
//   };

//   const handleMouseLeave = () => {
//     setIsHovered(false);
//     setIsFlipped(false);
//   };

//   const isShowingInfo = isHovered || isFlipped;

//   return (
//     <>
//       <style>
//         {`
//           @keyframes floatCube {
//             0% { transform: rotateX(-5deg) rotateY(-10deg); }
//             50% { transform: rotateX(-12deg) rotateY(10deg); }
//             100% { transform: rotateX(-5deg) rotateY(-10deg); }
//           }
//           @keyframes floatShadow {
//             0% { transform: translateX(-50%) scale(1); opacity: 0.2; }
//             50% { transform: translateX(-50%) scale(0.85); opacity: 0.15; }
//             100% { transform: translateX(-50%) scale(1); opacity: 0.2; }
//           }
//           /* This class is applied to the wrapper to handle the continuous float */
//           .cube-floater {
//             /* Animation is defined inline to use dynamic duration */
//             transform-style: preserve-3d;
//             width: 100%;
//             height: 100%;
//           }
//         `}
//       </style>

//       <div
//         className={`relative w-36 h-36 md:w-60 md:h-60 group cursor-pointer perspective-1000 mx-auto my-6`}
//         onMouseEnter={() => setIsHovered(true)}
//         onMouseLeave={handleMouseLeave}
//         onClick={handleInteraction}
//         style={{ perspective: "1200px" }}
//       >
//         {/* Wrapper for Floating Animation - Always runs, preserving 3D context */}
//         <div
//           className="cube-floater"
//           style={{
//             // Apply the random duration and delay here
//             animation: !isShowingInfo ? `floatCube ${animDuration} ease-in-out infinite` : "none",
//             animationDelay: !isShowingInfo ? animDelay : undefined
//           }}
//         >

//           {/* Inner Container for Interaction Rotation - Handles the turn */}
//           <div
//             className={`relative w-full h-full transition-transform duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) transform-style-3d`}
//             style={{
//               transformStyle: "preserve-3d",
//               // We only rotate Y here. The Tilt (X and Y) comes from the parent .cube-floater
//               transform: isShowingInfo ? "rotateY(-90deg)" : "rotateY(0deg)",
//             }}
//           >

//             {/* --- FRONT FACE --- */}
//             <div
//               className={`${faceClass} ${classes.cube.frontGradient} shadow-2xl`}
//               style={{ transform: `translateZ(${halfSize})` }}
//             >
//               {/* Subtle top highlight for 3D bevel effect */}
//               <div className="absolute top-0 left-0 right-0 h-1 bg-white/40"></div>

//               <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>

//               <div className={`${classes.cube.frontIconBg} p-3 md:p-5 rounded-full mb-3 md:mb-5 shadow-inner relative z-10`}>
//                 <div className="hidden md:block">{getIcon(item.iconName, 40, "text-white")}</div>
//                 <div className="block md:hidden">{getIcon(item.iconName, 24, "text-white")}</div>
//               </div>
//               <h3 className={`text-sm md:text-xl font-medium ${classes.cube.frontTitle} text-center px-2 md:px-6 tracking-wide leading-tight text-white relative z-10 drop-shadow-md`}>
//                 {item.title}
//               </h3>
//             </div>

//             {/* --- RIGHT FACE --- */}
//             <div
//               className={`${faceClass} ${isShowingInfo ? `bg-white ${colors.borderActive}` : `${colors.rightResting} ${colors.rightBorder}`}`}
//               style={{ transform: `rotateY(90deg) translateZ(${halfSize})` }}
//             >
//               <div className={`w-full h-full p-3 md:p-6 flex flex-col justify-between text-center transition-opacity duration-300 ${isShowingInfo ? 'opacity-100 delay-200' : 'opacity-0'}`}>
//                 <div>
//                   <h4 className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-3 ${colors.textTitle} opacity-80`}>
//                     Overview
//                   </h4>
//                   <p className={`text-[10px] md:text-sm font-normal leading-relaxed ${colors.textBody} line-clamp-4`}>
//                     {item.shortDescription}
//                   </p>
//                 </div>
//                 <div className={`flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${colors.pillText} ${colors.pillBg} py-2 px-4 rounded-full mx-auto`}>
//                   Read More <ArrowRight size={12} className="md:w-3.5 md:h-3.5" />
//                 </div>
//               </div>

//               <div className={`absolute inset-0 ${colors.back}/40 ${isShowingInfo ? 'opacity-0' : 'opacity-100'}`}></div>
//             </div>

//             {/* --- OTHER SIDES --- */}
//             <div className={`${faceClass} ${colors.back}`} style={{ transform: `rotateY(180deg) translateZ(${halfSize})` }}></div>
//             <div className={`${faceClass} ${colors.left}`} style={{ transform: `rotateY(-90deg) translateZ(${halfSize})` }}></div>
//             <div className={`${faceClass} ${colors.top}`} style={{ transform: `rotateX(90deg) translateZ(${halfSize})` }}></div>
//             <div className={`${faceClass} ${colors.bottom}`} style={{ transform: `rotateX(-90deg) translateZ(${halfSize})` }}></div>
//           </div>
//         </div>

//         {/* Floating Shadow */}
//         <div
//           className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/20 blur-xl rounded-[100%] transition-all duration-500`}
//           style={{
//             animation: !isShowingInfo ? `floatShadow ${animDuration} ease-in-out infinite` : "none",
//             animationDelay: !isShowingInfo ? animDelay : undefined,
//             opacity: isShowingInfo ? 0.4 : undefined, // Slightly stronger shadow when "active"
//             transform: isShowingInfo ? "translateX(-50%) scale(0.6)" : undefined
//           }}
//         ></div>
//       </div>
//     </>
//   );
// };

// export default Cube3D;










// import React, { useState, useEffect } from 'react';
// import { ModuleItem } from '../types';
// import { useTheme } from '../theme';
// import {
//   Eye,
//   Activity,
//   AlertTriangle,
//   Disc,
//   HelpCircle,
//   Calendar,
//   ClipboardList,
//   FileText,
//   Info,
//   ArrowRight
// } from 'lucide-react';

// const getIcon = (name: string, size = 32, color = "currentColor") => {
//   const props = { size, className: color };
//   switch (name) {
//     case 'type': return <Eye {...props} />;
//     case 'surgery': return <Activity {...props} />;
//     case 'risk': return <AlertTriangle {...props} />;
//     case 'iol': return <Disc {...props} />;
//     case 'options': return <HelpCircle {...props} />;
//     case 'day': return <Calendar {...props} />;
//     case 'preop': return <ClipboardList {...props} />;
//     case 'postop': return <Info {...props} />;
//     case 'forms': return <FileText {...props} />;
//     default: return <Eye {...props} />;
//   }
// };

// interface Cube3DProps {
//   item: ModuleItem;
//   onClick: (item: ModuleItem) => void;
// }

// const Cube3D: React.FC<Cube3DProps> = ({ item, onClick }) => {
//   const [isHovered, setIsHovered] = useState(false);
//   const [isFlipped, setIsFlipped] = useState(false);
//   const [halfSize, setHalfSize] = useState("7.5rem"); // Default to desktop size
//   const { classes } = useTheme();

//   // Responsive sizing logic
//   useEffect(() => {
//     const updateSize = () => {
//       // Check if it matches the 'md' breakpoint (768px)
//       if (window.matchMedia('(min-width: 768px)').matches) {
//         setHalfSize("7.5rem"); // 15rem / 2 (w-60)
//       } else {
//         setHalfSize("4.5rem"); // 9rem / 2 (w-36)
//       }
//     };

//     // Initial check
//     updateSize();

//     // Listener
//     window.addEventListener('resize', updateSize);
//     return () => window.removeEventListener('resize', updateSize);
//   }, []);

//   // UPDATED: Added a faint border to help the edges look "solid" and distinct
//   const faceClass = `absolute inset-0 border border-white/10 rounded-xl flex flex-col items-center justify-center backface-visible overflow-hidden transition-colors duration-300 shadow-sm`;

//   const handleInteraction = () => {
//     const hasHover = window.matchMedia('(hover: hover)').matches;

//     if (hasHover) {
//       onClick(item);
//     } else {
//       if (isFlipped) {
//         onClick(item);
//       } else {
//         setIsFlipped(true);
//       }
//     }
//   };

//   const handleMouseLeave = () => {
//     setIsHovered(false);
//     setIsFlipped(false);
//   };

//   return (
//     <div
//       className={`relative w-36 h-36 md:w-60 md:h-60 group cursor-pointer perspective-1000 mx-auto my-6`}
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={handleMouseLeave}
//       onClick={handleInteraction}
//       style={{ perspective: "1200px" }} // Increased perspective slightly for better 3D look
//     >
//       <div
//         className={`relative w-full h-full transition-transform duration-500 ease-out transform-style-3d`}
//         style={{
//           transformStyle: "preserve-3d",
//           // UPDATED: This logic creates the "Resting Tilt"
//           // When idle: Rotate X and Y slightly to show depth.
//           // When active: Rotate Y full -90deg to show the side face.
//           transform: (isHovered || isFlipped)
//             ? "rotateY(-90deg)"
//             : "rotateX(10deg) rotateY(-15deg) rotateZ(2deg)",
//         }}
//       >

//         {/* FRONT FACE - Branding */}
//         <div
//           className={`${faceClass} ${classes.cube.frontGradient} shadow-md`}
//           style={{ transform: `translateZ(${halfSize})` }}
//         >
//           {/* Shine effect on tilt */}
//           <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/20 opacity-100 transition-opacity duration-300"></div>

//           <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>

//           <div className={`${classes.cube.frontIconBg} p-3 md:p-5 rounded-full mb-3 md:mb-5 shadow-sm relative z-10`}>
//             {/* Responsive Icon Size */}
//             <div className="hidden md:block">
//               {getIcon(item.iconName, 40, "text-white")}
//             </div>
//             <div className="block md:hidden">
//               {getIcon(item.iconName, 24, "text-white")}
//             </div>
//           </div>
//           <h3 className={`text-sm md:text-xl font-medium ${classes.cube.frontTitle} text-center px-2 md:px-6 tracking-wide leading-tight relative z-10`}>
//             {item.title}
//           </h3>
//         </div>

//         {/* RIGHT FACE - Info (Revealed on Hover) */}
//         <div
//           className={`${faceClass} ${classes.cube.right} border ${classes.cube.rightBorder}`}
//           style={{ transform: `rotateY(90deg) translateZ(${halfSize})` }}
//         >
//           <div className="p-3 md:p-6 flex flex-col h-full justify-between text-center bg-white">
//             <div>
//               <h4 className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 md:mb-3 ${classes.cube.rightTitle} opacity-80`}>
//                 Overview
//               </h4>
//               <p className={`text-[10px] md:text-sm font-normal leading-relaxed ${classes.cube.rightText} line-clamp-4 md:line-clamp-4`}>
//                 {item.shortDescription}
//               </p>
//             </div>
//             <div className={`flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-wider ${classes.cube.rightActionText} ${classes.cube.rightActionBg} py-1.5 px-3 md:py-2 md:px-4 rounded-full`}>
//               Read More <ArrowRight size={12} className="md:w-3.5 md:h-3.5" />
//             </div>
//           </div>
//         </div>

//         {/* BACK FACE */}
//         <div
//           className={`${faceClass} ${classes.cube.back}`}
//           style={{ transform: `rotateY(180deg) translateZ(${halfSize})` }}
//         ></div>

//         {/* LEFT FACE */}
//         <div
//           className={`${faceClass} ${classes.cube.left}`}
//           style={{ transform: `rotateY(-90deg) translateZ(${halfSize})` }}
//         ></div>

//         {/* TOP FACE */}
//         <div
//           className={`${faceClass} ${classes.cube.top} bg-blue-400/90`} // Added slight color to top
//           style={{ transform: `rotateX(90deg) translateZ(${halfSize})` }}
//         ></div>

//         {/* BOTTOM FACE */}
//         <div
//           className={`${faceClass} ${classes.cube.bottom} bg-blue-800/90`} // Added darken to bottom
//           style={{ transform: `rotateX(-90deg) translateZ(${halfSize})` }}
//         ></div>
//       </div>

//       {/* Material Shadow Elevation */}
//       <div className={`absolute -bottom-6 md:-bottom-10 left-1/2 -translate-x-1/2 w-24 md:w-40 h-3 md:h-4 bg-black/20 blur-lg rounded-[100%] transition-all duration-500 ${isHovered ? 'scale-75 opacity-20' : 'scale-100 opacity-40'}`}></div>
//     </div>
//   );
// };

// export default Cube3D;