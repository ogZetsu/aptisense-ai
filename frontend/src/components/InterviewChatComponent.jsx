import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { interviewAPI } from '../services/api';

export default function InterviewChatComponent({
  sessionId,
  currentQuestion,
  questionId,
  onAnswerSubmitted,
  onFollowUpQuestion,
  onConversationUpdate,
  onSessionInvalid,
  isLoading,
}) {
  const { theme } = useTheme();

  const [answer, setAnswer] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  const textareaRef = useRef(null);
  const startTimeRef = useRef(null);
  const backspaceCountRef = useRef(0);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
      try { window.speechSynthesis?.cancel?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, []);

  const handleInputChange = (e) => {
    const text = e.target.value;
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    if (answer.length > text.length) backspaceCountRef.current++;
    setAnswer(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Use English India for better accuracy
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      
      // Process all results up to the current index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Final result - accumulate to answer
          finalText += (finalText ? ' ' : '') + transcript;
        } else {
          // Interim result - show as preview
          interim += transcript;
        }
      }
      
      // Update answer with finalized text
      if (finalText) {
        setAnswer(prevAnswer => (prevAnswer + ' ' + finalText).trim());
      }
      
      // Show interim text as preview
      setInterimTranscript(interim);
    };

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript('');
    };
    recognition.onerror = (e) => {
      console.warn('Recognition error', e.error);
      if (e.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {};
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimTranscript('');
  };

  const calculateTypingMetrics = () => {
    if (!startTimeRef.current || !answer.trim()) return {};
    const totalTime = (Date.now() - startTimeRef.current) / 1000;
    const words = Math.max(1, answer.trim().split(/\s+/).length);
    const wpm = (words / totalTime) * 60;
    return {
      typing_speed: Math.round(wpm),
      backspaces: backspaceCountRef.current,
      total_time: Math.round(totalTime),
      hesitation_time: 0,
    };
  };

  const speakText = (text, onEnd) => {
    if (!text || !('speechSynthesis' in window)) return onEnd && onEnd();
    try {
      setAiSpeaking(true);
      const ut = new SpeechSynthesisUtterance(text);
      ut.rate = 1.0;
      ut.onend = () => {
        setAiSpeaking(false);
        onEnd && onEnd();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(ut);
    } catch (e) {
      setAiSpeaking(false);
      onEnd && onEnd();
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setError('Please provide an answer');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const metrics = calculateTypingMetrics();
      const audioDuration = metrics.total_time || null;

      const response = await interviewAPI.submitAnswer({
        session_id: sessionId,
        question_id: questionId,
        answer_text: answer,
        typing_metrics: metrics,
        audio_duration_seconds: audioDuration,
      });
      console.log('[ORCHESTRATION FRONTEND] submitAnswer response.data:', response.data);
      console.log('[ORCHESTRATION FRONTEND] rendered feedback field:', response.data.feedback);
      
      // Fire callbacks
      if (onAnswerSubmitted) onAnswerSubmitted(response.data);
      if (response.data.follow_up && onFollowUpQuestion) onFollowUpQuestion(response.data.follow_up);

      // Read brief AI summary and follow-up aloud
      const summary = response.data.feedback || '';
      const followUp = response.data.follow_up;

      if (onConversationUpdate) {
        onConversationUpdate({
          questionId,
          question: currentQuestion,
          answer,
          feedback: summary,
          followUpQuestion: followUp || null,
          analysis: response.data.analysis,
        });
      }

      if (summary) speakText(summary, () => {
        if (followUp) setTimeout(() => speakText(followUp), 600);
      });

      // Reset input
      setAnswer('');
      setInterimTranscript('');
      startTimeRef.current = null;
      backspaceCountRef.current = 0;
    } catch (err) {
      // Check if session is invalid
      if (err.response?.status === 404) {
        setError('Session expired or invalid. Please return to interview types and start a new session.');
        onSessionInvalid?.();
      } else if (err.code === 'ECONNABORTED') {
        setError('The AI response timed out. Please submit again.');
      } else {
        setError(err.response?.data?.detail || 'Error submitting answer. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: theme.colors.surfaceSecondary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '0.75rem', padding: '2rem' }}>

      {/* AI Avatar + Question */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: aiSpeaking ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : 'linear-gradient(135deg,#0ea5e9,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, boxShadow: aiSpeaking ? '0 6px 24px rgba(124,58,237,0.35)' : '0 4px 12px rgba(15,23,42,0.06)', transition: 'all 200ms' }}>{aiSpeaking ? '🤖' : 'AI'}</div>
        <div style={{ flex: 1 }}>
          <p style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm, marginBottom: '0.5rem' }}>Question</p>
          <p style={{ fontSize: theme.fonts.size.lg, fontWeight: 500, color: theme.colors.textPrimary, lineHeight: '1.6' }}>{currentQuestion}</p>
        </div>
      </div>

      {/* Answer input + mic control */}
      <div>
        <label style={{ display: 'block', color: theme.colors.textTertiary, marginBottom: '0.5rem', fontSize: theme.fonts.size.sm }}>Your Answer</label>
        <div style={{ position: 'relative' }}>
          <textarea ref={textareaRef} value={answer} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Type your answer here. (Ctrl+Enter to submit)" style={{ width: '100%', minHeight: 150, maxHeight: 250, padding: '1rem', backgroundColor: theme.colors.bgTertiary, color: theme.colors.textPrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '0.5rem', fontFamily: theme.fonts.family.sans, fontSize: theme.fonts.size.base, outline: 'none', resize: 'vertical', transition: `border-color ${theme.transitions.fast}` }} onFocus={(e) => e.target.style.borderColor = theme.colors.primary} onBlur={(e) => e.target.style.borderColor = theme.colors.borderLight} disabled={isLoading || isSubmitting} />

          <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => (isRecording ? stopRecording() : startRecording())} type="button" title={isRecording ? 'Stop recording' : 'Start recording'} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRecording ? '#ef4444' : theme.colors.primary, color: '#fff', boxShadow: isRecording ? '0 6px 18px rgba(239,68,68,0.25)' : theme.shadows.button, cursor: 'pointer' }}>{isRecording ? '●' : '🎤'}</button>
            {isRecording && <div style={{ width: 10, height: 10, borderRadius: 6, background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)', animation: 'pulse 1s infinite' }} />}
          </div>
        </div>
        {interimTranscript && <div style={{ marginTop: '0.5rem', color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm }}><em>Listening:</em> {interimTranscript}</div>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: `1px solid ${theme.colors.danger}`, borderRadius: '0.5rem', color: theme.colors.danger, fontSize: theme.fonts.size.sm }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={isSubmitting || isLoading || !answer.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0.75rem 1.5rem', backgroundColor: theme.colors.primary, color: theme.colors.bgPrimary, border: 'none', borderRadius: '0.5rem', fontSize: theme.fonts.size.base, fontWeight: 600, cursor: isSubmitting || isLoading ? 'not-allowed' : 'pointer', opacity: isSubmitting || isLoading ? 0.7 : 1, transition: `all ${theme.transitions.fast}`, width: '100%' }} onMouseEnter={(e) => { if (!isSubmitting && !isLoading) { e.target.style.backgroundColor = theme.colors.primaryDark; e.target.style.boxShadow = theme.shadows.glow; } }} onMouseLeave={(e) => { e.target.style.backgroundColor = theme.colors.primary; e.target.style.boxShadow = 'none'; }}>
        {isSubmitting || isLoading ? (<><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</>) : (<><Send size={18} /> Submit Answer</>)}
      </button>

      <p style={{ fontSize: theme.fonts.size.xs, color: theme.colors.textTertiary, textAlign: 'center' }}>Be specific and thorough. Your answers are analyzed in real-time.</p>
    </div>
  );
}
