import React, { useState, useRef, useEffect } from 'react';

interface VisionSliderProps {
    leftImage: string;
    rightImage: string;
    leftLabel: string;
    rightLabel: string;
    rightFilter?: string;
    leftScale?: number;
    rightScale?: number;
    caption?: string;
}

const VisionSlider: React.FC<VisionSliderProps> = ({
    leftImage,
    rightImage,
    leftLabel,
    rightLabel,
    rightFilter,
    leftScale,
    rightScale,
    caption,
}) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(percentage);
    };

    const handleMouseDown = () => {
        isDragging.current = true;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging.current) {
            handleMove(e.clientX);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX);
    };

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            isDragging.current = false;
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    return (
        <div className="relative w-full h-full">
            {/* Container */}
            <div
                ref={containerRef}
                className="relative w-full h-full overflow-hidden cursor-ew-resize select-none"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
            >
                {/* Right Image (Background - with filter if provided) */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url(${rightImage})`,
                        filter: rightFilter || 'none',
                        transform: rightScale ? `scale(${rightScale})` : undefined,
                    }}
                />

                {/* Left Image (Foreground - clipped) */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url(${leftImage})`,
                        clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                        transform: leftScale ? `scale(${leftScale})` : undefined,
                    }}
                />

                {/* Labels - fade based on slider position */}
                {/* Left label: visible when slider is right (showing left/healthy image) */}
                <div
                    className="absolute top-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-semibold text-slate-700 shadow-sm transition-opacity duration-200"
                    style={{
                        opacity: sliderPosition > 30 ? Math.min(1, (sliderPosition - 30) / 40) : 0,
                        pointerEvents: sliderPosition > 30 ? 'auto' : 'none'
                    }}
                >
                    {leftLabel}
                </div>
                {/* Right label: visible when slider is left (showing right/affected image) */}
                <div
                    className="absolute top-3 right-3 px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity duration-200"
                    style={{
                        opacity: sliderPosition < 70 ? Math.min(1, (70 - sliderPosition) / 40) : 0,
                        pointerEvents: sliderPosition < 70 ? 'auto' : 'none'
                    }}
                >
                    {rightLabel}
                </div>

                {/* Slider Handle */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
                    style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                >
                    {/* Circle Handle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-slate-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
                            <path d="M18 8L22 12L18 16" />
                            <path d="M6 8L2 12L6 16" />
                        </svg>
                    </div>
                </div>

                {/* Caption Overlay */}
                {caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/90 to-transparent p-4 pt-8">
                        <p className="text-xs uppercase tracking-wider text-slate-300 mb-1">Visual Simulation</p>
                        <p className="text-sm font-medium text-white">{caption}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisionSlider;
