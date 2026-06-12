import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { MainLayout } from '../layouts/MainLayout';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { interviewAPI, aptitudeAPI } from '../services/api';
import { Download, Share2, Loader2, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function ResultsPage({ sessionId, onNavigate, currentUser, isAuthLoading = false, onLogout }) {
  const { theme } = useTheme();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noResults, setNoResults] = useState(false);

  const effectiveSessionId = sessionId || new URLSearchParams(window.location.search).get('session_id') || (() => { try { return localStorage.getItem('aptisense.openSession'); } catch { return null; } })();

  useEffect(() => {
    fetchReport();
    try { localStorage.removeItem('aptisense.openSession'); } catch {}
  }, [effectiveSessionId, currentUser?.user_id, isAuthLoading]);

  const fetchReport = async () => {
    let isRedirecting = false;
    try {
      if (!currentUser?.user_id) {
        if (isAuthLoading) {
          return;
        }
        setNoResults(true);
        setError('Please sign in with Google to continue.');
        setIsLoading(false);
        return;
      }

      const idToFetch = effectiveSessionId || sessionId;
      if (!idToFetch) {
        setNoResults(true);
        setIsLoading(false);
        return;
      }
      const response = await interviewAPI.getReport(idToFetch);
      const data = response.data;
      // Basic validation: require at least one real analytics or Gemini report
      const hasMetrics = data?.metrics && Object.values(data.metrics).some((v) => v != null && v !== 0);
      const hasGemini = data?.final_gemini_report && Object.keys(data.final_gemini_report).length > 0;
      const hasAnswers = Array.isArray(data?.answer_summaries) && data.answer_summaries.length > 0;
      const hasRecommendation = Boolean(data?.recommendation?.candidate_status);

      if (!hasMetrics && !hasGemini && !hasAnswers && !hasRecommendation) {
        setNoResults(true);
        setReport(null);
      } else {
        setReport(data);
      }
    } catch (err) {
      const idToFetch = effectiveSessionId || sessionId;
      if (idToFetch) {
        try {
          const aptitudeResponse = await aptitudeAPI.getAttempt(idToFetch);
          if (aptitudeResponse) {
            isRedirecting = true;
            onNavigate?.('previous-attempts', { sessionId: idToFetch });
            return;
          }
        } catch (aptitudeErr) {
          console.warn("Attempt not found in aptitude attempts either:", aptitudeErr);
        }
      }
      setError(err.response?.data?.detail || 'Error loading report');
    } finally {
      if (!isRedirecting) {
        setIsLoading(false);
      }
    }
  };

  const downloadJSON = () => {
    if (!currentUser?.user_id) {
      window.alert('Please sign in with Google to continue.');
      onNavigate?.('login');
      return;
    }
    if (!report) return;
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.session_id || 'interview_report'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Download JSON failed', e);
    }
  };

  const downloadPDF = () => {
    if (!currentUser?.user_id) {
      window.alert('Please sign in with Google to continue.');
      onNavigate?.('login');
      return;
    }
    if (!report) {
      downloadJSON();
      return;
    }

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      const maxWidth = pageWidth - margin * 2;
      let y = 48;

      const addText = (text, opts = {}) => {
        const lines = doc.splitTextToSize(text, maxWidth, opts);
        doc.text(lines, margin, y, { baseline: 'top' });
        y += lines.length * (opts.lineHeightFactor || 1.3) * 12;
      };

      const ensurePage = () => {
        if (y > doc.internal.pageSize.getHeight() - 80) {
          doc.addPage();
          y = 48;
        }
      };

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`Interview Results`, margin, y);
      y += 26;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      addText(`Session: ${report.session_id || 'N/A'}`);
      addText(`Position: ${report.position || 'N/A'}`);
      addText(`Interview type: ${report.interview_type || 'N/A'}`);
      addText(`Experience level: ${report.experience_level || 'N/A'}`);
      addText(`Date: ${new Date(report.interview_date).toLocaleString()}`);
      addText(`Duration: ${report.duration_minutes ?? 0} mins`);
      y += 8;

      ensurePage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Recommendation', margin, y);
      y += 18;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const candidateStatus = report.recommendation?.candidate_status || 'NOT_RECOMMENDED';
      addText(`Status: ${candidateStatus}`);
      addText(`Summary: ${report.recommendation?.recommendation_text || 'No recommendation text available.'}`);
      if (report.recommendation?.recommended_for_round) {
        addText(`Recommended for round: ${report.recommendation.recommended_for_round}`);
      }
      y += 8;

      ensurePage();
      if (report.recommendation?.strengths?.length) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Strengths', margin, y);
        y += 18;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        report.recommendation.strengths.forEach((item) => {
          addText(`• ${item}`);
          y += 2;
          ensurePage();
        });
        y += 4;
      }

      ensurePage();
      if (report.recommendation?.concerns?.length) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Areas to Address', margin, y);
        y += 18;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        report.recommendation.concerns.forEach((item) => {
          addText(`• ${item}`);
          y += 2;
          ensurePage();
        });
        y += 4;
      }

      ensurePage();
      const gemini = report.final_gemini_report;
      if (gemini) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('AI Recruiter Summary', margin, y);
        y += 18;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        addText(gemini.executive_summary || gemini.summary || 'No executive summary available.');
        if (gemini.key_strengths) {
          y += 4;
          addText(`Key strengths: ${Array.isArray(gemini.key_strengths) ? gemini.key_strengths.join(', ') : gemini.key_strengths}`);
        }
        if (gemini.improvement_areas) {
          y += 4;
          addText(`Improvement areas: ${Array.isArray(gemini.improvement_areas) ? gemini.improvement_areas.join(', ') : gemini.improvement_areas}`);
        }
      }

      ensurePage();
      if (!gemini && report.recommendation?.strengths?.length) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', margin, y);
        y += 18;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        addText(report.recommendation.recommendation_text || 'No summary available.');
      }

      ensurePage();
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      addText('Generated by AptiSense AI.', { lineHeightFactor: 1.2 });

      doc.save(`${report.session_id || 'interview_report'}.pdf`);
    } catch (e) {
      console.warn('jsPDF PDF generation failed, falling back to JSON', e);
      downloadJSON();
    }
  };

  const shareResults = async () => {
    if (!currentUser?.user_id) {
      window.alert('Please sign in with Google to continue.');
      onNavigate?.('login');
      return;
    }
    if (!report?.session_id) return;
    const url = `${window.location.origin}${window.location.pathname}?page=results&session_id=${encodeURIComponent(report.session_id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Interview Results', text: 'View my interview results', url });
        return;
      }
    } catch (e) {
      console.warn('Web share failed', e);
    }

    try {
      await navigator.clipboard.writeText(url);
      // Non-blocking: user will have the link in clipboard
    } catch (e) {
      console.warn('Copy to clipboard failed', e);
    }
  };

  if (isLoading) {
    return (
      <MainLayout onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p style={{ color: theme.colors.textSecondary }}>Analyzing your interview...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'transparent',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${theme.colors.danger}`,
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            <AlertCircle size={48} style={{ color: theme.colors.danger, margin: '0 auto 1rem' }} />
            <h2 style={{ color: theme.colors.textPrimary, marginBottom: '0.5rem' }}>Error Loading Report</h2>
            <p style={{ color: theme.colors.textSecondary }}>{error}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (noResults) {
    return (
      <MainLayout onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div style={{ padding: '2rem', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: 800, marginBottom: '0.5rem' }}>No completed interview results available.</h2>
            <p style={{ color: theme.colors.textSecondary }}>
              {currentUser?.user_id
                ? 'Complete an interview or aptitude test to view the detailed report.'
                : 'Please sign in with Google to continue.'}
            </p>
            {!currentUser?.user_id && (
              <button
                onClick={() => onNavigate?.('login')}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.bgPrimary,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Continue with Google
              </button>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!report) {
    return null;
  }

  const getRecommendationColor = (status) => {
    switch (status) {
      case 'RECOMMENDED':
        return theme.colors.success;
      case 'CONDITIONAL':
        return theme.colors.warning;
      case 'NOT_RECOMMENDED':
        return theme.colors.danger;
      default:
        return theme.colors.info;
    }
  };

  return (
    <MainLayout currentUser={currentUser} onLogout={onLogout} onNavigate={onNavigate}>
      <div className="pad-mobile" style={{ padding: '2rem', backgroundColor: 'transparent', minHeight: '100vh' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '3rem',
            paddingBottom: '2rem',
            borderBottom: `1px solid ${theme.colors.borderLight}`,
          }}
        >
          <div>
            <h1 style={{ fontSize: theme.fonts.size['3xl'], fontWeight: '900', marginBottom: '0.5rem' }}>
              Interview Results
            </h1>
            <p style={{ color: theme.colors.textTertiary }}>
              {report.position || 'Interview'} • {report.experience_level || 'mid'} level • {Math.round(report.duration_minutes ?? 0)} mins
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const fromPage = window.history.state?.from;
                const targetPage = ['history', 'analysis-dashboard', 'home', 'interview-types'].includes(fromPage)
                  ? fromPage
                  : 'history';
                onNavigate?.(targetPage);
              }}
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                color: theme.colors.textPrimary,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              className="glass-panel"
              onClick={() => downloadPDF()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                color: theme.colors.textPrimary,
                cursor: report?.session_id && currentUser?.user_id ? 'pointer' : 'default',
              }}
            >
              <Download size={18} />
              <span style={{ opacity: report?.session_id && currentUser?.user_id ? 1 : 0.7 }}>{report?.session_id ? 'Download PDF' : 'Download JSON'}</span>
            </button>
            <button
              onClick={() => shareResults()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: report?.session_id && currentUser?.user_id ? theme.colors.primary : theme.colors.surfacePrimary,
                border: 'none',
                borderRadius: '0.5rem',
                color: report?.session_id && currentUser?.user_id ? theme.colors.bgPrimary : theme.colors.textTertiary,
                cursor: report?.session_id && currentUser?.user_id ? 'pointer' : 'not-allowed',
                fontWeight: '600',
              }}
              disabled={!report?.session_id}
            >
              <Share2 size={18} />
              <span>{report?.session_id ? 'Share Results' : 'Share (disabled)'}</span>
            </button>
          </div>
        </div>

        {/* Recommendation Box */}
        {report.recommendation && (
          <div
            style={{
              backgroundColor: getRecommendationColor(report.recommendation.candidate_status) + '08',
              border: `2px solid ${getRecommendationColor(report.recommendation.candidate_status)}`,
              borderRadius: '1rem',
              padding: '2rem',
              marginBottom: '3rem',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2rem', alignItems: 'start' }}>
              <div
                style={{
                  fontSize: '3rem',
                  color: getRecommendationColor(report.recommendation.candidate_status),
                }}
              >
                {report.recommendation.candidate_status === 'RECOMMENDED'
                  ? '✓'
                  : report.recommendation.candidate_status === 'CONDITIONAL'
                  ? '⚠'
                  : '✗'}
              </div>
              <div>
                <h2
                  style={{
                    fontSize: theme.fonts.size['2xl'],
                    fontWeight: '700',
                    color: getRecommendationColor(report.recommendation.candidate_status),
                    marginBottom: '0.5rem',
                  }}
                >
                  {report.recommendation.candidate_status === 'RECOMMENDED'
                    ? 'Recommended for Next Round'
                    : report.recommendation.candidate_status === 'CONDITIONAL'
                    ? 'Conditional Recommendation'
                    : 'Not Recommended'}
                </h2>
                <p style={{ color: theme.colors.textSecondary, marginBottom: '1rem' }}>
                  {report.recommendation.recommendation_text || 'No recommendation text available.'}
                </p>
                {report.recommendation.recommended_for_round && (
                  <p style={{ color: theme.colors.textTertiary }}>
                    Recommended for: <strong>{report.recommendation.recommended_for_round}</strong> round
                  </p>
                )}
              </div>
            </div>

            {/* Strengths and Concerns */}
            {(report.recommendation.strengths?.length > 0 || report.recommendation.concerns?.length > 0) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '2rem',
                  marginTop: '1.5rem',
                  paddingTop: '1.5rem',
                  borderTop: `1px solid ${getRecommendationColor(report.recommendation.candidate_status)}33`,
                }}
              >
                {report.recommendation.strengths?.length > 0 && (
                  <div>
                    <h4 style={{ color: theme.colors.success, marginBottom: '0.75rem', fontWeight: '600' }}>Key Strengths</h4>
                    <ul style={{ color: theme.colors.textSecondary, fontSize: theme.fonts.size.sm, lineHeight: '1.8' }}>
                      {report.recommendation.strengths.map((strength, idx) => (
                        <li key={idx}>✓ {strength}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.recommendation.concerns?.length > 0 && (
                  <div>
                    <h4 style={{ color: theme.colors.warning, marginBottom: '0.75rem', fontWeight: '600' }}>Areas to Address</h4>
                    <ul style={{ color: theme.colors.textSecondary, fontSize: theme.fonts.size.sm, lineHeight: '1.8' }}>
                      {report.recommendation.concerns.map((concern, idx) => (
                        <li key={idx}>• {concern}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gemini Final Report (if available) */}
        {report.final_gemini_report && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '0.75rem', border: `1px solid ${theme.colors.borderLight}`, background: theme.colors.surfacePrimary }}>
            <h3 style={{ margin: 0, fontWeight: 800 }}>AI Recruiter Summary</h3>
            <p style={{ color: theme.colors.textSecondary, marginTop: '0.5rem' }}>{report.final_gemini_report.executive_summary || report.final_gemini_report.summary || JSON.stringify(report.final_gemini_report)}</p>
            {report.final_gemini_report.key_strengths && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong>Key strengths:</strong> {Array.isArray(report.final_gemini_report.key_strengths) ? report.final_gemini_report.key_strengths.join(', ') : report.final_gemini_report.key_strengths}
              </div>
            )}
            {report.final_gemini_report.improvement_areas && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong>Improvement areas:</strong> {Array.isArray(report.final_gemini_report.improvement_areas) ? report.final_gemini_report.improvement_areas.join(', ') : report.final_gemini_report.improvement_areas}
              </div>
            )}
          </div>
        )}

        {/* Analytics Dashboard */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: '700', marginBottom: '1.5rem' }}>
            Detailed Analytics
          </h2>
          <AnalyticsDashboard metrics={report.metrics} proctoring={report.proctoring} />
        </div>

        {/* Interview Transcript */}
        {report.interview_transcript && report.interview_transcript.length > 0 && (
          <div
            className="glass-panel"
            style={{
              borderRadius: '0.75rem',
              padding: '2rem',
            }}
          >
            <h2 style={{ fontSize: theme.fonts.size['2xl'], fontWeight: '700', marginBottom: '1.5rem' }}>
              Interview Transcript
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {report.interview_transcript.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem' }}>
                  <div
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: item.role === 'interviewer' ? 'rgba(255, 255, 255, 0.05)' : theme.colors.primary + '18',
                      border: `1px solid ${item.role === 'interviewer' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.primary + '30'}`,
                      borderRadius: '0.5rem',
                      fontSize: theme.fonts.size.xs,
                      fontWeight: '600',
                      color: item.role === 'interviewer' ? theme.colors.textSecondary : theme.colors.primary,
                      whiteSpace: 'nowrap',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {item.role === 'interviewer' ? '🤖 AI' : '👤 You'}
                  </div>
                  <p style={{ color: theme.colors.textSecondary }}>{item.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
