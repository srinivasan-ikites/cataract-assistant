import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight,
  Upload,
  X,
  FileImage,
  CheckCircle2,
  Scan,
  Brain,
  FileText,
  Sparkles,
  AlertCircle,
  Clock
} from 'lucide-react';

interface UploadPanelProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  startExtraction: () => void;
  extracting: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  recentUploads: string[];
  showAllUploads: boolean;
  setShowAllUploads: React.Dispatch<React.SetStateAction<boolean>>;
  extractionError?: string | null;
  extractionSuccess?: boolean;
}

// Extraction phases for the multi-step loader
const EXTRACTION_PHASES = [
  {
    id: 'upload',
    label: 'Uploading Documents',
    icon: Upload,
    duration: 3000,
    messages: ['Preparing files...', 'Uploading to server...', 'Files received...']
  },
  {
    id: 'scan',
    label: 'Scanning Images',
    icon: Scan,
    duration: 8000,
    messages: ['Detecting document type...', 'Processing image quality...', 'Enhancing for OCR...']
  },
  {
    id: 'ocr',
    label: 'Extracting Text',
    icon: FileText,
    duration: 15000,
    messages: ['Running OCR engine...', 'Recognizing characters...', 'Parsing text blocks...']
  },
  {
    id: 'analyze',
    label: 'Analyzing Data',
    icon: Brain,
    duration: 20000,
    messages: ['Identifying medical fields...', 'Extracting patient data...', 'Validating information...']
  },
  {
    id: 'finalize',
    label: 'Finalizing',
    icon: Sparkles,
    duration: 5000,
    messages: ['Structuring output...', 'Preparing review...', 'Almost there...']
  },
];

