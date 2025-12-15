import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronRight } from 'lucide-react';
import { api, Patient, ChatMessage } from '../services/api';
import { useTheme } from '../theme';
import ReactMarkdown from 'react-markdown';

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

  const lastBotMessage = [...chatHistory].reverse().find(m => m.role === 'bot');
  // Only show suggestions if the very last message is from the bot
  const showSuggestions = chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'bot';
  const currentSuggestions = showSuggestions ? lastBotMessage?.suggestions : [];

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
          <div className="fixed inset-0 md:top-auto md:bottom-4 md:right-8 md:left-auto z-[100] w-full md:w-[520px] h-full md:h-[92vh] max-h-full md:max-h-[92vh] bg-white shadow-2xl rounded-none md:rounded-[24px] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] border border-slate-200 ring-1 ring-black/5">

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
                <div
                  className={`max-w-[92%] p-4 rounded-[20px] text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                    ? `${classes.userBubble} rounded-br-sm`
                    : `${classes.botBubble} rounded-bl-sm`
                    }`}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                  
                  {/* Display media if present (bot messages only) */}
                  {msg.role === 'bot' && msg.media && msg.media.length > 0 && (
                    <div className="mt-3 space-y-2">
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

                  {msg.role === 'bot' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                      <div className="font-semibold text-slate-700 mb-1">Sources</div>
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
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 border border-slate-200"
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
            <div className="px-4 py-2 bg-slate-50">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {currentSuggestions.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(sq)}
                    className={`whitespace-nowrap text-xs font-medium px-4 py-2 rounded-full transition-colors flex items-center gap-1 shadow-sm ${classes.suggestionChip}`}
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
                className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-slate-700 placeholder-slate-400 text-sm outline-none resize-none leading-relaxed max-h-28 overflow-y-auto"
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