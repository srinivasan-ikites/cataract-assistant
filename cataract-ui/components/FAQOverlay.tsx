import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronRight } from 'lucide-react';
import { api, Patient, ChatMessage } from '../services/api';
import { useTheme } from '../theme';
import ReactMarkdown from 'react-markdown';

interface FAQOverlayProps {
  patient: Patient;
}

const FAQOverlay: React.FC<FAQOverlayProps> = ({ patient }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { classes } = useTheme();

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

  // Get suggestions from the last bot message
  const lastBotMessage = [...chatHistory].reverse().find(m => m.role === 'bot');
  const currentSuggestions = lastBotMessage?.suggestions || [
    "Is surgery painful?",
    "How long does it take?",
    "Insurance coverage?"
  ];

  const handleSend = async (q: string) => {
    if (!q.trim()) return;

    const userMsg = q;
    setQuestion("");
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await api.askAgent(patient.patient_id, userMsg);
      setChatHistory(prev => [...prev, {
        role: 'bot',
        text: response.answer,
        suggestions: response.suggestions,
        media: response.media || []
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
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-[100] ${classes.fabBg} text-white pl-4 pr-6 py-4 rounded-[16px] transition-all duration-300 hover:scale-105 flex items-center gap-3 shadow-lg ${isOpen ? 'hidden' : 'flex'}`}
      >
        <MessageCircle size={24} />
        {/* <span className="font-medium text-base tracking-wide">Ask Assistant</span> */}
      </button>

      {/* Material Sheet Overlay */}
      {isOpen && (
        <div className="fixed bottom-6 right-4 md:right-8 z-[100] w-[95vw] md:w-[500px] h-[790px] md:h-[750px] max-h-[90vh] bg-white shadow-2xl rounded-[24px] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] border border-slate-200 ring-1 ring-black/5">

          {/* Header */}
          <div className={`${classes.chatHeader} p-6 flex justify-between items-center text-white shadow-md`}>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="font-medium text-lg leading-tight">Assistant</h3>
                <p className="text-xs opacity-80">Always here to help</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 scroll-smooth">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-4 rounded-[20px] text-sm leading-relaxed shadow-sm ${msg.role === 'user'
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
                </div>
              </div>
            ))}
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

          {/* Suggestions */}
          {chatHistory.length < 3 && (
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
            <div className="flex gap-2 items-center bg-slate-100 rounded-full px-2 py-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend(question)}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-slate-700 placeholder-slate-400 text-sm outline-none"
              />
              <button
                onClick={() => handleSend(question)}
                disabled={isTyping || !question.trim()}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${classes.fabBg} text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
              >
                {isTyping ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} className="ml-0.5" />}
              </button>
            </div>
          </div>

        </div>
      )}
    </>
  );
};

export default FAQOverlay;