import React, { useEffect, useState } from 'react';
import { ModuleItem, GeminiContentResponse } from '../types';
import { generateModuleContent } from '../services/gemini';
import { X, PlayCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../theme';

interface DetailModalProps {
  item: ModuleItem | null;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, onClose }) => {
  const [content, setContent] = useState<GeminiContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { classes } = useTheme();

  useEffect(() => {
    if (item) {
      setLoading(true);
      generateModuleContent(item.title)
        .then(data => {
          setContent(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setContent(null);
    }
  }, [item]);

  if (!item) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]`}>
      {/* Scrim / Backdrop */}
      <div 
        className={`absolute inset-0 ${classes.dialogOverlay} backdrop-blur-sm transition-opacity`}
        onClick={onClose}
      ></div>

      {/* Material Dialog Container */}
      <div className={`relative w-full max-w-5xl max-h-[85vh] ${classes.dialogPanel} rounded-[28px] shadow-2xl overflow-hidden flex flex-col md:flex-row transform transition-all animate-[scaleIn_0.2s_ease-out]`}>
        
        {/* Close Button - Absolute */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors text-slate-700"
        >
          <X size={24} />
        </button>

        {/* Left: Media / Video */}
        <div className="w-full md:w-2/5 bg-slate-100 relative flex flex-col items-center justify-center p-8 border-b md:border-b-0 md:border-r border-slate-200">
           {loading ? (
             <div className="flex flex-col items-center text-slate-400 gap-3">
               <Loader2 className="animate-spin" size={40} />
               <span className="text-sm font-medium tracking-wide uppercase">Loading AI Content...</span>
             </div>
           ) : (
             <>
               <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-2xl shadow-lg overflow-hidden group cursor-pointer">
                 <img 
                   src={`https://picsum.photos/seed/${item.id}/800/600`} 
                   alt="Visual" 
                   className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700 ease-out"
                 />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle size={64} className="text-white drop-shadow-lg opacity-90 group-hover:opacity-100 transition-all group-hover:scale-110" />
                 </div>
               </div>
               <div className="mt-8 text-center">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Video Guide</span>
                 <p className="text-slate-600 mt-2 text-sm italic font-medium px-4">
                   "{content?.videoScriptSuggestion || "Visual demonstration available."}"
                 </p>
               </div>
             </>
           )}
        </div>

        {/* Right: Text Content */}
        <div className="w-full md:w-3/5 p-8 md:p-12 overflow-y-auto bg-white">
          {loading ? (
             <div className="space-y-6 animate-pulse mt-8">
               <div className="h-10 bg-slate-100 rounded-lg w-3/4"></div>
               <div className="h-4 bg-slate-50 rounded w-full"></div>
               <div className="h-4 bg-slate-50 rounded w-full"></div>
               <div className="h-32 bg-slate-50 rounded-2xl w-full mt-8"></div>
             </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-3xl md:text-4xl font-normal text-slate-900 mb-3 tracking-tight">{content?.title || item.title}</h2>
                <div className={`h-1.5 w-24 ${classes.dialogHighlight} rounded-full`}></div>
              </div>
              
              <div className="space-y-8">
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Summary</h3>
                    <p className="text-lg text-slate-700 leading-relaxed font-normal">
                    {content?.summary}
                    </p>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Key Details</h3>
                    <ul className="space-y-4">
                    {content?.details.map((detail, index) => (
                        <li key={index} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <span className={`flex-shrink-0 w-8 h-8 rounded-full ${classes.dialogHighlight} ${classes.primaryText} flex items-center justify-center text-sm font-bold`}>
                                {index + 1}
                            </span>
                            <span className="text-slate-700 leading-snug">{detail}</span>
                        </li>
                    ))}
                    </ul>
                </div>

                <div className={`mt-8 p-5 rounded-xl ${classes.surfaceVariant} border border-slate-100 text-center`}>
                   <p className={`text-sm ${classes.primaryText} font-medium`}>
                     Disclaimer: This information is for educational purposes only.
                   </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailModal;