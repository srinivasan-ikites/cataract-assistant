import React from 'react';
import { ChevronRight, Loader2, Upload, X } from 'lucide-react';

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
}

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
}) => {
  return (
    <div className="space-y-4 lg:max-h-[calc(100vh-220px)] overflow-y-auto pl-1 no-scrollbar">
      <div className="relative bg-white rounded-2xl border border-transparent shadow-sm p-6">
        <div className="bg-[#f7f9ff] border-2 border-dashed border-blue-200/80 rounded-3xl p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-500 mb-3">
            <Upload size={26} />
          </div>
          <h4 className="font-semibold text-slate-800 text-lg">Upload EMR / IOL Sheets</h4>
          <p className="text-sm text-slate-500 mt-1">Drag and drop files here, or click to scan with camera for OCR extraction.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-[0.99]"
          >
            <Upload size={16} />
            Upload Document
          </button>
          <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileChange} />

          {files.length > 0 && (
            <div className="mt-4 text-left space-y-3">
              <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg text-sm text-slate-700 border border-slate-100 shadow-[0_4px_10px_-6px_rgba(0,0,0,0.08)]">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={startExtraction}
                disabled={extracting}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-xs font-semibold hover:bg-black transition-all disabled:opacity-70"
              >
                {extracting ? 'Uploading & extracting...' : 'Run Extraction'}
              </button>
            </div>
          )}
        </div>

        {extracting && (
          <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-blue-600">
            <Loader2 className="animate-spin" size={22} />
            <p className="text-sm font-semibold text-slate-600">Processing...</p>
          </div>
        )}
      </div>

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
            <p className="text-xs text-slate-400">No recent uploads yet.</p>
          ) : (
            (showAllUploads ? recentUploads : recentUploads.slice(0, 4)).map((file, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </div>
                  <span className="truncate">{file}</span>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPanel;


