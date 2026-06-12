import React, { useEffect, useMemo, useState } from 'react';
import { Brain, ChevronRight, MessageSquare, Sparkles, Target } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { MainLayout } from '../layouts/MainLayout';
import { NeuralNetwork } from '../components/NeuralNetwork';
import { interviewAPI } from '../services/api';

const interviewTracks = [
  {
    key: 'hr',
    title: 'HR Round',
    description: 'Culture, motivation, leadership, and role fit.',
    gradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.95), rgba(236, 72, 153, 0.88))',
    prompt: 'Tell me about yourself and why this role interests you.',
  },
  {
    key: 'technical',
    title: 'Technical Round',
    description: 'Architecture, coding depth, debugging, and system thinking.',
    gradient: 'linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(59, 130, 246, 0.88))',
    prompt: 'Walk me through a project where you solved a hard technical problem.',
  },
  {
    key: 'behavioral',
    title: 'Behavioral Round',
    description: 'Teamwork, conflict handling, pressure response, and ownership.',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(20, 184, 166, 0.88))',
    prompt: 'Describe a high-pressure situation and how you handled it.',
  },
  {
    key: 'communication',
    title: 'Communication Round',
    description: 'Clarity, structure, presentation, and stakeholder communication.',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(249, 115, 22, 0.88))',
    prompt: 'Explain a complex concept to a non-technical stakeholder.',
  },
];

