import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { chatbotAPI } from '../services/api';
import { 
  MessageSquareText, 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  Trash2 
} from 'lucide-react';

export default function ChatbotWidget() {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('aptisense.chat_messages');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved chat messages:', e);
    }
    return [
      {
        role: 'assistant',
        content: "Hi there! 👋 I'm your AptiSense AI Assistant. Ask me anything about taking mock interviews, practicing aptitude tests, or how our cognitive proctoring works!"
      }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const customStyles = `
    .chatbot-wrapper {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 1000;
    }
    .chatbot-panel {
      width: 380px;
      height: 520px;
      border-radius: 1.5rem;
      background-color: ${theme.colors.surfacePrimary};
      border: 1px solid ${theme.colors.borderLight};
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    @media (max-width: 640px) {
      .chatbot-wrapper {
        bottom: 1rem;
        right: 1rem;
      }
      .chatbot-panel {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        border-radius: 0 !important;
        border: none !important;
      }
    }
  `;

  useEffect(() => {
    try {
      localStorage.setItem('aptisense.chat_messages', JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to persist chat messages:', e);
    }
    scrollToBottom();
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    if (!textToSend) {
      setInputValue('');
    }

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      // Send message log (excluding greetings/system helper flags if custom)
      const payload = newMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

      const response = await chatbotAPI.sendMessage(payload);
      const botResponse = response.data?.message || "I couldn't process that response. Please try again.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: botResponse }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errMsg = error.response?.data?.detail || "Sorry, I am having trouble connecting to the AI service right now. Please verify backend OpenRouter configuration.";
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      const initialMsg = [
        {
          role: 'assistant',
          content: "Hi there! 👋 I'm your AptiSense AI Assistant. Ask me anything about taking mock interviews, practicing aptitude tests, or how our cognitive proctoring works!"
        }
      ];
      setMessages(initialMsg);
      try {
        localStorage.removeItem('aptisense.chat_messages');
      } catch (e) {}
    }
  };

  const suggestions = [
    "What is AptiSense AI?",
    "How to start a Mock Interview?",
    "How does the proctoring work?",
    "Tell me about Aptitude Tests"
  ];

  return (
    <div className="chatbot-wrapper" style={{ fontFamily: theme.fonts?.family?.sans || 'sans-serif' }}>
      <style>{customStyles}</style>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: theme.colors.primary,
            color: theme.colors.bgPrimary,
            border: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 32px rgba(34, 211, 238, 0.4)',
            transition: 'all 200ms ease-in-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(34, 211, 238, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(34, 211, 238, 0.4)';
          }}
        >
          <MessageSquareText size={28} />
        </button>
      )}

      {/* Floating Chat Container */}
      {isOpen && (
        <div className="glass-panel animate-fade-in chatbot-panel">
          {/* Header */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: `1px solid ${theme.colors.borderLight}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: `linear-gradient(to right, ${theme.colors.surfaceSecondary}50, transparent)`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px #10b981'
                }}
              />
              <span style={{ fontWeight: '800', fontSize: '0.95rem', color: theme.colors.textPrimary }}>
                AptiSense AI Assistant
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {messages.length > 1 && (
                <button
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.colors.textTertiary,
                    cursor: 'pointer',
                    padding: '0.35rem',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.borderLight}50`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '0.35rem',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.borderLight}50`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Log */}
          <div
            style={{
              flex: 1,
              padding: '1.25rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {messages.map((msg, idx) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    padding: '0.75rem 1rem',
                    borderRadius: isAssistant ? '1.25rem 1.25rem 1.25rem 0.25rem' : '1.25rem 1.25rem 0.25rem 1.25rem',
                    backgroundColor: isAssistant ? `${theme.colors.surfaceSecondary}80` : theme.colors.primary,
                    color: isAssistant ? theme.colors.textPrimary : theme.colors.bgPrimary,
                    border: isAssistant ? `1px solid ${theme.colors.borderLight}` : 'none',
                    fontSize: '0.88rem',
                    lineHeight: '1.45',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {isAssistant && msg.content.includes("👋") && idx === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: theme.colors.primary, fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                      <Sparkles size={12} />
                      AI Companion
                    </div>
                  )}
                  {msg.content}
                </div>
              );
            })}
            
            {/* Typing Loader */}
            {isTyping && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.75rem 1rem',
                  borderRadius: '1.25rem 1.25rem 1.25rem 0.25rem',
                  backgroundColor: `${theme.colors.surfaceSecondary}80`,
                  border: `1px solid ${theme.colors.borderLight}`,
                  color: theme.colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.88rem'
                }}
              >
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>AI is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          {messages.length === 1 && !isTyping && (
            <div
              style={{
                padding: '0.5rem 1rem 0.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                borderTop: `1px solid ${theme.colors.borderLight}20`,
              }}
            >
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(sug)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '999px',
                    border: `1px solid ${theme.colors.borderLight}`,
                    backgroundColor: theme.colors.surfaceSecondary,
                    color: theme.colors.textSecondary,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 200ms ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.borderLight;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '1rem',
              borderTop: `1px solid ${theme.colors.borderLight}`,
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              backgroundColor: `${theme.colors.surfaceSecondary}30`
            }}
          >
            <input
              type="text"
              placeholder="Ask anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isTyping}
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                borderRadius: '999px',
                border: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.surfacePrimary,
                color: theme.colors.textPrimary,
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: inputValue.trim() && !isTyping ? theme.colors.primary : `${theme.colors.surfaceSecondary}90`,
                color: inputValue.trim() && !isTyping ? theme.colors.bgPrimary : theme.colors.textTertiary,
                border: 'none',
                cursor: inputValue.trim() && !isTyping ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                transition: 'all 200ms ease-in-out'
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