// Extraction Loader Component
const ExtractionLoader: React.FC<{ fileCount: number }> = ({ fileCount }) => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Progress animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach completion to account for variable processing time
        const increment = prev < 30 ? 2 : prev < 60 ? 1.5 : prev < 85 ? 0.8 : 0.3;
        return Math.min(prev + increment, 95); // Cap at 95% until actual completion
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Phase progression
  useEffect(() => {
    const phaseDurations = EXTRACTION_PHASES.map((p) => p.duration);
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += 1000;
      let accumulated = 0;

      for (let i = 0; i < phaseDurations.length; i++) {
        accumulated += phaseDurations[i];
        if (elapsed < accumulated) {
          setCurrentPhase(i);
          break;
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Message cycling within current phase
  useEffect(() => {
    const messages = EXTRACTION_PHASES[currentPhase]?.messages || [];
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [currentPhase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const CurrentIcon = EXTRACTION_PHASES[currentPhase]?.icon || Scan;
  const currentMessage = EXTRACTION_PHASES[currentPhase]?.messages[messageIndex] || 'Processing...';

  return (
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-10">
      {/* Main loader animation */}
      <div className="relative mb-6">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-blue-100 animate-ping opacity-20" />

        {/* Middle rotating ring */}
        <div className="absolute inset-2 w-20 h-20 rounded-full border-2 border-dashed border-blue-200 animate-[spin_8s_linear_infinite]" />

        {/* Inner gradient ring */}
        <div
          className="absolute inset-3 w-18 h-18 rounded-full animate-[spin_3s_linear_infinite]"
          style={{
            width: 72,
            height: 72,
            background: 'conic-gradient(from 0deg, transparent, #3B82F6, #6366F1, transparent)',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px))',
          }}
        />

        {/* Center icon */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200 flex items-center justify-center">
            <CurrentIcon className="text-white animate-pulse" size={28} />
          </div>
        </div>
      </div>

      {/* Phase label */}
      <div className="text-center mb-4">
        <p className="text-lg font-bold text-slate-800">
          {EXTRACTION_PHASES[currentPhase]?.label || 'Processing'}
        </p>
        <p className="text-sm text-slate-500 mt-1 h-5 transition-all duration-300">
          {currentMessage}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-4">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{Math.round(progress)}%</span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatTime(elapsedTime)}
          </span>
        </div>
      </div>

      {/* Phase indicators */}
      <div className="flex items-center gap-2 mt-2">
        {EXTRACTION_PHASES.map((phase, idx) => {
          const isComplete = idx < currentPhase;
          const isCurrent = idx === currentPhase;
          const PhaseIcon = phase.icon;

          return (
            <div
              key={phase.id}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                ${isComplete ? 'bg-green-100 text-green-600' : ''}
                ${isCurrent ? 'bg-blue-100 text-blue-600 scale-110 shadow-md' : ''}
                ${!isComplete && !isCurrent ? 'bg-slate-100 text-slate-300' : ''}
              `}
              title={phase.label}
            >
              {isComplete ? (
                <CheckCircle2 size={16} />
              ) : (
                <PhaseIcon size={14} />
              )}
            </div>
          );
        })}
      </div>

      {/* File count info */}
      <p className="text-xs text-slate-400 mt-4">
        Processing {fileCount} document{fileCount !== 1 ? 's' : ''}
      </p>

      {/* Helpful tips that cycle */}
      <div className="mt-4 px-4 py-2 bg-amber-50 rounded-lg border border-amber-100">
        <p className="text-xs text-amber-700 text-center">
          <AlertCircle className="inline-block mr-1 -mt-0.5" size={12} />
          Processing time varies based on document complexity and image quality
        </p>
      </div>
    </div>
  );
};

// Success state overlay component
const ExtractionSuccess: React.FC = () => {
  return (
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-10 animate-fadeIn">
      <div className="relative mb-4">
        {/* Success animation */}
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-[scale_0.3s_ease-out]">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
            <CheckCircle2 className="text-white" size={36} />
          </div>
        </div>
        {/* Confetti-like particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-[ping_1s_ease-out]"
            style={{
              backgroundColor: ['#10B981', '#6366F1', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6'][i],
              top: '50%',
              left: '50%',
              transform: `rotate(${i * 60}deg) translateY(-40px)`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
      <p className="text-xl font-bold text-emerald-800">Extraction Complete!</p>
      <p className="text-sm text-emerald-600 mt-1">Data is ready for review</p>
    </div>
  );
};

// Error state overlay component
const ExtractionError: React.FC<{ error: string; onRetry: () => void; onDismiss: () => void }> = ({
  error,
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-10">
      <div className="relative mb-4">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg shadow-red-200">
            <AlertCircle className="text-white" size={36} />
          </div>
        </div>
      </div>
      <p className="text-xl font-bold text-red-800">Extraction Failed</p>
      <p className="text-sm text-red-600 mt-1 text-center max-w-[250px]">{error}</p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onRetry}
          className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-200 hover:shadow-xl transition-all"
        >
          Try Again
        </button>
        <button
          onClick={onDismiss}
          className="px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

const UploadPanel: React.FC<UploadPanelProps> = ({
  fileInputRef,
  files,
  setFiles,
  startExtraction,
  extracting,
  handleFileChange,
  recentUploads,
  showAllUploads,
  setShowAllUploads,
  extractionError,
  extractionSuccess,
}) => {
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success briefly when extraction completes
  useEffect(() => {
    if (extractionSuccess && !extracting) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [extractionSuccess, extracting]);

  // Show error when extraction fails
  useEffect(() => {
    if (extractionError) {
      setShowError(true);
    }
  }, [extractionError]);

  const handleRetry = () => {
    setShowError(false);
    startExtraction();
  };

  const handleDismissError = () => {
    setShowError(false);
  };

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      // Filter for image and document files
      const validFiles = Array.from(droppedFiles).filter((file) => {
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';
        const isDocument = file.type.includes('document') ||
                          file.name.endsWith('.doc') ||
                          file.name.endsWith('.docx');
        return isImage || isPdf || isDocument;
      });

      if (validFiles.length > 0) {
        setFiles((prev) => {
          // Avoid duplicates based on name and size
          const newFiles = validFiles.filter(
            (newFile) => !prev.some(
              (existing) => existing.name === newFile.name && existing.size === newFile.size
            )
          );
          return [...prev, ...newFiles];
        });
      }
    }
  }, [setFiles]);

  // Get file type icon
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')) {
      return <FileImage size={14} className="text-blue-500" />;
    }
    return <FileText size={14} className="text-slate-500" />;
  };

  return (
    <div className="space-y-4 lg:max-h-[calc(100vh-220px)] overflow-y-auto pl-1 no-scrollbar">
      <div className={`relative bg-white rounded-2xl border border-transparent shadow-sm p-6 ${extracting || showSuccess || showError ? 'min-h-[420px]' : ''}`}>
        {/* Upload area with drag and drop */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            relative bg-[#f7f9ff] border-2 border-dashed rounded-3xl p-6 text-center
            transition-all duration-300 ease-out
            ${isDragging
              ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg shadow-blue-100'
              : 'border-blue-200/80 hover:border-blue-300'
            }
          `}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 rounded-3xl bg-blue-500/10 flex items-center justify-center z-10 pointer-events-none">
              <div className="bg-white px-6 py-4 rounded-2xl shadow-xl border border-blue-200">
                <Upload className="mx-auto text-blue-500 mb-2 animate-bounce" size={32} />
                <p className="text-sm font-bold text-blue-700">Drop files here</p>
                <p className="text-xs text-blue-500 mt-1">Images, PDFs, or documents</p>
              </div>
            </div>
          )}

          <div className={`mx-auto w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-500 mb-3 transition-transform ${isDragging ? 'scale-110' : ''}`}>
            <Upload size={26} />
          </div>
          <h4 className="font-semibold text-slate-800 text-lg">Upload EMR / IOL Sheets</h4>
          <p className="text-sm text-slate-500 mt-1">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Supports images (JPG, PNG), PDFs, and documents
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-[0.99]"
          >
            <Upload size={16} />
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileChange}
          />

          {/* Selected files list */}
          {files.length > 0 && !extracting && (
            <div className="mt-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 bg-white rounded-lg text-sm text-slate-700 border border-slate-100 shadow-[0_4px_10px_-6px_rgba(0,0,0,0.08)] group hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(f.name)}
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-300 hover:text-rose-500 transition-colors ml-2 opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={startExtraction}
                disabled={extracting}
                className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white py-3 rounded-xl text-sm font-bold hover:from-slate-900 hover:to-black transition-all disabled:opacity-70 shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
              >
                <Scan size={16} />
                Run Extraction
              </button>
            </div>
          )}
        </div>

        {/* Extraction loader overlay */}
        {extracting && <ExtractionLoader fileCount={files.length} />}

        {/* Success overlay */}
        {showSuccess && !extracting && <ExtractionSuccess />}

        {/* Error overlay */}
        {showError && extractionError && !extracting && (
          <ExtractionError
            error={extractionError}
            onRetry={handleRetry}
            onDismiss={handleDismissError}
          />
        )}
      </div>

      {/* Recent uploads section - hidden during extraction for cleaner UI */}
      {!extracting && !showSuccess && !showError && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Recent Uploads</p>
          {recentUploads.length > 4 && (
            <button
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => setShowAllUploads((v) => !v)}
            >
              {showAllUploads ? 'View Less' : 'View All'}
            </button>
          )}
        </div>
        <div className="p-4 space-y-2">
          {recentUploads.length === 0 ? (
            <div className="text-center py-4">
              <FileImage className="mx-auto text-slate-200 mb-2" size={32} />
              <p className="text-xs text-slate-400">No recent uploads yet.</p>
              <p className="text-xs text-slate-300 mt-1">Upload documents to begin extraction</p>
            </div>
          ) : (
            (showAllUploads ? recentUploads : recentUploads.slice(0, 4)).map((file, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <span className="truncate">{file}</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default UploadPanel;