export default function InterviewTypesPage({ onNavigate, onComplete, currentUser, onLogout }) {
  const { theme } = useTheme();
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState('');
  const [analysisLog, setAnalysisLog] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [interviewerName] = useState(() => {
    const personas = ['Aisha', 'Rahul', 'Sana', 'Arjun', 'Maya'];
    return personas[Math.floor(Math.random() * personas.length)];
  });
  const displayName = React.useMemo(() => currentUser?.username || currentUser?.email || 'You', [currentUser]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [sessionState, setSessionState] = useState('ready');

  const currentTrack = useMemo(
    () => interviewTracks.find((track) => track.key === selectedTrack),
    [selectedTrack]
  );

  useEffect(() => {
    try {
      const warningMessage = localStorage.getItem('aptisense_session_warning');
      if (warningMessage) {
        setError(warningMessage);
        localStorage.removeItem('aptisense_session_warning');
      }
    } catch (e) {
      console.warn('[InterviewTypes] Failed to read session warning:', e);
    }

    const activeSessionRaw = localStorage.getItem('aptisense_active_interview_session');
    if (!activeSessionRaw) {
      return;
    }

    try {
      const activeSession = JSON.parse(activeSessionRaw);
      if (activeSession?.sessionId) {
        interviewAPI.getStatus(activeSession.sessionId).catch((err) => {
          if (err.response?.status === 404) {
            localStorage.removeItem('aptisense_active_interview_session');
            localStorage.removeItem('aptisense_pending_session');
            setError('Previous interview session expired. Start a new interview.');
          }
        });
      }
    } catch (e) {
      localStorage.removeItem('aptisense_active_interview_session');
      localStorage.removeItem('aptisense_pending_session');
    }
  }, []);

  const startInterview = async (track) => {
    if (!currentUser?.user_id) {
      setError('Please sign in with Google to continue.');
      onNavigate?.('login');
      return;
    }

    setSelectedTrack(track.key);
    setIsStarting(true);
    setError(null);
    setAnalysisLog([]);
    setTimeline([]);

    try {
      // Check if there's an active session
      const activeSessionRaw = localStorage.getItem('aptisense_active_interview_session');
      if (activeSessionRaw) {
        try {
          const activeSession = JSON.parse(activeSessionRaw);
          // There's an active session - ask user to end it first
          const confirmEnd = window.confirm(
            `You have an active ${activeSession.interviewData?.interview_type || 'interview'} interview session in progress.\n\nWould you like to end it and start a new one?`
          );

          if (confirmEnd) {
            // Clear the active session
            localStorage.removeItem('aptisense_active_interview_session');
            localStorage.removeItem('aptisense_pending_session');
            // Try to end the backend session if it exists
            if (activeSession.sessionId) {
              await interviewAPI.endInterview(activeSession.sessionId).catch(() => {
                // Ignore errors - session may already be gone
              });
            }
          } else {
            // User canceled - don't start new interview
            setIsStarting(false);
            setSelectedTrack(null);
            return;
          }
        } catch (e) {
          // Parse error - just clear it
          localStorage.removeItem('aptisense_active_interview_session');
          localStorage.removeItem('aptisense_pending_session');
        }
      }

      // Conversational rounds should not have proctoring (camera)
      const enableProctoring = false;

      const response = await interviewAPI.start({
        interview_type: track.key,
        position: track.title,
        experience_level: 'mid',
        enable_proctoring: enableProctoring,
      });

      // Persist pending session so the dedicated Interview page can pick it up
      const pending = {
        session_id: response.data.session_id,
        first_question: response.data.first_question || track.prompt,
        first_question_id: response.data.first_question_id,
        interview_type: track.key,
        position: track.title,
        experience_level: 'mid',
        enable_proctoring: enableProctoring,
      };
      localStorage.setItem('aptisense_pending_session', JSON.stringify(pending));

      // Navigate to the dedicated Interview page
      onNavigate && onNavigate('interview');
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to start the selected interview track.');
      setSelectedTrack(null);
      setSessionState('ready');
    } finally {
      setIsStarting(false);
    }
  };

  const handleAnswerSubmitted = async (payload) => {
    const analysis = payload?.analysis || {};

    setAnalysisLog((prev) => [
      ...prev,
      {
        title: payload?.follow_up ? 'AI follow-up generated' : 'AI answer analyzed',
        message:
          payload.feedback ||
          analysis.overall_impression ||
          analysis.recommendation ||
          analysis.summary ||
          analysis.feedback_points?.[0] ||
          payload?.follow_up ||
          'Gemini reviewed the answer and updated the session memory.',
      },
    ]);

    try {
      const response = await interviewAPI.getNextQuestion(sessionId);

      if (response.data?.should_continue) {
        setCurrentQuestion(response.data.question);
        setCurrentQuestionId(response.data.question_id || currentQuestionId);
      } else {
        await interviewAPI.endInterview(sessionId);
        setSessionState('completed');
        onComplete?.(sessionId);
      }
    } catch {
      // Keep the current question visible if the next-question call is not available.
    }
  };

  const handleFollowUpQuestion = (followUpQuestion) => {
    if (followUpQuestion) {
      setCurrentQuestion(followUpQuestion);
      setAnalysisLog((prev) => [
        ...prev,
        {
          title: 'Adaptive follow-up',
          message: followUpQuestion,
        },
      ]);
    }
  };

  return (
    <MainLayout activeView="interview-types" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          backgroundColor: 'transparent',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <NeuralNetwork />
        </div>

        <div className="pad-mobile" style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: 1320, margin: '0 auto' }}>
          <section
            className="glass-panel"
            style={{
              padding: '2rem',
              borderRadius: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', color: theme.colors.primary, fontWeight: 700, fontSize: theme.fonts.size.sm, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              <Sparkles size={16} />
              Interview types
            </div>
            <h1 style={{ margin: '0.75rem 0 0.5rem', fontSize: 'clamp(1.4rem, 3.2vw, 2rem)', lineHeight: 1.08, fontWeight: 800 }}>
              Choose a track and let the AI adapt the round in real time.
            </h1>
            <p style={{ margin: 0, maxWidth: 820, color: theme.colors.textSecondary, lineHeight: 1.7 }}>
              Each round uses the production interview engine, so follow-up questions, scoring, and memory are generated from the same Gemini-backed orchestration path.
            </p>
          </section>

          <section
            className="stack-mobile"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'grid', gap: '1rem' }}>
              {interviewTracks.map((track) => (
                <button
                  key={track.key}
                  type="button"
                  onClick={() => startInterview(track)}
                  className={selectedTrack === track.key ? "" : "glass-panel glass-panel-hover"}
                  style={{
                    textAlign: 'left',
                    padding: '1.35rem',
                    borderRadius: '1.2rem',
                    border: `1px solid ${selectedTrack === track.key ? theme.colors.primary : 'rgba(255,255,255,0.08)'}`,
                    background: selectedTrack === track.key ? `${theme.colors.primary}12` : 'rgba(15, 12, 38, 0.45)',
                    color: theme.colors.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: theme.fonts.size.xs, color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.7rem' }}>
                        <Target size={14} />
                        {track.key}
                      </div>
                      <h2 style={{ margin: 0, fontSize: theme.fonts.size['2xl'], fontWeight: 800 }}>{track.title}</h2>
                      <p style={{ margin: '0.6rem 0 0', color: theme.colors.textSecondary, lineHeight: 1.65 }}>{track.description}</p>
                    </div>
                    <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: '1rem', background: track.gradient, color: '#fff' }}>
                      <ChevronRight size={18} />
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '1.5rem',
                borderRadius: '1.25rem',
                position: 'sticky',
                top: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.xs, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Current session</div>
                  <div style={{ fontSize: theme.fonts.size.xl, fontWeight: 800 }}>{currentTrack ? currentTrack.title : 'Waiting for selection'}</div>
                </div>
                <Brain size={24} color={theme.colors.primary} />
              </div>

              {error && (
                <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: '0.9rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: theme.colors.danger }}>
                  {error}
                </div>
              )}

              {!sessionId ? (
                <div style={{ display: 'grid', gap: '0.9rem', color: theme.colors.textSecondary, lineHeight: 1.7 }}>
                  <p style={{ margin: 0 }}>Pick a track on the left to start a live interview session. The engine will seed the first question from the track and then continue with adaptive follow-ups.</p>
                  <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <InfoRow label="Tracks" value="HR, technical, behavioral, communication" />
                    <InfoRow label="Scoring" value="Gemini analysis + memory aware feedback" />
                    <InfoRow label="Proctoring" value="Enabled by default" />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ padding: '1rem', borderRadius: '1rem', background: `${theme.colors.bgTertiary}`, border: `1px solid ${theme.colors.borderLight}` }}>
                    <div style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.xs, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Question</div>
                    <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>{currentQuestion}</p>
                  </div>

                  <InterviewChatComponent
                    sessionId={sessionId}
                    currentQuestion={currentQuestion}
                    questionId={currentQuestionId}
                    isLoading={isStarting}
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
                  />

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.xs, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Conversation timeline</div>
                    <div style={{ display: 'grid', gap: '0.75rem', maxHeight: 360, overflowY: 'auto', paddingRight: '0.25rem' }}>
                      {timeline.length === 0 && <p style={{ margin: 0, color: theme.colors.textSecondary }}>The full interview timeline will stay visible here as the session progresses.</p>}
                      {timeline.map((item, index) => (
                        <div key={`${item.type}-${index}`} style={{ padding: '0.9rem 1rem', borderRadius: '0.9rem', background: `${theme.colors.surfacePrimary}`, border: `1px solid ${theme.colors.borderLight}` }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{item.role === 'candidate' ? displayName : interviewerName}</div>
                          <div style={{ color: theme.colors.textSecondary, lineHeight: 1.6 }}>{item.question || item.answer || item.feedback}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.xs, textTransform: 'uppercase', letterSpacing: '0.12em' }}>AI memory log</div>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {analysisLog.length === 0 && <p style={{ margin: 0, color: theme.colors.textSecondary }}>Feedback and follow-up notes will appear here after each answer.</p>}
                      {analysisLog.map((item, index) => (
                        <div key={`${item.title}-${index}`} style={{ padding: '0.9rem 1rem', borderRadius: '0.9rem', background: `${theme.colors.surfacePrimary}`, border: `1px solid ${theme.colors.borderLight}` }}>
                          <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{item.title}</div>
                          <div style={{ color: theme.colors.textSecondary, lineHeight: 1.6 }}>{item.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isStarting && <p style={{ marginTop: '1rem', color: theme.colors.textTertiary }}>Starting interview session...</p>}
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}

function InfoRow({ label, value }) {
  const { theme } = useTheme();

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 1rem', borderRadius: '0.9rem', background: `${theme.colors.surfacePrimary}`, border: `1px solid ${theme.colors.borderLight}` }}>
      <span style={{ color: theme.colors.textTertiary }}>{label}</span>
      <span style={{ color: theme.colors.textPrimary, fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}