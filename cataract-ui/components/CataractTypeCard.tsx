import React from 'react';
import { CataractType } from '../data/cataractTypes';
import {
    CircleDot,
    Aperture,
    Target,
    Layers,
    Sparkles,
    ArrowRight,
    Eye
} from 'lucide-react';

interface CataractTypeCardProps {
    cataract: CataractType;
    onClick: () => void;
    className?: string;
}

const getIconForType = (id: string) => {
    switch (id) {
        case 'nuclear_sclerosis': return CircleDot;
        case 'cortical': return Aperture;
        case 'posterior_subcapsular': return Target;
        case 'combined': return Layers;
        case 'congenital': return Sparkles;
        default: return Eye;
    }
};

const CataractTypeCard: React.FC<CataractTypeCardProps> = ({
    cataract,
    onClick,
    className = ""
}) => {
    const Icon = getIconForType(cataract.id);
    const colorClass = cataract.color.replace('bg-', 'text-').replace('-100', '-600');
    const bgClass = cataract.color.replace('bg-', 'bg-').replace('-100', '-50');
    const borderClass = cataract.color.replace('bg-', 'border-').replace('-100', '-200');

    return (
        <div
            onClick={onClick}
            className={`
                group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5
                transition-all duration-300 ease-out
                hover:shadow-md hover:border-blue-300 hover:-translate-y-1
                cursor-pointer active:scale-[0.98]
                ${className}
            `}
        >
            {/* Background Decoration */}
            <div className={`absolute top-0 right-0 w-24 h-24 ${bgClass} rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500`} />

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-lg ${cataract.bgColor} ${colorClass}`}>
                        <Icon size={24} strokeWidth={2} />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-blue-500">
                        <ArrowRight size={20} />
                    </div>
                </div>

                <div className="mt-auto">
                    <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">
                        {cataract.name}
                    </h3>
                    <p className="text-sm text-slate-600 leading-snug line-clamp-2">
                        {cataract.tagline}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CataractTypeCard;
