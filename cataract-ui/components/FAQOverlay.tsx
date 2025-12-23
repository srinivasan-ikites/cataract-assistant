import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronRight, Info, AlertTriangle, CheckCircle2, List, Hash } from 'lucide-react';
import { api, Patient, ChatMessage } from '../services/api';
import { useTheme } from '../theme';
import ReactMarkdown from 'react-markdown';

// BlockRenderer component for elderly-friendly content display
const BlockRenderer: React.FC<{ blocks: ChatMessage['blocks'] }> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-5">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={idx} className="text-[17px] leading-[1.8] text-slate-700">
                <ReactMarkdown
                  components={{
                    strong: ({ children }) => (
                      <strong className="font-bold text-slate-900">{children}</strong>
                    ),
                  }}
                >
                  {block.content || ''}
                </ReactMarkdown>
              </div>
            );

          case 'heading':
            return (
              <h3 key={idx} className="text-[19px] font-bold text-slate-900 mt-6 mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                {block.content}
              </h3>
            );

          case 'list':
            return (
              <div key={idx} className="space-y-3">
                {block.title && (
                  <p className="font-bold text-[16px] text-slate-900 flex items-center gap-2">
                    <List size={18} className="text-blue-500" />
                    {block.title}
                  </p>
                )}
                <ul className="space-y-3 ml-2">
                  {block.items?.map((item, i) => (
                    <li key={i} className="flex gap-3 text-[16px] leading-[1.7] text-slate-700">
                      <div className="mt-2 w-2 h-2 rounded-full bg-blue-400 shrink-0"></div>
                      <div className="flex-1">
                        <ReactMarkdown
                          components={{
                            strong: ({ children }) => (
                              <strong className="font-bold text-slate-900">{children}</strong>
                            ),
                          }}
                        >
                          {item}
                        </ReactMarkdown>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );

          case 'numbered_steps':
            return (
              <div key={idx} className="space-y-3">
                {block.title && (
                  <p className="font-bold text-[16px] text-slate-900 flex items-center gap-2">
                    <Hash size={18} className="text-blue-500" />
                    {block.title}
                  </p>
                )}
                <ol className="space-y-4">
                  {block.steps?.map((step, i) => (
                    <li key={i} className="flex gap-4 text-[16px] leading-[1.7] text-slate-700">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <ReactMarkdown
                          components={{
                            strong: ({ children }) => (
                              <strong className="font-bold text-slate-900">{children}</strong>
                            ),
                          }}
                        >
                          {step}
                        </ReactMarkdown>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            );

          case 'callout':
            return (
              <div key={idx} className="p-5 rounded-2xl bg-blue-50/70 border-2 border-blue-100 flex gap-4 shadow-sm">
                <Info size={22} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="text-[16px] leading-[1.7] text-blue-900 flex-1">
                  <ReactMarkdown
                    components={{
                      strong: ({ children }) => (
                        <strong className="font-bold text-blue-950">{children}</strong>
                      ),
                    }}
                  >
                    {block.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
            );

          case 'warning':
            return (
              <div key={idx} className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-200 flex gap-4 shadow-sm">
                <AlertTriangle size={22} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-[16px] leading-[1.7] text-amber-900 font-medium flex-1">
                  <ReactMarkdown
                    components={{
                      strong: ({ children }) => (
                        <strong className="font-bold text-amber-950">{children}</strong>
                      ),
                    }}
                  >
                    {block.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
            );

          case 'timeline':
            return (
              <div key={idx} className="space-y-4">
                {block.phases?.map((phase, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-violet-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {i + 1}
                      </div>
                      {i < (block.phases?.length || 0) - 1 && (
                        <div className="w-0.5 h-full bg-violet-200 my-2"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-bold text-[16px] text-slate-900 mb-1">
                        {phase.phase}
                      </p>
                      <p className="text-[16px] leading-[1.7] text-slate-700">
                        <ReactMarkdown
                          components={{
                            strong: ({ children }) => (
                              <strong className="font-bold text-slate-900">{children}</strong>
                            ),
                          }}
                        >
                          {phase.description || ''}
                        </ReactMarkdown>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};

interface FAQOverlayProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  initialQuestion?: string;
  onClearInitialQuestion?: () => void;
}

const FAQOverlay: React.FC<FAQOverlayProps> = ({ patient, isOpen, onClose, onOpen, initialQuestion, onClearInitialQuestion }) => {
  // const [isOpen, setIsOpen] = useState(false); // Lifted to parent
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { classes } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Prefill (do not auto-send) initial question when opening
  useEffect(() => {
    if (isOpen && initialQuestion) {
      setQuestion(initialQuestion);
      if (onClearInitialQuestion) {
        onClearInitialQuestion();
      }
    }
  }, [isOpen, initialQuestion, onClearInitialQuestion]);

  // Load history from patient prop on mount or change
  useEffect(() => {
    if (patient.chat_history && patient.chat_history.length > 0) {
      setChatHistory(patient.chat_history);
    } else {
      // Initial greeting if no history
      setChatHistory([
        { role: 'bot', text: `Hi ${patient.name.first}. I'm here to help answer your questions about cataracts and your upcoming surgery. What would you like to know?` }
      ]);
    }
  }, [patient]);

  // Auto-scroll when chat opens or new messages arrive
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, chatHistory, scrollToBottom]);

  // Auto-resize textarea (ChatGPT-style)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 112; // max-h-28 = 7rem = 112px
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [question]);

  // Generate initial suggestions when there's no chat history
  const getInitialSuggestions = (): string[] => {
    const generalQuestion = "What is cataract surgery?";
    
    // Patient-related question based on available data
    const diagnosis = patient?.clinical_context?.primary_diagnosis?.pathology ||
                     patient?.clinical_context?.primary_diagnosis?.type ||
                     null;
    const lensType = patient?.surgical_selection?.lens_configuration?.lens_type || null;
    
    let patientQuestion = "What should I expect during recovery?";
    if (diagnosis) {
      patientQuestion = `Tell me about ${diagnosis}`;
    } else if (lensType) {
      patientQuestion = `What is ${lensType}?`;
    }
    
    return [generalQuestion, patientQuestion];
  };

  const lastBotMessage = [...chatHistory].reverse().find(m => m.role === 'bot');
  // Only show suggestions if the very last message is from the bot
  const showSuggestions = chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'bot';
  
  // Use initial suggestions if no history (only initial greeting), otherwise use bot's suggestions
  const hasOnlyInitialGreeting = chatHistory.length === 1 && chatHistory[0].role === 'bot' && !chatHistory[0].suggestions;
  const currentSuggestions = hasOnlyInitialGreeting 
    ? getInitialSuggestions() 
    : (showSuggestions ? lastBotMessage?.suggestions || [] : []);

  const handleSend = async (q: string) => {
    if (!q.trim()) return;

    const userMsg = q;
    setQuestion("");
    // Clear suggestions immediately to avoid stale UI
    const updatedHistory = [...chatHistory, { role: 'user' as const, text: userMsg }];
    setChatHistory(updatedHistory);
    setIsTyping(true);

    try {
      const response = await api.askAgent(patient.patient_id, userMsg);
      setChatHistory(prev => [...prev, {
        role: 'bot',
        text: response.answer,
        blocks: response.blocks || [],
        suggestions: response.suggestions,
        media: response.media || [],
        sources: response.sources || []
      }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "I'm sorry, I'm having trouble connecting to the clinic server right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <style>{`
        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Extended FAB Button */}
      <button
        onClick={onOpen}
        className={`fixed bottom-6 right-6 z-[100] ${classes.fabBg} text-white pl-4 pr-6 py-4 rounded-[16px] transition-all duration-300 hover:scale-105 flex items-center gap-3 shadow-lg ${isOpen ? 'hidden' : 'flex'}`}
      >
        <MessageCircle size={24} />
        {/* <span className="font-medium text-base tracking-wide">Ask Assistant</span> */}
      </button>

      {/* Material Sheet Overlay */}
      {isOpen && (
        <>
          {/* Backdrop blur */}
          <div className="fixed inset-0 z-[95] bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
          <div className="fixed inset-0 md:top-auto md:bottom-4 md:right-8 md:left-auto z-[100] w-full md:w-[640px] h-full md:h-[92vh] max-h-full md:max-h-[92vh] bg-white shadow-2xl rounded-none md:rounded-[24px] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] border border-slate-200 ring-1 ring-black/5">

          {/* Header */}
          <div className={`${classes.chatHeader} px-4 py-3 flex justify-between items-center text-white shadow-md`}>
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 p-1.5 rounded-full">
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-base leading-tight">Assistant</h3>
                <p className="text-[11px] opacity-80">Always here to help</p>
              </div>
            </div>
            <button onClick={() => onClose()} className="hover:bg-white/20 p-2 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                <div
                    className={`max-w-[92%] p-4 rounded-[20px] text-sm leading-relaxed shadow-sm ${classes.userBubble} rounded-br-sm`}
                >
                  <div className="text-sm">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="text-sm m-0">{children}</p>,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                  </div>
                ) : (
                  <div className="max-w-[100%] w-full bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="p-5 space-y-4">
                      {msg.blocks && msg.blocks.length > 0 ? (
                        <BlockRenderer blocks={msg.blocks} />
                      ) : (
                        <div className="text-[17px] leading-[1.8] text-slate-700">
                          <ReactMarkdown
                            components={{
                              strong: ({ children }) => (
                                <strong className="font-bold text-slate-900">{children}</strong>
                              ),
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      )}

                      {msg.media && msg.media.length > 0 && (
                        <div className="space-y-2">
                      {msg.media.map((item, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-slate-200">
                          {item.type === 'image' && (
                            <img 
                              src={item.url} 
                              alt={item.alt || 'Educational image'} 
                              className="w-full h-auto"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          {item.type === 'video' && (
                            <iframe 
                              src={item.url} 
                              title={item.caption || item.alt || 'Educational video'}
                              className="w-full h-64"
                              allowFullScreen
                            />
                          )}
                          {item.caption && (
                            <p className="text-xs text-slate-600 p-2 bg-slate-50">{item.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-1">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-2">Sources</div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources
                          .filter(src => (src.section_title && src.section_title !== 'Unknown section') || src.source_url)
                          .map((src, i) => {
                          const title = src.section_title || 'Source';
                          const firstLink = src.links && src.links.length ? src.links[0].url : null;
                          const href = src.source_url || firstLink;
                          return (
                            <span
                              key={i}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[12px] text-slate-700 shadow-sm"
                            >
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {title}
                                </a>
                              ) : (
                                <span>{title}</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 p-4 rounded-[20px] rounded-bl-sm shadow-sm flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions - always visible to keep the flow going */}
          {currentSuggestions && currentSuggestions.length > 0 && (
            <div className="px-4 py-3 bg-slate-50">
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {currentSuggestions.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(sq)}
                    className={`whitespace-nowrap text-xs font-medium px-4 py-2 rounded-full transition-colors flex items-center gap-1 shadow-sm shrink-0 ${classes.suggestionChip}`}
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="flex gap-2 items-end bg-slate-100 rounded-2xl px-3 py-2">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(question);
                  }
                }}
                placeholder="Ask a question..."
                rows={1}
                className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-slate-700 placeholder-slate-400 text-sm outline-none resize-none leading-relaxed overflow-hidden"
              />
              <button
                onClick={() => handleSend(question)}
                disabled={isTyping || !question.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${classes.fabBg} text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0`}
              >
                {isTyping ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </>
  );
};

export default FAQOverlay;