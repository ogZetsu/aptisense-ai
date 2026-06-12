import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { useTheme } from '../contexts/ThemeContext';
import { getAnalyticsSessions } from '../services/api';
import { Clock, FileText, Brain, ExternalLink } from 'lucide-react';

export default function HistoryPage({ onNavigate, currentUser, onLogout }) {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadSessions = async () => {
      try {
        setLoading(true);
        if (!currentUser?.user_id) {
          setSessions([]);
          setError('Please sign in with Google to continue.');
          return;
        }

        const data = await getAnalyticsSessions(currentUser.user_id);
        if (mounted) {
          // Ensure sessions belong to the logged-in user only
          const filtered = (data || []).filter((s) => {
            try {
              // Some sessions might use user_id or owner fields
              return String(s.user_id || s.owner || s.userId) === String(currentUser.user_id);
            } catch (e) {
              return false;
            }
          });
          setSessions(filtered);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load sessions');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSessions();
    return () => { mounted = false; };
  }, [currentUser]);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    } catch (e) {
      return isoString;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'hr-interview': 'HR Interview',
      'technical-interview': 'Technical Interview',
      'behavioral-interview': 'Behavioral Interview',
      'mock-interview': 'Mock Interview',
      'aptitude': 'Aptitude Test',
      'numerical': 'Numerical Reasoning',
      'verbal': 'Verbal Reasoning',
      'reasoning': 'Logical Reasoning',
      'advanced_quant': 'Advanced Quant',
      'advanced_coding': 'Advanced Coding'
    };
    return labels[type] || type?.replace(/-|_/g, ' ').toUpperCase() || 'Interview';
  };

  return (
    <MainLayout activeView="history" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            color: theme.colors.textPrimary
          }}>
            Interview History
          </h1>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: '1rem'
          }}>
            Review your completed interviews, aptitude attempts, and recruiter feedback.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: theme.colors.textSecondary
          }}>
            Loading your interview history...
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            padding: '1.5rem',
            borderRadius: '0.75rem',
            backgroundColor: `#FF6B6B33`,
            border: `1px solid #FF6B6B`,
            color: '#FF6B6B'
          }}>
            <strong>Error:</strong> {error}
            {!currentUser?.user_id && (
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  style={{
                    padding: '0.625rem 1rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${theme.colors.borderLight}`,
                    backgroundColor: theme.colors.surfacePrimary,
                    color: theme.colors.textPrimary,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => onNavigate?.('login')}
                >
                  Continue with Google
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sessions.length === 0 && (
          <div style={{
            padding: '3rem 2rem',
            borderRadius: '1rem',
            border: `2px dashed ${theme.colors.borderLight}`,
            textAlign: 'center',
            backgroundColor: `${theme.colors.surfaceSecondary}40`,
            color: theme.colors.textSecondary,
            fontSize: '1rem',
            fontWeight: 600,
          }}>
            No completed interviews yet.
          </div>
        )}

        {/* Sessions list */}
        {!loading && !error && sessions.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {sessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                theme={theme}
                formatDate={formatDate}
                getTypeLabel={getTypeLabel}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function SessionCard({ session, theme, formatDate, getTypeLabel, onNavigate }) {
  const isInterview = session.type === 'interview';
  const score = session.overall_score;

  return (
    <div style={{
      padding: '1.5rem',
      borderRadius: '1rem',
      border: `1px solid ${theme.colors.borderLight}`,
      backgroundColor: theme.colors.surfaceSecondary,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      transition: 'all 300ms ease',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Type badge + Score */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          paddingInline: '0.75rem',
          paddingBlock: '0.375rem',
          borderRadius: '9999px',
          backgroundColor: `${theme.colors.primary}22`,
          color: theme.colors.primary,
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          {isInterview ? <Brain size={14} /> : <FileText size={14} />}
          {getTypeLabel(session.interview_type)}
        </div>
        {score !== null && score !== undefined && (
          <div style={{
            paddingInline: '0.75rem',
            paddingBlock: '0.375rem',
            borderRadius: '0.375rem',
            backgroundColor: score >= 75 ? '#10B98122' : score >= 60 ? '#F59E0B22' : '#EF444422',
            color: score >= 75 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626',
            fontSize: '0.875rem',
            fontWeight: 700
          }}>
            {Math.round(score)}%
          </div>
        )}
      </div>

      {/* Position/Role */}
      <div>
        <div style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: theme.colors.textPrimary,
          marginBottom: '0.25rem'
        }}>
          {session.position || 'Interview Session'}
        </div>
      </div>

      {/* Metadata */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: theme.colors.textTertiary,
        fontSize: '0.875rem'
      }}>
        <Clock size={14} />
        {formatDate(session.start_time)}
      </div>

      {/* View button */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: `1px solid ${theme.colors.borderLight}`,
            backgroundColor: 'transparent',
            color: theme.colors.primary,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
          onClick={() => {
            try {
              localStorage.setItem('aptisense.openSession', session.session_id);
            } catch (e) {}
            if (session.type === 'aptitude') {
              onNavigate?.('previous-attempts', { sessionId: session.session_id });
            } else {
              onNavigate?.('results', { sessionId: session.session_id });
            }
          }}
        >
          View Details
          <ExternalLink size={14} />
        </button>
        <button
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            border: `1px solid ${theme.colors.borderLight}`,
            backgroundColor: theme.colors.surfacePrimary,
            color: theme.colors.textPrimary,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={() => {
            // Quick copy link
            const pageParam = session.type === 'aptitude' ? 'previous-attempts' : 'results';
            const url = `${window.location.origin}${window.location.pathname}?page=${pageParam}&session_id=${session.session_id}`;
            navigator.clipboard?.writeText(url);
          }}
        >
          Copy Link
        </button>
      </div>
    </div>
  );
}
