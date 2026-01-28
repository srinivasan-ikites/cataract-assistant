import React, { useEffect, useState, Fragment } from 'react';
import { ModuleItem, GeminiContentResponse } from '../types';
import { generateModuleContent } from '../services/gemini';
import { Patient, api } from '../services/api';
import { X, Loader2, ChevronDown, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';
import { useTheme } from '../theme';
import ReactMarkdown from 'react-markdown';
import DiagnosisModal from './DiagnosisModal';
import SurgeryModal from './SurgeryModal';
import IOLModal from './IOLModal';
import IOLOptionsModal from './IOLOptionsModal';
import BeforeSurgeryModal from './BeforeSurgeryModal';
import AfterSurgeryModal from './AfterSurgeryModal';
import RiskComplicationsModal from './RiskComplicationsModal';
import CostInsuranceModal from './CostInsuranceModal';

interface DetailModalProps {
  item: ModuleItem | null;
  patient: Patient | null;
  onClose: () => void;
  onOpenChat: (initialMessage?: string) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, patient, onClose, onOpenChat }) => {
  const [content, setContent] = useState<GeminiContentResponse | null>(null);
  const [contentItemId, setContentItemId] = useState<string | null>(null); // Track which item content belongs to
  const [loading, setLoading] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [surgicalPackages, setSurgicalPackages] = useState<any[]>([]);
  const { classes } = useTheme();

  // Determine if we're effectively in a loading state
  // This is true if: loading is in progress OR content doesn't match current item
  const isEffectivelyLoading = loading || (item !== null && contentItemId !== item.id);

  const sanitizeQuestion = (q?: string) =>
    (q || "")
      .replace(/\*\*/g, "")
      .replace(/__/g, "")
      .replace(/`+/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // Fetch module content
  useEffect(() => {
    if (item) {
      setLoading(true);
      // Note: We don't clear contentItemId here - isEffectivelyLoading handles the stale check
      const pid = patient?.patient_id;
      generateModuleContent(item.title, pid || "")
        .then(data => {
          setContent(data);
          setContentItemId(item.id); // Mark this content as belonging to this item
          setLoading(false);
        })
        .catch(() => {
          setContentItemId(item.id); // Even on error, mark as loaded for this item
          setLoading(false);
        });
    } else {
      setContent(null);
      setContentItemId(null);
    }
  }, [item, patient]);

  // Fetch surgical packages for IOL Options modal
  useEffect(() => {
    const isIOLOptions = item?.title.toLowerCase().includes('my iol') ||
                         item?.title.toLowerCase().includes('iol options');
    const clinicId = patient?.clinic_id;

    if (isIOLOptions && clinicId) {
      api.getClinicPackages(clinicId)
        .then(data => {
          // API returns { status: "ok", packages: [...] }
          if (data?.packages) {
            setSurgicalPackages(data.packages);
          } else if (Array.isArray(data)) {
            setSurgicalPackages(data);
          }
        })
        .catch(err => {
          console.error('Failed to fetch surgical packages:', err);
          setSurgicalPackages([]);
        });
    }
  }, [item, patient?.clinic_id]);

  if (!item) return null;

  // Route to specialized modals IMMEDIATELY (pass loading state for internal handling)
  // This prevents flickering and size mismatch issues

  const titleLower = item.title.toLowerCase();

  // Route "My Diagnosis" to the specialized DiagnosisModal
  if (titleLower.includes('diagnosis')) {
    return (
      <DiagnosisModal
        patient={patient}
        moduleContent={content}
        onClose={onClose}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "My IOL Options" to the specialized IOLOptionsModal
  if (titleLower.includes('my iol') || titleLower.includes('iol options')) {
    return (
      <IOLOptionsModal
        patient={patient}
        surgicalPackages={surgicalPackages}
        moduleContent={content}
        onClose={onClose}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "Before Surgery" to BeforeSurgeryModal
  if (titleLower.includes('before surgery')) {
    return (
      <BeforeSurgeryModal
        onClose={onClose}
        patient={patient}
        moduleContent={content}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "What is an IOL?" to IOLModal (not "My IOL Options")
  if (titleLower.includes('iol') && !titleLower.includes('options')) {
    return (
      <IOLModal
        onClose={onClose}
        moduleContent={content}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "After Surgery" or "Recovery" to AfterSurgeryModal
  if (titleLower.includes('after surgery') || titleLower.includes('recovery')) {
    return (
      <AfterSurgeryModal
        patient={patient}
        onClose={onClose}
        moduleContent={content}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "Risks & Complications" to RiskComplicationsModal
  if (titleLower.includes('risk') || titleLower.includes('complication')) {
    return (
      <RiskComplicationsModal
        patient={patient}
        onClose={onClose}
        moduleContent={content}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "Cost & Insurance" to CostInsuranceModal
  if (titleLower.includes('cost') || titleLower.includes('insurance')) {
    return (
      <CostInsuranceModal
        patient={patient}
        onClose={onClose}
        moduleContent={content}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  // Route "Surgery" related modules (What is Cataract Surgery, Day of Surgery) to SurgeryModal
  if (titleLower.includes('surgery')) {
    const isDayOfSurgery = titleLower.includes('day of');
    return (
      <SurgeryModal
        patient={patient}
        onClose={onClose}
        isDayOfSurgery={isDayOfSurgery}
        moduleContent={content}
        onOpenChat={onOpenChat}
        isLoading={isEffectivelyLoading}
      />
    );
  }

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]`}>
      {/* Scrim / Backdrop */}
      <div
        className={`absolute inset-0 ${classes.dialogOverlay} backdrop-blur-sm transition-opacity`}
        onClick={onClose}
      ></div>

      {/* Material Dialog Container */}
      <div className={`relative w-full max-w-4xl max-h-[88vh] ${classes.dialogPanel} rounded-[28px] shadow-2xl overflow-hidden flex flex-col transform transition-all animate-[scaleIn_0.2s_ease-out]`}>
        {/* Close Button - Absolute */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors text-slate-700"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <div
          className="w-full p-6 md:p-8 overflow-y-auto bg-white space-y-8"
          style={{ scrollbarGutter: 'stable' }}
        >
          {loading ? (
            <div className="space-y-6 animate-pulse mt-8">
              <div className="h-10 bg-slate-100 rounded-lg w-3/4"></div>
              <div className="h-4 bg-slate-50 rounded w-full"></div>
              <div className="h-4 bg-slate-50 rounded w-full"></div>
              <div className="h-32 bg-slate-50 rounded-2xl w-full mt-8"></div>
            </div>
          ) : (
            <>
              <div className="space-y-8">
                <div className="space-y-3">
                  <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 tracking-tight">{content?.title || item.title}</h2>
                  <div className={`h-1.5 w-24 ${classes.dialogHighlight} rounded-full`}></div>
                  <div className="text-lg text-slate-700 leading-relaxed font-normal [&>p]:mb-2 last:[&>p]:mb-0">
                    <ReactMarkdown>{content?.summary || ""}</ReactMarkdown>
                  </div>
                </div>

                {/* Specialized Content Sections */}

                {/* CHECKLIST (Before/After Surgery) */}
                {content?.checklist && content.checklist.length > 0 && (
                  <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                    <h3 className="flex items-center gap-2 text-emerald-800 font-bold uppercase tracking-wider text-sm mb-4">
                      <CheckCircle2 size={18} />
                      Required Action Checklist
                    </h3>
                    <div className="space-y-3">
                      {content.checklist.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-emerald-100/50 shadow-sm">
                          <div className="w-5 h-5 rounded border-2 border-emerald-200 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TIMELINE (Day of Surgery) */}
                {content?.timeline && content.timeline.length > 0 && (
                  <div className="relative pl-4 space-y-8 before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6 pl-2">Your Surgery Day Journey</h3>
                    {content.timeline.map((step, i) => (
                      <div key={i} className="relative pl-8">
                        <div className="absolute left-[-5px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm ring-1 ring-slate-200" />
                        <h4 className="text-lg font-bold text-slate-900 mb-1">{step.step}</h4>
                        <p className="text-slate-600">{step.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* RISKS (Risks & Complications) */}
                {content?.risks && content.risks.length > 0 && (
                  <div className="space-y-6">
                    {content.risks.map((cat, i) => (
                      <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-2">
                          <AlertTriangle size={18} className="text-amber-500" />
                          {cat.category}
                        </div>
                        <ul className="divide-y divide-slate-100">
                          {cat.items.map((risk, j) => (
                            <li key={j} className="p-4 text-slate-600 hover:bg-slate-50/50">{risk}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* COST BREAKDOWN (Costs & Insurance) */}
                {content?.costBreakdown && content.costBreakdown.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-900 text-white p-4 font-bold flex justify-between items-center">
                      <span>Package Breakdown</span>
                      <DollarSign size={18} className="text-emerald-400" />
                    </div>
                    <div className="divide-y divide-slate-100">
                      {content.costBreakdown.map((item, i) => (
                        <div key={i} className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-2">
                          <div>
                            <div className="font-bold text-slate-800">{item.category}</div>
                            {item.note && <div className="text-xs text-slate-500 mt-1">{item.note}</div>}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className={`text-xs font-bold uppercase px-2 py-1 rounded ${item.covered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {item.covered ? 'Insurance' : 'Patient Pay'}
                            </div>
                            <div className="font-mono font-bold text-slate-900">{item.amount}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FAQs Section */}
                {content?.faqs && content.faqs.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Frequently Asked Questions</h3>
                    <div className="space-y-3">
                      {content.faqs.map((faq, index) => {
                        const isOpen = openFaqIndex === index;
                        return (
                          <div key={index} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen ? 'bg-blue-50/50 border-blue-100 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                            <button
                              onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                              className="w-full text-left p-5 flex justify-between items-start gap-4 transition-colors"
                            >
                              <div className={`font-medium text-base transition-colors ${isOpen ? 'text-blue-800' : 'text-slate-700'}`}>
                                <ReactMarkdown components={{ p: Fragment }}>{faq.question}</ReactMarkdown>
                              </div>
                              <span className={`flex-shrink-0 p-1.5 rounded-full transition-all duration-300 ${isOpen ? 'rotate-180 bg-blue-200 text-blue-700' : 'bg-white text-slate-400 shadow-sm'}`}>
                                <ChevronDown size={18} />
                              </span>
                            </button>

                            <div
                              className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                }`}
                            >
                              <div className="p-5 pt-0 text-slate-600 leading-relaxed text-sm">
                                <div className="h-px w-full bg-slate-200/60 mb-4"></div>
                                <ReactMarkdown>{faq.answer || ""}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Fallback to Details if no FAQs yet */
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Key Details</h3>
                    <ul className="space-y-4">
                      {content?.details.map((detail, index) => (
                        <li key={index} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full ${classes.dialogHighlight} ${classes.primaryText} flex items-center justify-center text-sm font-bold`}>
                            {index + 1}
                          </span>
                          <div className="text-slate-700 leading-snug">
                            <ReactMarkdown components={{ p: Fragment }}>{detail}</ReactMarkdown>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bot Action Section */}
                <div className={`mt-8 p-6 rounded-2xl ${classes.surfaceVariant} border border-slate-200 text-center`}>
                  <h3 className={`text-lg font-semibold ${classes.primaryText} mb-2`}>
                    Still have questions?
                  </h3>
                  <p className="text-slate-600 mb-4">
                    Our AI assistant can explain {item.title} in more detail based on your personal medical records.
                  </p>
                  <button
                    onClick={() =>
                      onOpenChat(
                        sanitizeQuestion(content?.botStarterPrompt) ||
                        `Tell me more about ${item.title}`
                      )
                    }
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${classes.fabBg} text-white font-medium shadow-lg hover:shadow-xl hover:scale-105 transition-all`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    Chat with Assistant
                  </button>
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