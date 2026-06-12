import React, { useEffect, useState } from "react";
import { MainLayout } from "../layouts/MainLayout";
import { useTheme } from "../contexts/ThemeContext";
import { aptitudeAPI } from "../services/api";
import { 
  Calendar, 
  Clock, 
  Award, 
  BookOpen, 
  Eye, 
  ChevronRight, 
  X,
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Sparkles,
  Search,
  Filter,
  Download,
  Share2
} from "lucide-react";
import { jsPDF } from "jspdf";

export default function AptitudeAttemptsPage({ sessionId, onNavigate, currentUser, onLogout }) {
  const { theme } = useTheme();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Review Modal State
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});

  // Search/Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = {
    numerical: "Numerical Ability",
    verbal: "Verbal Ability",
    reasoning: "Reasoning Ability",
    advanced_quant: "Advanced Quantitative",
    advanced_coding: "Advanced Coding"
  };

  useEffect(() => {
    let mounted = true;
    const fetchAttempts = async () => {
      try {
        setLoading(true);
        if (!currentUser?.user_id) {
          setError("Please sign in to view your attempts.");
          return;
        }
        const response = await aptitudeAPI.getAttempts();
        if (mounted) {
          setAttempts(response.data.attempts || response.data || []);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.detail || "Failed to load past attempts.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchAttempts();
    return () => { mounted = false; };
  }, [currentUser]);

  const effectiveSessionId = sessionId || new URLSearchParams(window.location.search).get('session_id');

  useEffect(() => {
    if (effectiveSessionId && attempts.length > 0) {
      const hasAttempt = attempts.some(a => String(a.attempt_id) === String(effectiveSessionId));
      if (hasAttempt) {
        handleOpenReview(effectiveSessionId);
      }
    }
  }, [effectiveSessionId, attempts]);

  const handleOpenReview = async (attemptId) => {
    setReviewLoading(true);
    try {
      const response = await aptitudeAPI.getAttempt(attemptId);
      setReviewAttempt(response.data || response);
      setReviewQuestions(response.data?.questions || response.questions || []);
      setUserAnswers(response.data?.user_answers || response.user_answers || response.data?.userAnswers || response.userAnswers || {});
    } catch (err) {
      alert("Failed to load attempt details.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCloseReview = () => {
    setReviewAttempt(null);
    setReviewQuestions([]);
    setUserAnswers({});

    // If session_id was in prop or URL, go back to source page or clear query param
    const hasSessionInUrl = new URLSearchParams(window.location.search).get('session_id');
    if (sessionId || hasSessionInUrl) {
      const fromPage = window.history.state?.from;
      if (fromPage && ['history', 'analysis-dashboard', 'home'].includes(fromPage)) {
        onNavigate?.(fromPage);
      } else {
        onNavigate?.('previous-attempts');
      }
    }
  };

  const downloadPDF = () => {
    if (!currentUser?.user_id) {
      window.alert('Please sign in to continue.');
      return;
    }
    if (!reviewAttempt) return;

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
      doc.text(`Aptitude Practice Results`, margin, y);
      y += 26;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      addText(`Category: ${categories[reviewAttempt.category] || reviewAttempt.category}`);
      addText(`Difficulty Level: ${getLevelName(reviewAttempt.level)}`);
      addText(`Set Number: Set ${reviewAttempt.set_number}`);
      addText(`Date: ${formatDate(reviewAttempt.timestamp)}`);
      addText(`Duration/Time Taken: ${formatDuration(reviewAttempt.time_taken)}`);
      y += 8;

      ensurePage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Performance Summary', margin, y);
      y += 18;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      addText(`Score: ${reviewAttempt.score} / ${reviewAttempt.total_questions} (${reviewAttempt.accuracy}% accuracy)`);
      addText(`Proctoring Integrity Index: ${reviewAttempt.attention_score}%`);
      addText(`Cheating Flags Count: ${reviewAttempt.suspicious_count ?? 0}`);
      
      const analysisText = reviewAttempt.analysis?.recommendation_text || 
        `Completed Aptitude Evaluation for ${reviewAttempt.category.toUpperCase()}. Secured ${reviewAttempt.score} out of ${reviewAttempt.total_questions} questions correct with a proctoring attention level of ${Math.round(reviewAttempt.attention_score)}%.`;
      addText(`Evaluation Feedback: ${analysisText}`);
      y += 15;

      // Add questions list
      if (reviewQuestions && reviewQuestions.length > 0) {
        ensurePage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Questions & Answers Review', margin, y);
        y += 20;

        reviewQuestions.forEach((q, qIdx) => {
          ensurePage();
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          addText(`Question ${qIdx + 1}:`);
          doc.setFont('helvetica', 'normal');
          addText(q.question);
          
          const userChoice = userAnswers[qIdx.toString()] || userAnswers[qIdx] || "Unanswered";
          const correctAns = q.correctAnswer || q.answer;
          const isCorrect = userChoice === correctAns;

          addText(`Your Answer: ${userChoice} (${isCorrect ? 'Correct' : 'Incorrect'})`);
          addText(`Correct Answer: ${correctAns}`);
          if (q.explanation) {
            addText(`Explanation: ${q.explanation}`);
          }
          y += 10;
          ensurePage();
        });
      }

      ensurePage();
      y += 12;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      addText('Generated by AptiSense AI.', { lineHeightFactor: 1.2 });

      doc.save(`Aptitude_Attempt_${reviewAttempt.attempt_id || 'details'}.pdf`);
    } catch (e) {
      console.warn('PDF generation failed', e);
      window.alert('Failed to generate PDF document.');
    }
  };

  const shareResults = async () => {
    if (!currentUser?.user_id) {
      window.alert('Please sign in to continue.');
      return;
    }
    if (!reviewAttempt?.attempt_id) return;
    
    const url = `${window.location.origin}${window.location.pathname}?page=previous-attempts&session_id=${encodeURIComponent(reviewAttempt.attempt_id)}`;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Aptitude Test Results', text: 'View my aptitude test practice results', url });
        return;
      }
    } catch (e) {
      console.warn('Web share failed', e);
    }

    try {
      await navigator.clipboard.writeText(url);
      window.alert('Results link copied to clipboard!');
    } catch (e) {
      console.warn('Copy to clipboard failed', e);
      window.alert('Failed to copy link.');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + 
        " at " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return isoString;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getLevelName = (lvl) => {
    const map = { 1: "Basic", 2: "Intermediate", 3: "Advanced", 4: "Expert" };
    return map[lvl] || lvl;
  };

  const filteredAttempts = attempts.filter((attempt) => {
    const matchesSearch = categories[attempt.category]?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      getLevelName(attempt.level).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || attempt.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout activeView="previous-attempts" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div className="pad-mobile" style={{ padding: "2.5rem 2rem", maxWidth: "1280px", margin: "0 auto", minHeight: "100vh" }}>
        
        {/* Header Block */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2.25rem", fontWeight: "900", margin: 0, letterSpacing: "-0.03em" }}>
            Aptitude Practice History
          </h1>
          <p style={{ color: theme.colors.textSecondary, marginTop: "0.5rem", fontSize: "1rem" }}>
            Review your previous set attempts, performance analytics, and correct answers.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "2rem",
          flexWrap: "wrap",
          alignItems: "center"
        }}>
          <div style={{
            position: "relative",
            flex: "1",
            minWidth: "260px"
          }}>
            <Search size={18} style={{
              position: "absolute",
              left: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: theme.colors.textTertiary
            }} />
            <input
              type="text"
              placeholder="Search by category or level..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem 0.75rem 2.75rem",
                borderRadius: "999px",
                border: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.textPrimary,
                outline: "none",
                fontSize: "0.9rem"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter size={16} color={theme.colors.textTertiary} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "999px",
                border: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.textPrimary,
                outline: "none",
                fontSize: "0.9rem",
                cursor: "pointer"
              }}
            >
              <option value="all">All Categories</option>
              {Object.entries(categories).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 2rem", gap: "1rem" }}>
            <Loader2 size={36} className="spin-icon" color={theme.colors.primary} />
            <span style={{ color: theme.colors.textSecondary }}>Loading attempt history...</span>
          </div>
        ) : error ? (
          <div className="glass-panel" style={{ padding: "2.5rem", borderRadius: "1rem", textAlign: "center", color: theme.colors.danger }}>
            <p>{error}</p>
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="glass-panel" style={{
            padding: "5rem 2rem",
            borderRadius: "1.5rem",
            textAlign: "center",
            background: `linear-gradient(145deg, ${theme.colors.surfacePrimary}cc, ${theme.colors.surfaceSecondary}aa)`,
            border: `1px solid ${theme.colors.borderLight}`,
            color: theme.colors.textSecondary
          }}>
            <BookOpen size={48} style={{ margin: "0 auto 1.5rem", opacity: 0.4, color: theme.colors.primary }} />
            <h3 style={{ fontSize: "1.25rem", fontWeight: "700", color: theme.colors.textPrimary, margin: "0 0 0.5rem" }}>
              No practice attempts found
            </h3>
            <p style={{ maxWidth: "420px", margin: "0 auto 1.5rem" }}>
              {searchTerm || categoryFilter !== "all" 
                ? "No completed sets match your filters. Try clearing search keywords."
                : "You haven't completed any aptitude sets yet. Start a new test to begin tracking progress."}
            </p>
            <button
              onClick={() => onNavigate?.("aptitude-test")}
              className="nav-primary-btn"
              style={{ padding: "0.75rem 1.5rem", borderRadius: "999px" }}
            >
              Take Practice Test
            </button>
          </div>
        ) : (
          <div className="glass-panel" style={{ borderRadius: "1.5rem", overflow: "hidden", border: `1px solid ${theme.colors.borderLight}` }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.colors.borderLight}`, backgroundColor: `${theme.colors.surfaceSecondary}50` }}>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Category</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Level</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Set</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Date</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Score</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Accuracy</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase" }}>Time</th>
                    <th style={{ padding: "1.25rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttempts.map((attempt) => (
                    <tr 
                      key={attempt.attempt_id} 
                      className="table-row-hover"
                      style={{ 
                        borderBottom: `1px solid ${theme.colors.borderLight}`,
                        transition: "background 200ms"
                      }}
                    >
                      <td style={{ padding: "1.25rem 1.5rem", fontWeight: "700" }}>
                        {categories[attempt.category] || attempt.category}
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem" }}>
                        <span style={{
                          padding: "0.25rem 0.65rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          backgroundColor: attempt.level === 4 ? `${theme.colors.danger}15` : attempt.level === 3 ? `${theme.colors.warning}15` : attempt.level === 2 ? `${theme.colors.info}15` : `${theme.colors.success}15`,
                          color: attempt.level === 4 ? theme.colors.danger : attempt.level === 3 ? theme.colors.warning : attempt.level === 2 ? theme.colors.info : theme.colors.success,
                        }}>
                          {getLevelName(attempt.level)}
                        </span>
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem", color: theme.colors.textSecondary }}>
                        Set {attempt.set_number || attempt.setNumber || "—"}
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem", color: theme.colors.textSecondary, fontSize: "0.9rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Calendar size={13} />
                          {formatDate(attempt.timestamp || attempt.completed_at)}
                        </div>
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem", fontWeight: "700" }}>
                        {attempt.score} / {attempt.total_questions}
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem" }}>
                        <span style={{
                          fontWeight: "800",
                          color: attempt.accuracy >= 75 ? theme.colors.success : attempt.accuracy >= 50 ? theme.colors.warning : theme.colors.danger
                        }}>
                          {attempt.accuracy}%
                        </span>
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem", color: theme.colors.textSecondary, fontSize: "0.9rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Clock size={13} />
                          {formatDuration(attempt.time_taken)}
                        </div>
                      </td>
                      <td style={{ padding: "1.25rem 1.5rem", textAlign: "right" }}>
                        <button
                          onClick={() => handleOpenReview(attempt.attempt_id)}
                          style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "99px",
                            border: `1px solid ${theme.colors.primary}40`,
                            background: "transparent",
                            color: theme.colors.primary,
                            fontWeight: "700",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            transition: "all 200ms"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <Eye size={13} />
                          Review Answers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* DETAILED ATTEMPT REVIEW MODAL */}
      {reviewAttempt && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "2rem"
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: "100%",
            maxWidth: "960px",
            maxHeight: "85vh",
            borderRadius: "1.5rem",
            background: theme.colors.surfacePrimary,
            border: `1px solid ${theme.colors.borderLight}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: "1.5rem 2rem",
              borderBottom: `1px solid ${theme.colors.borderLight}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
              background: `linear-gradient(to right, ${theme.colors.surfaceSecondary}50, transparent)`
            }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: "900", margin: 0 }}>
                  Review Attempt Details
                </h2>
                <p style={{ color: theme.colors.textTertiary, margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                  {categories[reviewAttempt.category]} • Level {getLevelName(reviewAttempt.level)} • Set {reviewAttempt.set_number}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  onClick={downloadPDF}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: `1px solid ${theme.colors.borderLight}`,
                    backgroundColor: theme.colors.surfaceSecondary,
                    color: theme.colors.textPrimary,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    transition: "all 200ms"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={shareResults}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.bgPrimary,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    transition: "all 200ms"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                >
                  <Share2 size={14} />
                  <span>Share Results</span>
                </button>
                <button 
                  onClick={handleCloseReview}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: theme.colors.textSecondary,
                    cursor: "pointer",
                    padding: "0.5rem",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    transition: "background 200ms"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${theme.colors.borderLight}`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Attempt Overview Metrics */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "1rem",
              padding: "1.5rem 2rem",
              backgroundColor: `${theme.colors.surfaceSecondary}30`,
              borderBottom: `1px solid ${theme.colors.borderLight}`
            }}>
              <div style={{ padding: "0.75rem 1rem", borderRadius: "10px", backgroundColor: `${theme.colors.surfacePrimary}80`, border: `1px solid ${theme.colors.borderLight}` }}>
                <span style={{ fontSize: "0.75rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Score Secured</span>
                <h4 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: "900", color: theme.colors.primary }}>
                  {reviewAttempt.score} / {reviewAttempt.total_questions}
                </h4>
              </div>
              <div style={{ padding: "0.75rem 1rem", borderRadius: "10px", backgroundColor: `${theme.colors.surfacePrimary}80`, border: `1px solid ${theme.colors.borderLight}` }}>
                <span style={{ fontSize: "0.75rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Accuracy Ratio</span>
                <h4 style={{ 
                  margin: "0.25rem 0 0", 
                  fontSize: "1.5rem", 
                  fontWeight: "900",
                  color: reviewAttempt.accuracy >= 75 ? theme.colors.success : reviewAttempt.accuracy >= 50 ? theme.colors.warning : theme.colors.danger 
                }}>
                  {reviewAttempt.accuracy}%
                </h4>
              </div>
              <div style={{ padding: "0.75rem 1rem", borderRadius: "10px", backgroundColor: `${theme.colors.surfacePrimary}80`, border: `1px solid ${theme.colors.borderLight}` }}>
                <span style={{ fontSize: "0.75rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Time Taken</span>
                <h4 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: "900" }}>
                  {formatDuration(reviewAttempt.time_taken)}
                </h4>
              </div>
              <div style={{ padding: "0.75rem 1rem", borderRadius: "10px", backgroundColor: `${theme.colors.surfacePrimary}80`, border: `1px solid ${theme.colors.borderLight}` }}>
                <span style={{ fontSize: "0.75rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Integrity Index</span>
                <h4 style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: "900", color: theme.colors.info }}>
                  {reviewAttempt.attention_score}%
                </h4>
              </div>
            </div>

            {/* Questions List (Scrollable) */}
            <div style={{ padding: "2rem", overflowY: "auto", flex: "1" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                {reviewQuestions.map((q, qIdx) => {
                  const userChoice = userAnswers[qIdx.toString()] || userAnswers[qIdx] || "";
                  const correctAns = q.correctAnswer || q.answer;
                  const isCorrect = userChoice === correctAns;

                  return (
                    <div 
                      key={q.id || qIdx}
                      style={{
                        padding: "1.5rem",
                        borderRadius: "1.25rem",
                        backgroundColor: `${theme.colors.surfaceSecondary}30`,
                        border: `1px solid ${isCorrect ? `${theme.colors.success}30` : userChoice ? `${theme.colors.danger}30` : theme.colors.borderLight}`
                      }}
                    >
                      {/* Top Bar Question Status */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <span style={{ fontSize: "0.85rem", color: theme.colors.primary, fontWeight: "800" }}>
                          Question {qIdx + 1}
                        </span>
                        
                        {userChoice ? (
                          isCorrect ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: theme.colors.success, fontWeight: "700" }}>
                              <CheckCircle2 size={14} /> Correct
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: theme.colors.danger, fontWeight: "700" }}>
                              <XCircle size={14} /> Incorrect
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: theme.colors.textTertiary, fontWeight: "700" }}>
                            Unanswered
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p style={{ margin: "0 0 1.25rem", fontSize: "1.05rem", fontWeight: "700", lineHeight: "1.5", color: theme.colors.textPrimary }}>
                        {q.question}
                      </p>

                      {/* Options Grid */}
                      <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.25rem" }}>
                        {q.options.map((option, optIdx) => {
                          const isOptionCorrect = option === correctAns;
                          const isOptionSelected = option === userChoice;

                          let optionBorderColor = theme.colors.borderLight;
                          let optionBgColor = "transparent";

                          if (isOptionCorrect) {
                            optionBorderColor = theme.colors.success;
                            optionBgColor = `${theme.colors.success}10`;
                          } else if (isOptionSelected) {
                            optionBorderColor = theme.colors.danger;
                            optionBgColor = `${theme.colors.danger}10`;
                          }

                          return (
                            <div
                              key={optIdx}
                              style={{
                                padding: "0.85rem 1.25rem",
                                borderRadius: "10px",
                                border: `1px solid ${optionBorderColor}`,
                                backgroundColor: optionBgColor,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                fontSize: "0.95rem"
                              }}
                            >
                              <span style={{
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                fontSize: "0.75rem",
                                fontWeight: "800",
                                border: `1px solid ${optionBorderColor}`,
                                color: isOptionCorrect ? theme.colors.success : isOptionSelected ? theme.colors.danger : theme.colors.textTertiary
                              }}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{option}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation box */}
                      {q.explanation && (
                        <div style={{
                          padding: "1rem 1.25rem",
                          borderRadius: "10px",
                          backgroundColor: `${theme.colors.surfacePrimary}90`,
                          borderLeft: `3px solid ${theme.colors.info}`,
                          fontSize: "0.9rem",
                          lineHeight: "1.6",
                          color: theme.colors.textSecondary
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: theme.colors.info, fontWeight: "800", fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                            <Sparkles size={13} />
                            Explanation
                          </div>
                          {q.explanation}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "1.25rem 2rem",
              borderTop: `1px solid ${theme.colors.borderLight}`,
              textAlign: "right",
              backgroundColor: `${theme.colors.surfaceSecondary}35`
            }}>
              <button 
                onClick={handleCloseReview}
                className="nav-primary-btn"
                style={{ padding: "0.65rem 1.5rem", borderRadius: "99px" }}
              >
                Close Review
              </button>
            </div>

          </div>
        </div>
      )}

    </MainLayout>
  );
}
