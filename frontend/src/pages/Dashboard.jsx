import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { MainLayout } from '../layouts/MainLayout';
import { 
  interviewAPI, 
  getAnalyticsSummary, 
  getAnalyticsSessions, 
  getAptitudeAttempt,
  aptitudeAPI 
} from '../services/api';
import { 
  Sparkles, 
  Brain, 
  Shield, 
  FileText, 
  BarChart3, 
  Target, 
  Award, 
  Eye, 
  AlertCircle, 
  HelpCircle,
  BookOpen,
  Clock,
  TrendingUp,
  Activity,
  Loader2,
  Lock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const RecruiterBadge = ({ status }) => {
  let bg = 'rgba(255, 255, 255, 0.05)';
  let border = 'rgba(255, 255, 255, 0.1)';
  let color = '#94a3b8';
  let text = 'No Sessions Yet';
  
  if (status === 'RECOMMENDED') {
    bg = 'rgba(16, 185, 129, 0.15)';
    border = 'rgba(16, 185, 129, 0.35)';
    color = '#34d399';
    text = 'Highly Recommended';
  } else if (status === 'CONDITIONAL') {
    bg = 'rgba(6, 182, 212, 0.15)';
    border = 'rgba(6, 182, 212, 0.35)';
    color = '#22d3ee';
    text = 'Conditional Pass';
  } else if (status === 'REQUIRES_REVIEW') {
    bg = 'rgba(245, 158, 11, 0.15)';
    border = 'rgba(245, 158, 11, 0.35)';
    color = '#fbbf24';
    text = 'Training Recommended';
  } else if (status === 'NOT_RECOMMENDED') {
    bg = 'rgba(239, 68, 68, 0.15)';
    border = 'rgba(239, 68, 68, 0.35)';
    color = '#f87171';
    text = 'Not Recommended';
  }

  return (
    <span style={{ display: 'inline-flex', padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: bg, border: `1px solid ${border}`, color: color }}>
      {text}
    </span>
  );
};

export default function DashboardPage({ onNavigate, sessionId, currentUser, onLogout }) {
  const { theme } = useTheme();

  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(sessionId || null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState("interviews");
  const [aptitudeSummary, setAptitudeSummary] = useState(null);
  const [loadingAptitude, setLoadingAptitude] = useState(false);

  useEffect(() => {
    setSelectedSessionId(sessionId || null);
  }, [sessionId]);

  // Load session listing when currentUser becomes available
  useEffect(() => {
    let mounted = true;
    if (!currentUser?.user_id) {
      setSessions([]);
      setSelectedSessionId(null);
      setSessionsLoaded(true);
      return () => { mounted = false; };
    }

    setSessionsLoaded(false);
    (async () => {
      try {
        const data = await getAnalyticsSessions(currentUser.user_id);
        if (mounted) {
          setSessions(data || []);
        }
      } catch (err) {
        console.error("Failed to load completed sessions:", err);
        if (mounted) setSessions([]);
      } finally {
        if (mounted) {
          setSessionsLoaded(true);
        }
      }
    })();

    return () => { mounted = false; };
  }, [currentUser]);

  // Load either a single session report (interview or aptitude) or the global aggregated summary
  useEffect(() => {
    let mounted = true;

    // Guard: if a session is selected but sessions list hasn't loaded yet, do not attempt to fetch yet.
    if (selectedSessionId && !sessionsLoaded) {
      return;
    }

    const loadingGuard = setTimeout(() => {
      if (!mounted) {
        return;
      }
      setIsLoading(false);
      setError('Unable to load session data');
    }, 20000);

    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        if (selectedSessionId && !currentUser?.user_id) {
          setError('Please sign in with Google to continue.');
          setReport(null);
          setSummary(null);
          return;
        }

        if (selectedSessionId) {
          const matchedSession = sessions.find(s => s.session_id === selectedSessionId);
          
          if (matchedSession?.type === 'aptitude' || selectedSessionId.startsWith('aptitude_')) {
            const data = await getAptitudeAttempt(selectedSessionId);
            const analysis = data.analysis || {};
            if (mounted) {
              setReport({
                session_id: data.attempt_id,
                interview_type: 'aptitude',
                position: `Aptitude: ${data.category.replace('_', ' ').toUpperCase()}`,
                experience_level: 'fresher',
                start_time: data.timestamp,
                duration_minutes: null,
                is_aptitude: true,
                percentage: data.percentage,
                attention_score: data.attention_score,
                time_taken: data.time_taken,
                suspicious_count: data.suspicious_count,
                score: data.score,
                total_questions: data.total_questions,
                metrics: null,
                proctoring: null,
                recommendation: {
                  candidate_status: data.percentage >= 70 ? 'RECOMMENDED' : 'REQUIRES_REVIEW',
                  recommendation_text: analysis.recommendation_text || `Completed Aptitude Evaluation for ${data.category.toUpperCase()}. Secured ${data.score} out of ${data.total_questions} questions correct with a proctoring attention level of ${Math.round(data.attention_score)}%.`
                },
                analysis,
                answer_summaries: [],
                camera_available: Boolean(data.camera_enabled || data.tracking_available || data.attention_score),
              });
              setSummary(null);
            }
          } else {
            try {
              const response = await interviewAPI.getReport(selectedSessionId);
              if (mounted) {
                setReport(response.data);
                setSummary(null);
              }
            } catch (err) {
              // Try aptitude attempt fallback
              try {
                const data = await getAptitudeAttempt(selectedSessionId);
                const analysis = data.analysis || {};
                if (mounted) {
                  setReport({
                    session_id: data.attempt_id,
                    interview_type: 'aptitude',
                    position: `Aptitude: ${data.category.replace('_', ' ').toUpperCase()}`,
                    experience_level: 'fresher',
                    start_time: data.timestamp,
                    duration_minutes: null,
                    is_aptitude: true,
                    percentage: data.percentage,
                    attention_score: data.attention_score,
                    time_taken: data.time_taken,
                    suspicious_count: data.suspicious_count,
                    score: data.score,
                    total_questions: data.total_questions,
                    metrics: null,
                    proctoring: null,
                    recommendation: {
                      candidate_status: data.percentage >= 70 ? 'RECOMMENDED' : 'REQUIRES_REVIEW',
                      recommendation_text: analysis.recommendation_text || `Completed Aptitude Evaluation for ${data.category.toUpperCase()}. Secured ${data.score} out of ${data.total_questions} questions correct with a proctoring attention level of ${Math.round(data.attention_score)}%.`
                    },
                    analysis,
                    answer_summaries: [],
                    camera_available: Boolean(data.camera_enabled || data.tracking_available || data.attention_score),
                  });
                  setSummary(null);
                }
              } catch (aptitudeErr) {
                throw err;
              }
            }
          }
        } else {
          const data = await getAnalyticsSummary(currentUser?.user_id);
          if (mounted) {
            setSummary(data);
            setReport(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.detail || 'Unable to fetch dashboard metrics.');
        }
      } finally {
        if (mounted) {
          clearTimeout(loadingGuard);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(loadingGuard);
    };
  }, [selectedSessionId, sessions, sessionsLoaded, currentUser]);

  // Load Aptitude Aggregated Analytics when Tab switches to Aptitude
  useEffect(() => {
    let mounted = true;
    if (activeTab === "aptitude" && !selectedSessionId && currentUser?.user_id) {
      setLoadingAptitude(true);
      aptitudeAPI.getAnalytics()
        .then((res) => {
          if (mounted) {
            setAptitudeSummary(res.data || res);
            setLoadingAptitude(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load aptitude analytics:", err);
          if (mounted) setLoadingAptitude(false);
        });
    }
    return () => { mounted = false; };
  }, [activeTab, selectedSessionId, currentUser]);

  if (!currentUser?.user_id) {
    return (
      <MainLayout activeView="analysis-dashboard" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div
            className="glass-panel animate-fade-in"
            style={{
              borderRadius: '1.5rem',
              padding: '4rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(145deg, ${theme.colors.surfacePrimary}cc, ${theme.colors.surfaceSecondary}aa)`,
              border: `1px solid ${theme.colors.borderLight}`,
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(16px)',
              width: '100%',
            }}
          >
            <div style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: '1.25rem', background: `linear-gradient(135deg, ${theme.colors.primary}40, ${theme.colors.info}20)`, color: theme.colors.primary, marginBottom: '1.5rem', marginLeft: 'auto', marginRight: 'auto' }}>
              <Lock size={32} />
            </div>
            
            <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: '900', margin: '0 0 0.75rem', letterSpacing: '-0.02em', color: theme.colors.textPrimary }}>
              Sign in required
            </h2>
            
            <p style={{ color: theme.colors.textSecondary, lineHeight: 1.7, maxWidth: 540, margin: '0 auto 2rem', fontSize: theme.fonts.size.md }}>
              Please sign in to access your recruitment benchmarks, AI analysis, and placement recommendations.
            </p>
            
            <button
              type="button"
              onClick={() => onNavigate?.('login')}
              style={{
                padding: '0.85rem 2.5rem',
                borderRadius: '999px',
                border: 'none',
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.info})`,
                color: theme.colors.bgPrimary,
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: theme.fonts.size.sm,
                boxShadow: '0 10px 25px rgba(34, 211, 238, 0.2)',
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const hasData = summary && (summary.interviews_conducted > 0 || summary.aptitude_attempts > 0);

  if (!isLoading && !error && !selectedSessionId && !hasData) {
    return (
      <MainLayout activeView="analysis-dashboard" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div
            className="glass-panel animate-fade-in"
            style={{
              borderRadius: '1.5rem',
              padding: '4rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(145deg, ${theme.colors.surfacePrimary}cc, ${theme.colors.surfaceSecondary}aa)`,
              border: `1px solid ${theme.colors.borderLight}`,
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(16px)',
              width: '100%',
            }}
          >
            <div style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: '1.25rem', background: `linear-gradient(135deg, ${theme.colors.primary}40, ${theme.colors.info}20)`, color: theme.colors.primary, marginBottom: '1.5rem', marginLeft: 'auto', marginRight: 'auto' }}>
              <Sparkles size={32} />
            </div>
            
            <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: '900', margin: '0 0 0.75rem', letterSpacing: '-0.02em', color: theme.colors.textPrimary }}>
              No completed sessions yet
            </h2>
            
            <p style={{ color: theme.colors.textSecondary, lineHeight: 1.7, maxWidth: 540, margin: '0 auto 2rem', fontSize: theme.fonts.size.md }}>
              AI Placements Analysis will activate automatically once you complete an interview, mock interview, or aptitude test.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser?.user_id) {
                    window.alert('Please sign in with Google to continue.');
                    onNavigate?.('login');
                    return;
                  }
                  onNavigate?.('interview-types');
                }}
                style={{
                  padding: '0.85rem 1.5rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.info})`,
                  color: theme.colors.bgPrimary,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: theme.fonts.size.sm,
                  boxShadow: '0 10px 25px rgba(34, 211, 238, 0.2)',
                }}
              >
                Start AI Interview
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser?.user_id) {
                    window.alert('Please sign in with Google to continue.');
                    onNavigate?.('login');
                    return;
                  }
                  onNavigate?.('aptitude-test');
                }}
                style={{
                  padding: '0.85rem 1.5rem',
                  borderRadius: '999px',
                  border: `1px solid ${theme.colors.borderLight}`,
                  background: theme.colors.surfacePrimary,
                  color: theme.colors.textPrimary,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: theme.fonts.size.sm,
                }}
              >
                Take an Aptitude Test
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const getLevelLabel = (lvl) => {
    const map = { 1: "Basic", 2: "Intermediate", 3: "Advanced", 4: "Expert" };
    return map[lvl] || lvl;
  };

  return (
    <MainLayout activeView="analysis-dashboard" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div className="pad-mobile" style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '100vh', maxWidth: '1320px', margin: '0 auto' }}>
        
        {/* Header Block */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: '900', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {selectedSessionId ? 'Assessment Attempt Report' : 'AI Placements Dashboard'}
            </h1>
            <p style={{ color: theme.colors.textTertiary, marginTop: '0.45rem', fontSize: theme.fonts.size.md }}>
              {selectedSessionId 
                ? 'Dynamic metrics and proctoring analytics captured for your latest attempt.' 
                : 'Aggregated recruitment benchmarks generated from your live evaluation sessions.'
              }
            </p>
          </div>
          {selectedSessionId && (
            <button
              onClick={() => onNavigate?.('analysis-dashboard')}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '999px',
                border: `1px solid ${theme.colors.borderLight}`,
                background: theme.colors.surfacePrimary,
                color: theme.colors.textPrimary,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: theme.fonts.size.sm,
              }}
            >
              Back to Overview
            </button>
          )}
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: theme.colors.textSecondary, fontSize: theme.fonts.size.lg }}>
            <Sparkles size={24} style={{ display: 'block', margin: '0 auto 1rem', color: theme.colors.primary }} className="spin-icon" />
            Loading evaluation data...
          </div>
        )}

        {/* Error Container */}
        {error && !isLoading && (
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '1rem', border: `1px solid ${theme.colors.danger}40`, background: `${theme.colors.danger}05`, color: theme.colors.danger, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertCircle size={24} />
            <div>
              <div style={{ fontWeight: 800, fontSize: theme.fonts.size.lg }}>Evaluation Service Error</div>
              <div style={{ color: theme.colors.textSecondary, marginTop: '0.25rem' }}>{error}</div>
            </div>
          </div>
        )}

        {/* Single Session Report (Interviews or Aptitude Sets) */}
        {!isLoading && !error && report && (
          <>
            {/* Stat Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              {[
                { label: 'Overall score', value: report.is_aptitude ? `${Math.round(report.percentage ?? 0)}%` : `${Math.round(report.metrics?.overall_score ?? 0)}%`, color: theme.colors.primary, icon: Target },
                { label: report.is_aptitude ? 'Attention score' : 'Technical depth', value: report.is_aptitude ? `${Math.round(report.analysis?.attention_score ?? report.attention_score ?? 0)}%` : `${Math.round(report.metrics?.technical_score ?? 0)}%`, color: theme.colors.info, icon: Brain },
                { label: report.is_aptitude ? 'Time taken' : 'Verbal communication', value: report.is_aptitude ? `${Math.floor((report.time_taken ?? 0) / 60)}m ${(report.time_taken ?? 0) % 60}s` : `${Math.round(report.metrics?.communication_score ?? 0)}%`, color: theme.colors.success, icon: Award },
                { label: report.is_aptitude ? 'Cheating flags' : 'Proctoring integrity', value: report.is_aptitude ? `${report.suspicious_count ?? 0}` : `${Math.round(report.proctoring?.integrity_score ?? 0)}%`, color: theme.colors.warning, icon: Eye },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="glass-panel animate-fade-in"
                    style={{
                      borderRadius: '1.25rem',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 120,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
                      <Icon size={18} color={stat.color} />
                    </div>
                    <p style={{ fontSize: '2.5rem', fontWeight: '900', color: stat.color, margin: '0.75rem 0 0', lineHeight: 1 }}>{stat.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Recruiter Summary Card */}
            <div
              className="glass-panel animate-fade-in"
              style={{
                borderRadius: '1.25rem',
                padding: '2rem',
                marginBottom: '2.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: theme.fonts.size.xl, fontWeight: '800' }}>
                    {report.is_aptitude ? "AI Proctoring Assessment" : "AI Evaluator Assessment"}
                  </h3>
                  <p style={{ color: theme.colors.textTertiary, margin: '0.25rem 0 0', fontSize: theme.fonts.size.sm }}>
                    {report.position} • {report.is_aptitude ? `Set ${report.analysis?.set_number || 1} Attempt` : `${report.interview_type?.replace('mock_', '').toUpperCase()} Round`}
                  </p>
                </div>
                <RecruiterBadge status={report.recommendation?.candidate_status} />
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '1rem', background: theme.colors.bgPrimary, border: `1px solid ${theme.colors.borderLight}` }}>
                <p style={{ color: theme.colors.textSecondary, margin: 0, lineHeight: 1.7, fontSize: theme.fonts.size.md }}>
                  {report.recommendation?.recommendation_text || 'No recommendation text available.'}
                </p>
              </div>
            </div>

            {/* Detailed Gemini Report Block */}
            {report.analysis && (
              <div className="glass-panel animate-fade-in" style={{ borderRadius: '1.25rem', padding: '2rem', marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', color: theme.colors.info }}>
                  <Sparkles size={20} />
                  <h3 style={{ margin: 0, fontWeight: 800, fontSize: theme.fonts.size.lg }}>Gemini AI Feedback Analysis</h3>
                </div>
                <p style={{ margin: '0 0 1.25rem', color: theme.colors.textSecondary, lineHeight: 1.7 }}>
                  {report.analysis.overall_impression || 'No AI analysis available.'}
                </p>
                
                <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <MiniSummary label="Time Management" value={report.analysis.time_management || '—'} />
                  <MiniSummary label="Accuracy / Score Trends" value={report.analysis.accuracy_trends || '—'} />
                  <MiniSummary label="Suspicious proctoring activity" value={report.analysis.suspicious_activity || '—'} />
                  <MiniSummary label="Evaluation Risk Level" value={(report.analysis.risk_level || 'low').toUpperCase()} />
                </div>
              </div>
            )}

            {/* Answer transcripts for interviews */}
            {report.answer_summaries?.length ? (
              <div
                className="glass-panel animate-fade-in"
                style={{
                  borderRadius: '1.25rem',
                  padding: '2rem',
                }}
              >
                <h3 style={{ marginBottom: '1.5rem', color: theme.colors.textPrimary, fontSize: theme.fonts.size.lg, fontWeight: '800' }}>Exchanges & Transcripts</h3>
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                  {report.answer_summaries.map((item, index) => (
                    <div key={index} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '1rem', background: `${theme.colors.surfacePrimary}80` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <span style={{ fontSize: theme.fonts.size.xs, color: theme.colors.primary, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Q{index + 1}</span>
                        <span style={{ display: 'inline-flex', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: theme.colors.textTertiary }}>
                          Diff: <span style={{ color: theme.colors.info }}>{item.difficulty || 'medium'}</span>
                        </span>
                      </div>
                      <p style={{ margin: '0.5rem 0 0.75rem', color: theme.colors.textPrimary, fontWeight: '700', fontSize: theme.fonts.size.md, lineHeight: 1.5 }}>
                        {item.question || `Question ${index + 1}`}
                      </p>
                      <div style={{ padding: '1rem', borderRadius: '0.75rem', background: theme.colors.bgPrimary, border: `1px solid ${theme.colors.borderLight}`, fontSize: theme.fonts.size.sm, color: theme.colors.textSecondary, lineHeight: 1.6 }}>
                        <div style={{ color: theme.colors.textTertiary, fontWeight: 700, fontSize: theme.fonts.size.xs, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Candidate Answer</div>
                        "{item.answer || 'No response recorded.'}"
                      </div>
                      {item.feedback && (
                        <p style={{ margin: '0.75rem 0 0', color: theme.colors.success, fontSize: theme.fonts.size.sm, display: 'flex', gap: '0.5rem' }}>
                          <Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{item.feedback}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Aggregated Dashboard (No single report selected) */}
        {!isLoading && !error && !selectedSessionId && summary && (
          <>
            {/* Sub Tabs Selector */}
            <div style={{ display: "flex", gap: "1rem", borderBottom: `1px solid ${theme.colors.borderLight}`, marginBottom: "2rem", overflowX: "auto", whiteSpace: "nowrap", WebkitOverflowScrolling: "touch", paddingBottom: "2px" }}>
              <button
                onClick={() => setActiveTab("interviews")}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  background: "transparent",
                  color: activeTab === "interviews" ? theme.colors.primary : theme.colors.textSecondary,
                  borderBottom: activeTab === "interviews" ? `3px solid ${theme.colors.primary}` : "none",
                  fontWeight: "800",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                  flexShrink: 0
                }}
              >
                Placement Interviews
              </button>
              <button
                onClick={() => setActiveTab("aptitude")}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  background: "transparent",
                  color: activeTab === "aptitude" ? theme.colors.primary : theme.colors.textSecondary,
                  borderBottom: activeTab === "aptitude" ? `3px solid ${theme.colors.primary}` : "none",
                  fontWeight: "800",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                  flexShrink: 0
                }}
              >
                Aptitude Assessments
              </button>
            </div>

            {/* TAB 1: INTERVIEW ANALYTICS */}
            {activeTab === "interviews" && (
              <div>
                {/* Aggregated Interview Performance Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  {[
                    { label: 'Interviews Conducted', value: summary.interviews_conducted ?? 0, color: theme.colors.primary, icon: Brain },
                    { label: 'Avg Interview Score', value: summary.interview_performance?.overall_score ? `${Math.round(summary.interview_performance.overall_score)}%` : '—', color: theme.colors.success, icon: Target },
                    { label: 'Avg Communication', value: summary.interview_performance?.communication_score ? `${Math.round(summary.interview_performance.communication_score)}%` : '—', color: theme.colors.info, icon: Award },
                    { label: 'Avg Proctoring Integrity', value: summary.proctoring_integrity?.average_integrity ? `${Math.round(summary.proctoring_integrity.average_integrity)}%` : '—', color: theme.colors.warning, icon: Eye },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className="glass-panel"
                        style={{
                          borderRadius: '1.25rem',
                          padding: '1.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: 120,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
                          <Icon size={18} color={stat.color} />
                        </div>
                        <p style={{ fontSize: '2.5rem', fontWeight: '900', color: stat.color, margin: '0.75rem 0 0', lineHeight: 1 }}>{stat.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Recruiter Placement Recommendation */}
                <div className="glass-panel" style={{ padding: '2rem', borderRadius: '1.25rem', marginBottom: '2.5rem', border: `1px solid ${theme.colors.borderLight}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: "800", fontSize: theme.fonts.size.lg }}>AI Hiring Placement Recommendation</h3>
                      <p style={{ color: theme.colors.textSecondary, margin: "0.25rem 0 0", fontSize: theme.fonts.size.sm }}>Aggregated from proctored live code submissions and speaking assessments.</p>
                    </div>
                    <RecruiterBadge status={summary.recruiter_recommendation?.status} />
                  </div>
                  <div style={{ padding: '1rem 1.25rem', borderRadius: '10px', backgroundColor: theme.colors.bgPrimary, border: `1px solid ${theme.colors.borderLight}` }}>
                    <p style={{ color: theme.colors.textSecondary, margin: 0, lineHeight: 1.6 }}>{summary.recruiter_recommendation?.recommendation}</p>
                  </div>
                </div>

                {/* Completed Sessions Table */}
                {sessions.length > 0 ? (
                  <div>
                    <h2 style={{ fontSize: theme.fonts.size.xl, fontWeight: '800', marginBottom: '1.5rem', color: theme.colors.textPrimary }}>
                      Completed Sessions
                    </h2>
                    
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {sessions.map((session) => (
                        <div
                          key={session.session_id}
                          onClick={() => onNavigate?.('analysis-dashboard', { sessionId: session.session_id })}
                          className="glass-panel"
                          style={{
                            borderRadius: '1.25rem',
                            padding: '1.5rem',
                            cursor: 'pointer',
                            background: selectedSessionId === session.session_id ? `linear-gradient(135deg, ${theme.colors.primary}20, ${theme.colors.info}10)` : theme.colors.surfacePrimary,
                            border: `1px solid ${selectedSessionId === session.session_id ? theme.colors.primary : theme.colors.borderLight}`,
                            transition: 'all 200ms',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = theme.colors.primary;
                            e.currentTarget.style.background = `${theme.colors.primary}08`;
                          }}
                          onMouseLeave={(e) => {
                            if (selectedSessionId !== session.session_id) {
                              e.currentTarget.style.borderColor = theme.colors.borderLight;
                              e.currentTarget.style.background = theme.colors.surfacePrimary;
                            }
                          }}
                        >
                          <div>
                            <h3 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: theme.fonts.size.lg, fontWeight: '700' }}>
                              {session.type === 'aptitude' ? `Aptitude Test - ${session.interview_type?.toUpperCase() || 'Unknown'}` : `${session.interview_type?.replace('_', ' ').toUpperCase() || 'Interview'} Round`}
                            </h3>
                            <p style={{ margin: '0.5rem 0 0', color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm }}>
                              {new Date(session.timestamp || session.created_at || session.start_time).toLocaleDateString()} at {new Date(session.timestamp || session.created_at || session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'inline-block', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', backgroundColor: `${theme.colors.primary}20`, color: theme.colors.primary, fontSize: theme.fonts.size.xs, fontWeight: '700' }}>
                              View Report
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "3rem", textAlign: "center", color: theme.colors.textTertiary }}>No completed interview sessions.</div>
                )}
              </div>
            )}

            {/* TAB 2: APTITUDE ANALYTICS */}
            {activeTab === "aptitude" && (
              <div>
                {loadingAptitude ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", gap: "1rem" }}>
                    <Loader2 size={32} className="spin-icon" color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textSecondary }}>Calculating aptitude progress...</span>
                  </div>
                ) : aptitudeSummary ? (
                  <div>
                    {/* Aptitude Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                      {[
                        { label: 'Questions Solved', value: aptitudeSummary.questions_solved ?? 0, color: theme.colors.primary, icon: HelpCircle },
                        { label: 'Average Accuracy', value: `${Math.round(aptitudeSummary.average_accuracy ?? 0)}%`, color: theme.colors.success, icon: Target },
                        { label: 'Completed Sets', value: aptitudeSummary.completed_sets ?? 0, color: theme.colors.info, icon: BookOpen },
                        { label: 'Total Attempts', value: aptitudeSummary.total_attempts ?? 0, color: theme.colors.warning, icon: Activity },
                        { label: 'Average Time', value: `${Math.floor((aptitudeSummary.average_time ?? 0) / 60)}m ${Math.round((aptitudeSummary.average_time ?? 0) % 60)}s`, color: theme.colors.danger, icon: Clock },
                      ].map((stat) => {
                        const Icon = stat.icon;
                        return (
                          <div
                            key={stat.label}
                            className="glass-panel"
                            style={{
                              borderRadius: '1.25rem',
                              padding: '1.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              minHeight: 120,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
                              <Icon size={18} color={stat.color} />
                            </div>
                            <p style={{ fontSize: '2.25rem', fontWeight: '900', color: stat.color, margin: '0.75rem 0 0', lineHeight: 1 }}>{stat.value}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Recharts Charts Section */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", lg: "1fr 1fr", gap: "2rem", marginBottom: "2.5rem" }}>
                      
                      {/* Chart 1: Accuracy Trend over time */}
                      <div className="glass-panel" style={{ padding: "1.75rem", borderRadius: "1.5rem", border: `1px solid ${theme.colors.borderLight}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", color: theme.colors.primary }}>
                          <TrendingUp size={18} />
                          <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1.1rem" }}>Accuracy Trend over Sets</h3>
                        </div>
                        <div style={{ width: "100%", height: 300 }}>
                          {aptitudeSummary.progress_trend?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={aptitudeSummary.progress_trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke={`${theme.colors.borderLight}50`} />
                                <XAxis dataKey="date" stroke={theme.colors.textTertiary} fontSize={11} />
                                <YAxis stroke={theme.colors.textTertiary} fontSize={11} domain={[0, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: theme.colors.surfacePrimary, borderColor: theme.colors.borderLight }} />
                                <Legend />
                                <Line type="monotone" dataKey="score" name="Accuracy %" stroke={theme.colors.primary} strokeWidth={3} activeDot={{ r: 8 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: "grid", placeItems: "center", height: "100%", color: theme.colors.textTertiary }}>Not enough attempts data.</div>
                          )}
                        </div>
                      </div>

                      {/* Chart 2: Category Breakdown accuracy */}
                      <div className="glass-panel" style={{ padding: "1.75rem", borderRadius: "1.5rem", border: `1px solid ${theme.colors.borderLight}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", color: theme.colors.info }}>
                          <BarChart3 size={18} />
                          <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1.1rem" }}>Topic Accuracy Comparison</h3>
                        </div>
                        <div style={{ width: "100%", height: 300 }}>
                          {aptitudeSummary.category_performance?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={aptitudeSummary.category_performance}>
                                <CartesianGrid strokeDasharray="3 3" stroke={`${theme.colors.borderLight}50`} />
                                <XAxis dataKey="subject" stroke={theme.colors.textTertiary} fontSize={10} />
                                <YAxis stroke={theme.colors.textTertiary} fontSize={11} domain={[0, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: theme.colors.surfacePrimary, borderColor: theme.colors.borderLight }} />
                                <Legend />
                                <Bar dataKey="score" name="Average Accuracy %" fill={theme.colors.info} radius={[5, 5, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: "grid", placeItems: "center", height: "100%", color: theme.colors.textTertiary }}>Not enough topic data.</div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Detailed Category Breakdown Table */}
                    <div className="glass-panel" style={{ borderRadius: "1.5rem", overflow: "hidden", border: `1px solid ${theme.colors.borderLight}` }}>
                      <div style={{ padding: "1.5rem 1.75rem", borderBottom: `1px solid ${theme.colors.borderLight}`, backgroundColor: `${theme.colors.surfaceSecondary}50` }}>
                        <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1.1rem" }}>Category Analytics Breakdown</h3>
                      </div>
                      
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${theme.colors.borderLight}`, backgroundColor: `${theme.colors.surfaceSecondary}30` }}>
                              <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700" }}>Topic Name</th>
                              <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700" }}>Attempts</th>
                              <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700" }}>Average Accuracy</th>
                              <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700" }}>Questions Solved</th>
                              <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700" }}>Sets Completed</th>
                              <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700" }}>Active Level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aptitudeSummary.category_analytics?.map((cat) => (
                              <tr key={cat.category_id} style={{ borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                                <td style={{ padding: "1.1rem 1.5rem", fontWeight: "700" }}>{cat.category_name}</td>
                                <td style={{ padding: "1.1rem 1.5rem", color: theme.colors.textSecondary }}>{cat.attempts_count}</td>
                                <td style={{ padding: "1.1rem 1.5rem", fontWeight: "700", color: cat.average_accuracy >= 75 ? theme.colors.success : cat.average_accuracy >= 50 ? theme.colors.warning : theme.colors.textPrimary }}>
                                  {cat.average_accuracy}%
                                </td>
                                <td style={{ padding: "1.1rem 1.5rem", color: theme.colors.textSecondary }}>{cat.questions_solved}</td>
                                <td style={{ padding: "1.1rem 1.5rem", color: theme.colors.textSecondary }}>{cat.completed_sets_count} Sets</td>
                                <td style={{ padding: "1.1rem 1.5rem" }}>
                                  <span style={{
                                    padding: "0.2rem 0.5rem",
                                    borderRadius: "4px",
                                    fontSize: "0.75rem",
                                    fontWeight: "700",
                                    backgroundColor: cat.current_level === 4 ? `${theme.colors.danger}15` : cat.current_level === 3 ? `${theme.colors.warning}15` : cat.current_level === 2 ? `${theme.colors.info}15` : `${theme.colors.success}15`,
                                    color: cat.current_level === 4 ? theme.colors.danger : cat.current_level === 3 ? theme.colors.warning : cat.current_level === 2 ? theme.colors.info : cat.current_level === 1 ? theme.colors.success : theme.colors.textSecondary
                                  }}>
                                    {getLevelLabel(cat.current_level)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div style={{ padding: "3rem", textAlign: "center", color: theme.colors.textTertiary }}>Failed to calculate analytics summary.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

function MiniSummary({ label, value }) {
  const { theme } = useTheme();

  return (
    <div style={{ padding: '1rem', borderRadius: '1rem', background: theme.colors.bgPrimary, border: `1px solid ${theme.colors.borderLight}` }}>
      <div style={{ fontSize: theme.fonts.size.xs, color: theme.colors.textTertiary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: '0.45rem', color: theme.colors.textSecondary, lineHeight: 1.65 }}>{value}</div>
    </div>
  );
}
