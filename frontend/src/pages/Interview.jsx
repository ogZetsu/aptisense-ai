import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { interviewAPI } from '../services/api';
import { MainLayout } from '../layouts/MainLayout';
import InterviewChatComponent from '../components/InterviewChatComponent';
import { ProctoringPanel } from '../components/ProctoringPanel';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function InterviewPage({ onNavigate, onSessionCreated, onComplete, currentUser, onLogout }) {
  const { theme } = useTheme();
  const [sessionId, setSessionId] = useState(null);
  const [interviewerName, setInterviewerName] = useState(null);
  const displayName = React.useMemo(() => currentUser?.username || currentUser?.email || 'You', [currentUser]);
  const [sessionState, setSessionState] = useState('setup'); // setup, starting, in_progress, ended
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [interviewData, setInterviewData] = useState({
    position: 'Software Engineer',
    experience_level: 'mid',
    interview_type: 'technical',
    enableProctoring: false,
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearStoredSession = useCallback(() => {
    try {
      localStorage.removeItem('aptisense_active_interview_session');
      localStorage.removeItem('aptisense_pending_session');
    } catch (e) {
      console.warn('[Interview] Failed to clear stored session:', e);
    }
    setSessionId(null);
    setCurrentQuestion(null);
    setCurrentQuestionId(null);
    setAnswers([]);
    setTimeline([]);
    setFollowUpCount(0);
    setInterviewerName(null);
    setSessionState('setup');
  }, []);

  const handleInvalidSession = useCallback((message = 'Previous session expired. Start a new interview.') => {
    try {
      localStorage.setItem('aptisense_session_warning', message);
    } catch (e) {
      console.warn('[Interview] Failed to persist session warning:', e);
    }
    setError(message);
    clearStoredSession();
    onNavigate?.('interview-types');
  }, [clearStoredSession, onNavigate]);

  // If a pending session was created from InterviewTypes, pick it up and start
  useEffect(() => {
    try {
      const raw = localStorage.getItem('aptisense_pending_session');
      if (raw) {
        const pending = JSON.parse(raw);
        if (pending && pending.session_id) {
          setSessionId(pending.session_id);
          setCurrentQuestion(pending.first_question || null);
          setCurrentQuestionId(pending.first_question_id || null);
          setInterviewData({
            position: pending.position || 'Software Engineer',
            experience_level: pending.experience_level || 'mid',
            interview_type: pending.interview_type || 'technical',
            enableProctoring: pending.enable_proctoring || false,
          });
          setSessionState('in_progress');
          setTimeline([{ role: 'interviewer', type: 'question', question: pending.first_question }]);
          // pick a friendly interviewer persona for this session
          const personas = ['Aisha', 'Rahul', 'Sana', 'Arjun', 'Maya'];
          setInterviewerName(personas[Math.floor(Math.random() * personas.length)]);
          // remove pending marker
          localStorage.removeItem('aptisense_pending_session');
        }
      } else {
        // Try to restore from active session
        const activeRaw = localStorage.getItem('aptisense_active_interview_session');
        if (activeRaw) {
          const active = JSON.parse(activeRaw);
          console.log('[ORCHESTRATION FRONTEND] Restoring active interview session from localStorage:', active);
          setSessionId(active.sessionId);
          setCurrentQuestion(active.currentQuestion);
          setCurrentQuestionId(active.currentQuestionId);
          setInterviewData(active.interviewData);
          setElapsedTime(active.elapsedTime || 0);
          setAnswers(active.answers || []);
          setTimeline(active.timeline || []);
          setFollowUpCount(active.followUpCount || 0);
          setInterviewerName(active.interviewerName);
          setSessionState(active.sessionState || 'in_progress');
        }
      }
    } catch (e) {
      // ignore parse errors
      console.warn('[Interview] Parse error loading session:', e);
    }
  }, []);

  // Validate restored session on mount and whenever a session is loaded
  useEffect(() => {
    if (!sessionId || sessionState !== 'in_progress') {
      return;
    }

    interviewAPI.getStatus(sessionId).catch((err) => {
      if (err.response?.status === 404) {
        handleInvalidSession('Previous session expired. Start a new interview.');
      }
    });
  }, [sessionId, sessionState, handleInvalidSession]);

  // Timer effect
  useEffect(() => {
    if (sessionState !== 'in_progress') return;

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState]);

  // Save session state to localStorage for persistence
  useEffect(() => {
    if (sessionState === 'in_progress' && sessionId) {
      const sessionSnapshot = {
        sessionId,
        currentQuestion,
        currentQuestionId,
        interviewData,
        elapsedTime,
        answers,
        timeline,
        followUpCount,
        interviewerName,
        sessionState,
      };
      localStorage.setItem('aptisense_active_interview_session', JSON.stringify(sessionSnapshot));
    } else if (sessionState === 'ended') {
      // Clear the session when interview is explicitly ended
      localStorage.removeItem('aptisense_active_interview_session');
    }
  }, [sessionState, sessionId, currentQuestion, currentQuestionId, interviewData, elapsedTime, answers, timeline, followUpCount, interviewerName]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startInterview = useCallback(async () => {
    if (!currentUser?.user_id) {
      setError('Please sign in with Google to continue.');
      onNavigate?.('login');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await interviewAPI.start({
        interview_type: interviewData.interview_type,
        position: interviewData.position,
        experience_level: interviewData.experience_level,
        enable_proctoring: interviewData.enableProctoring,
      });

      const session = response.data;
      setSessionId(session.session_id);
      onSessionCreated?.(session.session_id);
      setCurrentQuestion(session.first_question);
      setCurrentQuestionId(session.first_question_id);
      setSessionState('in_progress');
      setTimeline([{ role: 'interviewer', type: 'question', question: session.first_question }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error starting interview');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, interviewData, onNavigate]);

  const endInterview = useCallback(async (redirectToInterviewTypes = false) => {
    try {
      if (sessionId) {
        await interviewAPI.endInterview(sessionId);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.warn('[Interview] End session API failed:', err);
      }
    }

    clearStoredSession();
    if (redirectToInterviewTypes) {
      onNavigate?.('interview-types');
    } else {
      onComplete?.(sessionId);
    }
  }, [clearStoredSession, onComplete, onNavigate, sessionId]);

  const handleAnswerSubmitted = useCallback(async (analysisResult) => {
    setAnswers(prev => [...prev, analysisResult]);

    // Get next question
    try {
      const response = await interviewAPI.getNextQuestion(sessionId);
      if (response.data.should_continue) {
        setCurrentQuestion(response.data.question);
        setCurrentQuestionId(response.data.question_id);
        setFollowUpCount(0);
      } else {
        // Interview should end
        endInterview(false);
      }
    } catch (err) {
      // Check if session is invalid (404)
      if (err.response?.status === 404) {
        handleInvalidSession('Session expired or invalid. Returning to interview types...');
      } else {
        setError('Error loading next question. Please try again.');
      }
    }
  }, [sessionId, endInterview, handleInvalidSession]);

  const handleFollowUpQuestion = useCallback((followUp) => {
    setCurrentQuestion(followUp);
    setFollowUpCount(prev => prev + 1);
  }, []);

  // Setup screen
  if (sessionState === 'setup') {
    return (
      <MainLayout currentUser={currentUser} onLogout={onLogout}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'transparent',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '500px',
              borderRadius: '1rem',
              padding: '3rem 2rem',
              textAlign: 'center',
            }}
          >
            <h1 style={{ fontSize: theme.fonts.size['3xl'], fontWeight: '900', marginBottom: '1rem' }}>
              Start Interview
            </h1>
            <p style={{ color: theme.colors.textTertiary, marginBottom: '2rem' }}>
              Configure your interview preferences
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', color: theme.colors.textSecondary, marginBottom: '0.5rem', fontWeight: '600' }}>
                  Position
                </label>
                <input
                  type="text"
                  value={interviewData.position}
                  onChange={(e) => setInterviewData(prev => ({ ...prev, position: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: theme.colors.bgTertiary,
                    border: `1px solid ${theme.colors.borderLight}`,
                    borderRadius: '0.5rem',
                    color: theme.colors.textPrimary,
                    fontSize: theme.fonts.size.base,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: theme.colors.textSecondary, marginBottom: '0.5rem', fontWeight: '600' }}>
                  Interview Type
                </label>
                <select
                  value={interviewData.interview_type}
                  onChange={(e) => setInterviewData(prev => ({ ...prev, interview_type: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: theme.colors.bgTertiary,
                    border: `1px solid ${theme.colors.borderLight}`,
                    borderRadius: '0.5rem',
                    color: theme.colors.textPrimary,
                    fontSize: theme.fonts.size.base,
                  }}
                >
                  <option value="hr">HR Round</option>
                  <option value="technical">Technical Round</option>
                  <option value="behavioral">Behavioral Round</option>
                  <option value="communication">Communication Round</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            {error && (
              <div style={{ color: theme.colors.danger, marginBottom: '1rem', fontSize: theme.fonts.size.sm }}>
                {error}
              </div>
            )}

            <button
              onClick={startInterview}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: theme.colors.primary,
                color: theme.colors.bgPrimary,
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: theme.fonts.size.base,
                fontWeight: '700',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Starting...' : 'Start Interview'}
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Main interview screen
  if (sessionState === 'in_progress' && sessionId) {
    return (
      <MainLayout showSidebar={false} currentUser={currentUser} onLogout={onLogout}>
        <div
          className="stack-mobile pad-mobile"
          style={{
            display: 'grid',
            gridTemplateColumns: interviewData.enableProctoring ? '1fr 350px' : '1fr',
            gap: '2rem',
            minHeight: '100vh',
            padding: '2rem',
            backgroundColor: 'transparent',
          }}
        >
          {/* Main interview area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header with navigation */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1rem',
                borderBottom: `1px solid ${theme.colors.borderLight}`,
              }}
            >
              <div>
                <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: '700', marginBottom: '0.25rem' }}>
                  {interviewData.position}
                </h2>
                <p style={{ color: theme.colors.textTertiary }}>
                  Question {answers.length + 1}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                  }}
                >
                  <Clock size={18} style={{ color: theme.colors.primary }} />
                  <span style={{ fontSize: theme.fonts.size.lg, fontWeight: '700' }}>{formatTime(elapsedTime)}</span>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => onNavigate && onNavigate('interview-types')}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: theme.colors.bgTertiary,
                  color: theme.colors.textPrimary,
                  border: `1px solid ${theme.colors.borderLight}`,
                  borderRadius: '0.5rem',
                  fontSize: theme.fonts.size.base,
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = theme.colors.surfacePrimary;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = theme.colors.bgTertiary;
                }}
              >
                ← Return to Interview Types
              </button>
              <button
                onClick={() => endInterview(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: theme.colors.danger,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: theme.fonts.size.base,
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1';
                }}
              >
                End Interview Session
              </button>
            </div>

            {/* Interview Chat */}
            <InterviewChatComponent
              sessionId={sessionId}
              currentQuestion={currentQuestion}
              questionId={currentQuestionId}
              onAnswerSubmitted={handleAnswerSubmitted}
              onFollowUpQuestion={handleFollowUpQuestion}
              onConversationUpdate={(turn) => {
                setTimeline((prev) => [
                  ...prev,
                  {
                    role: 'interviewer',
                    type: 'question',
                    question: turn.question,
                  },
                  {
                    role: 'candidate',
                    type: 'answer',
                    answer: turn.answer,
                  },
                  {
                    role: 'interviewer',
                    type: 'feedback',
                    feedback: turn.feedback,
                  },
                  ...(turn.followUpQuestion ? [{
                    role: 'interviewer',
                    type: 'follow_up',
                    question: turn.followUpQuestion,
                  }] : []),
                ]);
              }}
              onSessionInvalid={() => handleInvalidSession('Session expired or invalid. Returning to interview types...')}
              isLoading={isLoading}
            />

            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.xs, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Conversation timeline</div>
              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: 320, overflowY: 'auto' }}>
                {timeline.map((item, index) => (
                  <div key={`${item.type}-${index}`} style={{ padding: '0.9rem 1rem', borderRadius: '0.9rem', background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}` }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{item.role === 'candidate' ? displayName : (interviewerName || 'AI Interviewer')}</div>
                    <div style={{ color: theme.colors.textSecondary, lineHeight: 1.6 }}>{item.question || item.answer || item.feedback}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1, height: '4px', backgroundColor: theme.colors.bgTertiary, borderRadius: '2px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${((answers.length) / 5) * 100}%`,
                    backgroundColor: theme.colors.primary,
                    transition: 'width 300ms',
                  }}
                />
              </div>
              <span style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm }}>
                {answers.length} / 5 answered
              </span>
            </div>
          </div>

          {/* Proctoring Panel */}
          {interviewData.enableProctoring && (
            <div style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
              <ProctoringPanel sessionId={sessionId} isActive={true} />
            </div>
          )}
        </div>
      </MainLayout>
    );
  }

  // Ended screen
  if (sessionState === 'ended') {
    return (
      <MainLayout currentUser={currentUser} onLogout={onLogout}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'transparent',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            <CheckCircle size={64} style={{ color: theme.colors.success, marginBottom: '1rem', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: '700', marginBottom: '1rem' }}>
              Interview Completed
            </h2>
            <p style={{ color: theme.colors.textTertiary, marginBottom: '2rem' }}>
              Your interview has been completed successfully. Your results are being analyzed by our AI system.
            </p>
            <button
              type="button"
              onClick={() => onComplete?.(sessionId)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem 1.5rem',
                backgroundColor: theme.colors.primary,
                color: theme.colors.bgPrimary,
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              View Results
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return null;
}
