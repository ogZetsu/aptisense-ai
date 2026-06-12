import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  FileText,
  Loader2,
  Shield,
  Trash2,
  UserCheck,
  Users,
  Plus,
  Edit,
  Search,
  Filter,
  Upload,
  Download,
  CheckCircle2,
  X,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Calendar,
  TrendingUp,
  Activity,
  Maximize2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { MainLayout } from '../layouts/MainLayout';
import { useTheme } from '../contexts/ThemeContext';
import { 
  deleteAdminUser, 
  getAdminStats, 
  getAdminUsers, 
  updateUserRole,
  adminAPI 
} from '../services/api';

export default function AdminPanelPage({ onNavigate, currentUser, onLogout }) {
  const { theme } = useTheme();
  
  // Stats & Users state
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Tab State
  const [activeTab, setActiveTab] = useState("users"); // "users", "questions", or "analytics"
  const [zoomedChartId, setZoomedChartId] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [timeframe, setTimeframe] = useState("7d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Question Bank State
  const [questions, setQuestions] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Add/Edit Question Modal State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [modalError, setModalError] = useState("");
  const [modalFormData, setModalFormData] = useState({
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "",
    explanation: "",
    category: "numerical",
    level: 1,
    topic: "",
    difficulty: "Easy"
  });

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  // Load Admin Stats & User Listing
  const loadData = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [statsData, usersData] = await Promise.all([getAdminStats(), getAdminUsers()]);
      setStats(statsData);
      setUsers(usersData.users || []);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load paginated/filtered questions list
  const loadQuestions = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingQuestions(true);
    try {
      const params = {
        skip: (page - 1) * limit,
        limit,
        search: searchQuery,
        category: categoryFilter,
        level: levelFilter ? parseInt(levelFilter) : undefined
      };
      const res = await adminAPI.getQuestions(params);
      setQuestions(res.data?.questions || res.questions || []);
      setTotalQuestions(res.data?.total ?? res.total ?? 0);
    } catch (err) {
      setError("Failed to fetch questions database.");
    } finally {
      setLoadingQuestions(false);
    }
  }, [isAdmin, page, searchQuery, categoryFilter, levelFilter]);

  useEffect(() => {
    if (activeTab === "questions") {
      loadQuestions();
    }
  }, [activeTab, loadQuestions]);

  // Load System Usage Analytics
  const loadAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingAnalytics(true);
    try {
      const params = {
        timeframe,
        start_date: timeframe === "custom" ? customStartDate : undefined,
        end_date: timeframe === "custom" ? customEndDate : undefined
      };
      const res = await adminAPI.getAnalytics(params);
      setAnalyticsData(res.data || res);
    } catch (err) {
      setError("Failed to fetch system analytics logs.");
    } finally {
      setLoadingAnalytics(false);
    }
  }, [isAdmin, timeframe, customStartDate, customEndDate]);

  useEffect(() => {
    if (activeTab === "analytics") {
      if (timeframe !== "custom" || (customStartDate && customEndDate)) {
        loadAnalytics();
      }
    }
  }, [activeTab, timeframe, customStartDate, customEndDate, loadAnalytics]);

  // User management hooks
  const handleRoleToggle = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setActionLoading(user.user_id);
    try {
      await updateUserRole(user.user_id, newRole);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update role.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.full_name || user.username || user.email}"? This cannot be undone.`)) {
      return;
    }
    setActionLoading(user.user_id);
    try {
      await deleteAdminUser(user.user_id);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete user.');
    } finally {
      setActionLoading(null);
    }
  };

  // Question management CRUD hooks
  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setModalFormData({
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctAnswer: "",
      explanation: "",
      category: "numerical",
      level: 1,
      topic: "",
      difficulty: "Easy"
    });
    setModalError("");
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setModalFormData({
      question: q.question,
      optionA: q.options[0] || "",
      optionB: q.options[1] || "",
      optionC: q.options[2] || "",
      optionD: q.options[3] || "",
      correctAnswer: q.correctAnswer || q.answer || "",
      explanation: q.explanation || "",
      category: q.category,
      level: q.level || 1,
      topic: q.topic || "",
      difficulty: q.difficulty || "Easy"
    });
    setModalError("");
    setShowAddEditModal(true);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setModalError("");

    const { question, optionA, optionB, optionC, optionD, correctAnswer, category, level, topic, difficulty, explanation } = modalFormData;
    if (!question.strip ? !question.trim() : !question) {
      setModalError("Question text is required.");
      return;
    }
    if (!optionA || !optionB || !optionC || !optionD) {
      setModalError("Please specify all 4 options.");
      return;
    }
    if (!correctAnswer) {
      setModalError("Correct answer option cannot be empty.");
      return;
    }

    const payload = {
      question,
      options: [optionA, optionB, optionC, optionD],
      correctAnswer,
      explanation,
      category,
      level: parseInt(level),
      topic: topic || category.replace("_", " ").toUpperCase(),
      difficulty
    };

    try {
      if (editingQuestion) {
        await adminAPI.updateQuestion(editingQuestion.id, payload);
      } else {
        await adminAPI.createQuestion(payload);
      }
      setShowAddEditModal(false);
      setPage(1);
      loadQuestions();
      loadData();
    } catch (err) {
      setModalError(err.response?.data?.detail || "Failed to save question.");
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm("Are you sure you want to delete this question?")) {
      return;
    }
    try {
      await adminAPI.deleteQuestion(id);
      loadQuestions();
      loadData();
    } catch (err) {
      alert("Failed to delete question.");
    }
  };

  // CSV Import / Export handlers
  const handleImportCSV = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert("Please select a CSV file.");
      return;
    }

    setImportLoading(true);
    setImportSummary(null);

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      const res = await adminAPI.importQuestions(formData);
      setImportSummary(res.data || res);
      loadQuestions();
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to import CSV file.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('aptisense.token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const rootUrl = apiBaseUrl.replace(/\/+$/, '');
      const url = rootUrl.endsWith('/api/v1') ? `${rootUrl}/admin/questions/export` : `${rootUrl}/api/v1/admin/questions/export`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'aptisense_questions.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to export questions database.");
    }
  };

  const getLevelLabel = (lvl) => {
    const map = { 1: "Basic", 2: "Intermediate", 3: "Advanced", 4: "Expert" };
    return map[lvl] || lvl;
  };

  const categories = {
    numerical: "Numerical Ability",
    verbal: "Verbal Ability",
    reasoning: "Reasoning Ability",
    advanced_quant: "Advanced Quantitative",
    advanced_coding: "Advanced Coding"
  };

  if (!currentUser?.user_id) {
    return (
      <MainLayout activeView="admin" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div className="page-container">
          <div className="empty-state glass-panel">
            <Shield size={32} color={theme.colors.primary} />
            <h2>Authentication required</h2>
            <p>Please sign in to access the admin panel.</p>
            <button type="button" className="nav-primary-btn" onClick={() => onNavigate?.('login')}>
              Sign In
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return (
      <MainLayout activeView="admin" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div className="page-container">
          <div className="empty-state glass-panel">
            <Shield size={32} color={theme.colors.danger} />
            <h2>Access Denied</h2>
            <p>You do not have admin privileges. Contact your administrator if you need access.</p>
            <button type="button" className="nav-hover-btn" onClick={() => onNavigate?.('home')}>
              Go Home
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.total_users ?? '—', icon: Users, color: theme.colors.primary },
    { label: 'Interviews Conducted', value: stats?.total_interviews ?? '—', icon: Brain, color: theme.colors.info },
    { label: 'Aptitude Attempts', value: stats?.total_aptitude_attempts ?? '—', icon: FileText, color: theme.colors.success },
    { label: 'Aptitude Questions', value: stats?.total_questions ?? '—', icon: Shield, color: theme.colors.warning },
  ];

  const totalPages = Math.ceil(totalQuestions / limit);

  return (
    <MainLayout activeView="admin" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div className="page-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem' }}>
        
        {/* Header Block */}
        <div className="page-header" style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Shield size={24} color={theme.colors.primary} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Admin Control Panel</h1>
          </div>
          <p style={{ color: theme.colors.textSecondary, marginTop: '0.35rem' }}>
            Manage platform users, update authorization roles, and modify the aptitude questions database.
          </p>
        </div>

        {error && <div className="auth-alert auth-alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {loading ? (
          <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 2rem', gap: '1rem' }}>
            <Loader2 size={28} className="spin-icon" />
            <span>Loading admin console...</span>
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="glass-panel admin-stat-card" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
                    <div className="admin-stat-icon" style={{ color: stat.color, marginBottom: '0.5rem' }}>
                      <Icon size={20} />
                    </div>
                    <div className="admin-stat-value" style={{ fontSize: '1.75rem', fontWeight: '900' }}>{stat.value}</div>
                    <div className="admin-stat-label" style={{ color: theme.colors.textTertiary, fontSize: '0.85rem' }}>{stat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* TAB SELECTORS */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: `1px solid ${theme.colors.borderLight}`, marginBottom: '2rem', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
              <button
                onClick={() => setActiveTab("users")}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  background: "transparent",
                  color: activeTab === "users" ? theme.colors.primary : theme.colors.textSecondary,
                  borderBottom: activeTab === "users" ? `3px solid ${theme.colors.primary}` : "none",
                  fontWeight: "800",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                  flexShrink: 0
                }}
              >
                User Manager
              </button>
              <button
                onClick={() => setActiveTab("questions")}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  background: "transparent",
                  color: activeTab === "questions" ? theme.colors.primary : theme.colors.textSecondary,
                  borderBottom: activeTab === "questions" ? `3px solid ${theme.colors.primary}` : "none",
                  fontWeight: "800",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                  flexShrink: 0
                }}
              >
                Aptitude Question Bank
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  background: "transparent",
                  color: activeTab === "analytics" ? theme.colors.primary : theme.colors.textSecondary,
                  borderBottom: activeTab === "analytics" ? `3px solid ${theme.colors.primary}` : "none",
                  fontWeight: "800",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 150ms",
                  flexShrink: 0
                }}
              >
                System Analytics
              </button>
            </div>

            {/* TAB 1: USER MANAGEMENT */}
            {activeTab === "users" && (
              <div className="glass-panel admin-table-wrap" style={{ borderRadius: '1.25rem', overflow: 'hidden' }}>
                <div className="admin-table-header" style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                  <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>User Directory</h2>
                  <span style={{ color: theme.colors.textTertiary, fontSize: theme.fonts.size.sm }}>
                    {users.length} registered profiles
                  </span>
                </div>

                <div className="admin-table-scroll">
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: `${theme.colors.surfaceSecondary}50`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                        <th style={{ padding: '1rem 1.5rem' }}>Name</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Email</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Provider</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Role</th>
                        <th style={{ padding: '1rem 1.5rem' }}>Joined</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.user_id} style={{ borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{user.full_name || user.username || '—'}</td>
                          <td style={{ padding: '1rem 1.5rem' }}>{user.email || '—'}</td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <span className="profile-badge" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>{user.auth_provider || 'email'}</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <span className={`role-badge role-${user.role || 'user'}`} style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              backgroundColor: user.role === 'admin' ? `${theme.colors.warning}15` : `${theme.colors.info}15`,
                              color: user.role === 'admin' ? theme.colors.warning : theme.colors.info
                            }}>
                              {user.role || 'user'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', color: theme.colors.textSecondary }}>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td>
                          <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                            <div className="admin-row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="admin-action-btn"
                                title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                                disabled={actionLoading === user.user_id || user.user_id === currentUser.user_id}
                                onClick={() => handleRoleToggle(user)}
                                style={{ padding: '0.4rem', border: `1px solid ${theme.colors.borderLight}`, background: 'transparent', color: theme.colors.textSecondary, borderRadius: '4px', cursor: 'pointer' }}
                              >
                                {actionLoading === user.user_id ? (
                                  <Loader2 size={14} className="spin-icon" />
                                ) : (
                                  <UserCheck size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="admin-action-btn admin-action-danger"
                                title="Delete user"
                                disabled={actionLoading === user.user_id || user.user_id === currentUser.user_id}
                                onClick={() => handleDelete(user)}
                                style={{ padding: '0.4rem', border: `1px solid ${theme.colors.borderLight}`, background: 'transparent', color: theme.colors.danger, borderRadius: '4px', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: APTITUDE QUESTION BANK */}
            {activeTab === "questions" && (
              <div>
                
                {/* Search & Actions Bar */}
                <div style={{
                  display: "flex",
                  gap: "1rem",
                  marginBottom: "2rem",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  
                  {/* Filters */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", flex: "1", minWidth: "300px" }}>
                    <div style={{ position: "relative", flex: "1", minWidth: "180px" }}>
                      <Search size={16} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: theme.colors.textTertiary }} />
                      <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        style={{
                          width: "100%",
                          padding: "0.6rem 1rem 0.6rem 2.25rem",
                          borderRadius: "99px",
                          border: `1px solid ${theme.colors.borderLight}`,
                          backgroundColor: theme.colors.surfaceSecondary,
                          color: theme.colors.textPrimary,
                          outline: "none",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                      style={{
                        padding: "0.6rem 1.25rem",
                        borderRadius: "99px",
                        border: `1px solid ${theme.colors.borderLight}`,
                        backgroundColor: theme.colors.surfaceSecondary,
                        color: theme.colors.textPrimary,
                        cursor: "pointer",
                        outline: "none",
                        fontSize: "0.85rem"
                      }}
                    >
                      <option value="">All Categories</option>
                      {Object.entries(categories).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>

                    <select
                      value={levelFilter}
                      onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
                      style={{
                        padding: "0.6rem 1.25rem",
                        borderRadius: "99px",
                        border: `1px solid ${theme.colors.borderLight}`,
                        backgroundColor: theme.colors.surfaceSecondary,
                        color: theme.colors.textPrimary,
                        cursor: "pointer",
                        outline: "none",
                        fontSize: "0.85rem"
                      }}
                    >
                      <option value="">All Levels</option>
                      <option value="1">Basic</option>
                      <option value="2">Intermediate</option>
                      <option value="3">Advanced</option>
                      <option value="4">Expert</option>
                    </select>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: "flex", gap: "0.65rem" }}>
                    <button
                      onClick={handleOpenAdd}
                      style={{
                        padding: "0.6rem 1.25rem",
                        borderRadius: "99px",
                        border: "none",
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.bgPrimary,
                        fontWeight: "800",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <Plus size={15} /> Add Question
                    </button>
                    
                    <button
                      onClick={() => { setShowImportModal(true); setImportFile(null); setImportSummary(null); }}
                      style={{
                        padding: "0.6rem 1.25rem",
                        borderRadius: "99px",
                        border: `1px solid ${theme.colors.borderLight}`,
                        backgroundColor: theme.colors.surfaceSecondary,
                        color: theme.colors.textPrimary,
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <Upload size={14} /> Bulk CSV Import
                    </button>

                    <button
                      onClick={handleExportCSV}
                      style={{
                        padding: "0.6rem 1.25rem",
                        borderRadius: "99px",
                        border: `1px solid ${theme.colors.borderLight}`,
                        backgroundColor: theme.colors.surfaceSecondary,
                        color: theme.colors.textPrimary,
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <Download size={14} /> Export CSV
                    </button>
                  </div>

                </div>

                {/* Questions Listing table */}
                {loadingQuestions ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5rem 2rem", gap: "1rem" }}>
                    <Loader2 size={28} className="spin-icon" color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textSecondary }}>Querying database...</span>
                  </div>
                ) : questions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "4rem 2rem", color: theme.colors.textTertiary }}>
                    No questions found matching criteria.
                  </div>
                ) : (
                  <div className="glass-panel" style={{ borderRadius: "1.25rem", overflow: "hidden", border: `1px solid ${theme.colors.borderLight}`, marginBottom: "1.5rem" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                          <tr style={{ backgroundColor: `${theme.colors.surfaceSecondary}50`, borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                            <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", textTransform: "uppercase" }}>Question Text</th>
                            <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", textTransform: "uppercase" }}>Category</th>
                            <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", textTransform: "uppercase" }}>Level</th>
                            <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", textTransform: "uppercase" }}>Topic</th>
                            <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", textTransform: "uppercase" }}>Diff</th>
                            <th style={{ padding: "1rem 1.5rem", color: theme.colors.textTertiary, fontSize: "0.85rem", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {questions.map((q) => (
                            <tr key={q.id} style={{ borderBottom: `1px solid ${theme.colors.borderLight}` }}>
                              <td style={{ padding: "1rem 1.5rem", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {q.question}
                              </td>
                              <td style={{ padding: "1rem 1.5rem" }}>
                                {categories[q.category] || q.category}
                              </td>
                              <td style={{ padding: "1rem 1.5rem" }}>
                                <span style={{
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: "700",
                                  backgroundColor: q.level === 4 ? `${theme.colors.danger}15` : q.level === 3 ? `${theme.colors.warning}15` : q.level === 2 ? `${theme.colors.info}15` : `${theme.colors.success}15`,
                                  color: q.level === 4 ? theme.colors.danger : q.level === 3 ? theme.colors.warning : q.level === 2 ? theme.colors.info : theme.colors.success,
                                }}>
                                  {getLevelLabel(q.level)}
                                </span>
                              </td>
                              <td style={{ padding: "1rem 1.5rem", color: theme.colors.textSecondary }}>
                                {q.topic}
                              </td>
                              <td style={{ padding: "1rem 1.5rem", color: theme.colors.textSecondary }}>
                                {q.difficulty}
                              </td>
                              <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                                  <button
                                    onClick={() => handleOpenEdit(q)}
                                    style={{ padding: "0.4rem", borderRadius: "4px", border: `1px solid ${theme.colors.borderLight}`, background: "transparent", color: theme.colors.primary, cursor: "pointer" }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    style={{ padding: "0.4rem", borderRadius: "4px", border: `1px solid ${theme.colors.borderLight}`, background: "transparent", color: theme.colors.danger, cursor: "pointer" }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem" }}>
                    <button
                      onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "50%",
                        border: `1px solid ${theme.colors.borderLight}`,
                        backgroundColor: theme.colors.surfaceSecondary,
                        color: theme.colors.textPrimary,
                        cursor: page === 1 ? "not-allowed" : "pointer",
                        opacity: page === 1 ? 0.4 : 1,
                        display: "grid",
                        placeItems: "center"
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <span style={{ fontSize: "0.9rem", color: theme.colors.textSecondary }}>
                      Page {page} of {totalPages} ({totalQuestions} total questions)
                    </span>

                    <button
                      onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={page === totalPages}
                      style={{
                        padding: "0.5rem",
                        borderRadius: "50%",
                        border: `1px solid ${theme.colors.borderLight}`,
                        backgroundColor: theme.colors.surfaceSecondary,
                        color: theme.colors.textPrimary,
                        cursor: page === totalPages ? "not-allowed" : "pointer",
                        opacity: page === totalPages ? 0.4 : 1,
                        display: "grid",
                        placeItems: "center"
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* TAB 3: SYSTEM ANALYTICS */}
            {activeTab === "analytics" && (
              <div className="glass-panel" style={{ padding: isMobile ? '1rem' : '2rem', borderRadius: '1.25rem' }}>
                
                {/* Filters block */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: `1px solid ${theme.colors.borderLight}`, paddingBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem' }}>System Engagement & Usage Analytics</h2>
                    <p style={{ color: theme.colors.textSecondary, fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
                      Analyze platform features usage, active user logs, and trends by timeframe.
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', width: isMobile ? '100%' : 'auto' }}>
                    <div className="timeframe-buttons" style={{ display: 'flex', gap: '0.25rem', background: theme.colors.surfaceSecondary, padding: '0.25rem', borderRadius: '8px', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', maxWidth: '100%', minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
                      {["1d", "7d", "15d", "30d", "1y", "custom"].map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setTimeframe(tf)}
                          style={{
                            padding: '0.45rem 0.85rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: timeframe === tf ? theme.colors.primary : 'transparent',
                            color: timeframe === tf ? theme.colors.bgPrimary : theme.colors.textSecondary,
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            flexShrink: 0
                          }}
                        >
                          {tf === "custom" ? "Custom" : tf}
                        </button>
                      ))}
                    </div>
                    
                    {timeframe === "custom" && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: isMobile ? '0.5rem' : '0', width: isMobile ? '100%' : 'auto' }}>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.borderLight}`,
                            background: theme.colors.bgPrimary,
                            color: theme.colors.textPrimary,
                            flex: isMobile ? '1 1 120px' : 'none',
                            width: isMobile ? 'auto' : '140px'
                          }}
                        />
                        <span style={{ color: theme.colors.textTertiary, padding: isMobile ? '0 0.25rem' : '0' }}>to</span>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: `1px solid ${theme.colors.borderLight}`,
                            background: theme.colors.bgPrimary,
                            color: theme.colors.textPrimary,
                            flex: isMobile ? '1 1 120px' : 'none',
                            width: isMobile ? 'auto' : '140px'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {loadingAnalytics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem 0', gap: '1rem' }}>
                    <Loader2 className="spin-icon" size={32} color={theme.colors.primary} />
                    <span style={{ color: theme.colors.textSecondary }}>Aggregating system logs...</span>
                  </div>
                ) : !analyticsData ? (
                  <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <p style={{ color: theme.colors.textTertiary }}>No data available for the selected range.</p>
                  </div>
                ) : (
                  <div>
                    {/* Tiny aggregates */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', background: `${theme.colors.primary}05`, border: `1px solid ${theme.colors.primary}18` }}>
                        <div style={{ color: theme.colors.textSecondary, fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform Actions Logged</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '900', marginTop: '0.5rem', color: theme.colors.primary }}>
                          {analyticsData.total_actions}
                        </div>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: theme.colors.textTertiary }}>
                          Total user interactions (clicks, practice logs, mock tests) recorded.
                        </p>
                      </div>
                      
                      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', background: `${theme.colors.success}05`, border: `1px solid ${theme.colors.success}18` }}>
                        <div style={{ color: theme.colors.textSecondary, fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unique Active Users</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '900', marginTop: '0.5rem', color: theme.colors.success }}>
                          {analyticsData.active_users}
                        </div>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: theme.colors.textTertiary }}>
                          Unique individuals who interacted with the platform during this period.
                        </p>
                      </div>
                    </div>

                    {/* Chart Row 1: Daily Trends */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', marginBottom: '2rem', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Platform Engagement Trend (Daily Interactions)</h3>
                        <button
                          type="button"
                          onClick={() => setZoomedChartId("daily_trends")}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: `1px solid ${theme.colors.borderLight}`,
                            borderRadius: '6px',
                            padding: '0.35rem',
                            color: theme.colors.textSecondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <LineChart data={analyticsData.daily_trends} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                            <XAxis dataKey="date" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                            <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                background: theme.colors.surfacePrimary,
                                border: `1px solid ${theme.colors.borderLight}`,
                                borderRadius: '8px',
                                color: theme.colors.textPrimary
                              }}
                            />
                            <Line type="monotone" dataKey="actions" name="Interactions" stroke={theme.colors.primary} strokeWidth={3} activeDot={{ r: 8 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Chart Row 2: Features vs Breakdowns */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                      
                      {/* Most Used Features */}
                      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Feature Popularity (Usage Share)</h3>
                          <button
                            type="button"
                            onClick={() => setZoomedChartId("most_used_features")}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: `1px solid ${theme.colors.borderLight}`,
                              borderRadius: '6px',
                              padding: '0.35rem',
                              color: theme.colors.textSecondary,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                        <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {analyticsData.most_used_features.length === 0 ? (
                            <p style={{ color: theme.colors.textTertiary }}>No feature usage logged.</p>
                          ) : (
                            <ResponsiveContainer>
                              <BarChart data={analyticsData.most_used_features} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} horizontal={false} />
                                <XAxis type="number" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                <YAxis dataKey="feature" type="category" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} width={120} />
                                <Tooltip
                                  contentStyle={{
                                    background: theme.colors.surfacePrimary,
                                    border: `1px solid ${theme.colors.borderLight}`,
                                    borderRadius: '8px',
                                    color: theme.colors.textPrimary
                                  }}
                                />
                                <Bar dataKey="count" name="Clicks/Uses" radius={[0, 4, 4, 0]}>
                                  {analyticsData.most_used_features.map((entry, index) => {
                                    const colors = [theme.colors.primary, theme.colors.info, theme.colors.success, theme.colors.warning, '#8b5cf6', '#ec4899'];
                                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>

                      {/* User Activity Breakdown */}
                      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Detailed Actions Breakdown</h3>
                          <button
                            type="button"
                            onClick={() => setZoomedChartId("actions_breakdown")}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: `1px solid ${theme.colors.borderLight}`,
                              borderRadius: '6px',
                              padding: '0.35rem',
                              color: theme.colors.textSecondary,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                        <div style={{ width: '100%', height: 260 }}>
                          {analyticsData.actions_breakdown.length === 0 ? (
                            <p style={{ color: theme.colors.textTertiary }}>No actions recorded.</p>
                          ) : (
                            <ResponsiveContainer>
                              <BarChart data={analyticsData.actions_breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                                <XAxis dataKey="action" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                <Tooltip
                                  contentStyle={{
                                    background: theme.colors.surfacePrimary,
                                    border: `1px solid ${theme.colors.borderLight}`,
                                    borderRadius: '8px',
                                    color: theme.colors.textPrimary
                                  }}
                                />
                                <Bar dataKey="count" name="Interactions" fill={theme.colors.success} radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Top Active Users Grid */}
                    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem' }}>
                      <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: '700' }}>Top Active Users (Engagement Volume)</h3>
                      {analyticsData.top_users.length === 0 ? (
                        <p style={{ color: theme.colors.textTertiary, margin: 0 }}>No active user records.</p>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${theme.colors.borderLight}`, color: theme.colors.textTertiary, fontSize: '0.85rem' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Username / Profile</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Operations Logged</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyticsData.top_users.map((u, idx) => (
                                <tr key={u.username} style={{ borderBottom: idx < analyticsData.top_users.length - 1 ? `1px solid ${theme.colors.borderLight}` : 'none' }}>
                                  <td style={{ padding: '0.75rem 1rem', fontWeight: '800', color: theme.colors.primary }}>#{idx + 1}</td>
                                  <td style={{ padding: '0.75rem 1rem', fontWeight: '700' }}>{u.username}</td>
                                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800' }}>{u.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Demographics & Academic Performance Analytics */}
                    <div style={{ marginTop: '2.5rem' }}>
                      <h2 style={{ margin: '0 0 1.5rem 0', fontWeight: 800, fontSize: '1.25rem', color: theme.colors.primary, borderBottom: `1px solid ${theme.colors.borderLight}`, paddingBottom: '0.75rem' }}>
                        Demographics & Placement Performance Cross-Analysis
                      </h2>

                      {/* Row 1: Gender & Degree distribution */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* User Distribution by Degree */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Candidate Degree Breakdown</h3>
                            <button
                              type="button"
                              onClick={() => setZoomedChartId("degree_breakdown")}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: `1px solid ${theme.colors.borderLight}`,
                                borderRadius: '6px',
                                padding: '0.35rem',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Maximize2 size={14} />
                            </button>
                          </div>
                          <div style={{ width: '100%', height: 260 }}>
                            {!analyticsData.degree_distribution || analyticsData.degree_distribution.length === 0 ? (
                              <p style={{ color: theme.colors.textTertiary }}>No degree data recorded.</p>
                            ) : (
                              <ResponsiveContainer>
                                <BarChart data={analyticsData.degree_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                                  <XAxis dataKey="degree" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <Tooltip
                                    contentStyle={{
                                      background: theme.colors.surfacePrimary,
                                      border: `1px solid ${theme.colors.borderLight}`,
                                      borderRadius: '8px',
                                      color: theme.colors.textPrimary
                                    }}
                                  />
                                  <Bar dataKey="count" name="Candidates" fill={theme.colors.primary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>

                        {/* User Distribution by Gender */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Gender Diversity Breakdown</h3>
                            <button
                              type="button"
                              onClick={() => setZoomedChartId("gender_breakdown")}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: `1px solid ${theme.colors.borderLight}`,
                                borderRadius: '6px',
                                padding: '0.35rem',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Maximize2 size={14} />
                            </button>
                          </div>
                          <div style={{ width: '100%', height: 260 }}>
                            {!analyticsData.gender_distribution || analyticsData.gender_distribution.length === 0 ? (
                              <p style={{ color: theme.colors.textTertiary }}>No gender data recorded.</p>
                            ) : (
                              <ResponsiveContainer>
                                <BarChart data={analyticsData.gender_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                                  <XAxis dataKey="gender" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <Tooltip
                                    contentStyle={{
                                      background: theme.colors.surfacePrimary,
                                      border: `1px solid ${theme.colors.borderLight}`,
                                      borderRadius: '8px',
                                      color: theme.colors.textPrimary
                                    }}
                                  />
                                  <Bar dataKey="count" name="Candidates" fill={theme.colors.info} radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Skills and performance by degree */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Top Skills Distribution */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Candidate Core Skills Frequency</h3>
                            <button
                              type="button"
                              onClick={() => setZoomedChartId("skills_frequency")}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: `1px solid ${theme.colors.borderLight}`,
                                borderRadius: '6px',
                                padding: '0.35rem',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Maximize2 size={14} />
                            </button>
                          </div>
                          <div style={{ width: '100%', height: 260 }}>
                            {!analyticsData.skills_distribution || analyticsData.skills_distribution.length === 0 ? (
                              <p style={{ color: theme.colors.textTertiary }}>No skills data recorded. Ask candidates to update profiles.</p>
                            ) : (
                              <ResponsiveContainer>
                                <BarChart data={analyticsData.skills_distribution} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} horizontal={false} />
                                  <XAxis type="number" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <YAxis dataKey="skill" type="category" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} width={80} />
                                  <Tooltip
                                    contentStyle={{
                                      background: theme.colors.surfacePrimary,
                                      border: `1px solid ${theme.colors.borderLight}`,
                                      borderRadius: '8px',
                                      color: theme.colors.textPrimary
                                    }}
                                  />
                                  <Bar dataKey="count" name="Candidates with Skill" fill={theme.colors.success} radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>

                        {/* Performance Comparisons */}
                        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1.25rem', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Average Score by Academic Degree</h3>
                            <button
                              type="button"
                              onClick={() => setZoomedChartId("score_by_degree")}
                              style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: `1px solid ${theme.colors.borderLight}`,
                                borderRadius: '6px',
                                padding: '0.35rem',
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Maximize2 size={14} />
                            </button>
                          </div>
                          <div style={{ width: '100%', height: 260 }}>
                            {(!analyticsData.aptitude_by_degree || analyticsData.aptitude_by_degree.length === 0) &&
                            (!analyticsData.interview_by_degree || analyticsData.interview_by_degree.length === 0) ? (
                              <p style={{ color: theme.colors.textTertiary }}>No attempt/performance data recorded for degrees yet.</p>
                            ) : (
                              <ResponsiveContainer>
                                <BarChart 
                                  data={
                                    // Merge degree scores for visual comparison
                                    (() => {
                                      const degrees = new Set([
                                        ...analyticsData.aptitude_by_degree.map(d => d.degree),
                                        ...analyticsData.interview_by_degree.map(d => d.degree)
                                      ]);
                                      return Array.from(degrees).map(deg => {
                                        const apt = analyticsData.aptitude_by_degree.find(d => d.degree === deg);
                                        const int = analyticsData.interview_by_degree.find(d => d.degree === deg);
                                        return {
                                          degree: deg,
                                          "Aptitude (%)": apt ? apt.avg_accuracy : null,
                                          "Interview (%)": int ? int.avg_score : null
                                        };
                                      });
                                    })()
                                  } 
                                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                                  <XAxis dataKey="degree" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                                  <Tooltip
                                    contentStyle={{
                                      background: theme.colors.surfacePrimary,
                                      border: `1px solid ${theme.colors.borderLight}`,
                                      borderRadius: '8px',
                                      color: theme.colors.textPrimary
                                    }}
                                  />
                                  <Bar dataKey="Aptitude (%)" fill={theme.colors.warning} radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="Interview (%)" fill={theme.colors.primary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

          </>
        )}

      </div>

      {/* ADD / EDIT QUESTION MODAL */}
      {showAddEditModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "2rem"
        }}>
          <form 
            onSubmit={handleSaveQuestion}
            className="glass-panel animate-fade-in" 
            style={{
              width: "100%",
              maxWidth: "640px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "1.5rem",
              background: theme.colors.surfacePrimary,
              border: `1px solid ${theme.colors.borderLight}`,
              padding: "2rem"
            }}
          >
            <h2 style={{ fontSize: "1.35rem", fontWeight: "900", margin: "0 0 1.5rem" }}>
              {editingQuestion ? "Edit Question" : "Add New Question"}
            </h2>

            {modalError && (
              <div className="auth-alert auth-alert-error" style={{ marginBottom: "1.25rem" }}>
                <AlertCircle size={16} />
                {modalError}
              </div>
            )}

            {/* Form Fields */}
            <div style={{ display: "grid", gap: "1rem" }}>
              
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Question Text</label>
                <textarea
                  value={modalFormData.question}
                  onChange={(e) => setModalFormData({ ...modalFormData, question: e.target.value })}
                  rows="3"
                  required
                  style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem", resize: "vertical" }}
                />
              </div>

              {/* Options */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Option A</label>
                  <input
                    type="text"
                    value={modalFormData.optionA}
                    onChange={(e) => setModalFormData({ ...modalFormData, optionA: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Option B</label>
                  <input
                    type="text"
                    value={modalFormData.optionB}
                    onChange={(e) => setModalFormData({ ...modalFormData, optionB: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Option C</label>
                  <input
                    type="text"
                    value={modalFormData.optionC}
                    onChange={(e) => setModalFormData({ ...modalFormData, optionC: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Option D</label>
                  <input
                    type="text"
                    value={modalFormData.optionD}
                    onChange={(e) => setModalFormData({ ...modalFormData, optionD: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
              </div>

              {/* Correct answer & Explanation */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Correct Answer Value</label>
                  <select
                    value={modalFormData.correctAnswer}
                    onChange={(e) => setModalFormData({ ...modalFormData, correctAnswer: e.target.value })}
                    required
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem", cursor: "pointer" }}
                  >
                    <option value="">Select Option</option>
                    {modalFormData.optionA && <option value={modalFormData.optionA}>{modalFormData.optionA} (Option A)</option>}
                    {modalFormData.optionB && <option value={modalFormData.optionB}>{modalFormData.optionB} (Option B)</option>}
                    {modalFormData.optionC && <option value={modalFormData.optionC}>{modalFormData.optionC} (Option C)</option>}
                    {modalFormData.optionD && <option value={modalFormData.optionD}>{modalFormData.optionD} (Option D)</option>}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Difficulty</label>
                  <select
                    value={modalFormData.difficulty}
                    onChange={(e) => setModalFormData({ ...modalFormData, difficulty: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem", cursor: "pointer" }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Answer Explanation</label>
                <textarea
                  value={modalFormData.explanation}
                  onChange={(e) => setModalFormData({ ...modalFormData, explanation: e.target.value })}
                  rows="2"
                  style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem", resize: "vertical" }}
                />
              </div>

              {/* Category, Level, Topic */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Category</label>
                  <select
                    value={modalFormData.category}
                    onChange={(e) => setModalFormData({ ...modalFormData, category: e.target.value })}
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem", cursor: "pointer" }}
                  >
                    {Object.entries(categories).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Learning Level</label>
                  <select
                    value={modalFormData.level}
                    onChange={(e) => setModalFormData({ ...modalFormData, level: parseInt(e.target.value) })}
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem", cursor: "pointer" }}
                  >
                    <option value="1">Basic</option>
                    <option value="2">Intermediate</option>
                    <option value="3">Advanced</option>
                    <option value="4">Expert</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "700", marginBottom: "0.35rem", color: theme.colors.textTertiary }}>Topic / Concept</label>
                  <input
                    type="text"
                    value={modalFormData.topic}
                    onChange={(e) => setModalFormData({ ...modalFormData, topic: e.target.value })}
                    placeholder="e.g. Percentages"
                    style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: theme.colors.surfaceSecondary, color: theme.colors.textPrimary, outline: "none", fontSize: "0.9rem" }}
                  />
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "2rem" }}>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                style={{ padding: "0.65rem 1.25rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: "transparent", color: theme.colors.textSecondary, fontWeight: "700", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: "0.65rem 1.5rem", borderRadius: "8px", border: "none", backgroundColor: theme.colors.primary, color: theme.colors.bgPrimary, fontWeight: "800", cursor: "pointer" }}
              >
                Save Question
              </button>
            </div>

          </form>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showImportModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "2rem"
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: "100%",
            maxWidth: "540px",
            maxHeight: "85vh",
            borderRadius: "1.5rem",
            background: theme.colors.surfacePrimary,
            border: `1px solid ${theme.colors.borderLight}`,
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: "900", margin: 0 }}>
                Bulk CSV Upload
              </h2>
              <button 
                onClick={() => setShowImportModal(false)}
                style={{ background: "transparent", border: "none", color: theme.colors.textSecondary, cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Upload form */}
            <form onSubmit={handleImportCSV} style={{ display: "grid", gap: "1.5rem" }}>
              <div style={{
                padding: "2rem",
                borderRadius: "12px",
                border: `2px dashed ${theme.colors.borderLight}`,
                textAlign: "center",
                backgroundColor: `${theme.colors.surfaceSecondary}30`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem"
              }}>
                <Upload size={32} color={theme.colors.primary} />
                <div>
                  <label htmlFor="csv-file" style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    backgroundColor: theme.colors.surfaceSecondary,
                    border: `1px solid ${theme.colors.borderLight}`,
                    fontSize: "0.85rem",
                    fontWeight: "700",
                    cursor: "pointer",
                    display: "inline-block",
                    marginBottom: "0.5rem"
                  }}>
                    Select CSV File
                  </label>
                  <input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files[0])}
                    style={{ display: "none" }}
                  />
                  <p style={{ margin: 0, fontSize: "0.85rem", color: theme.colors.textSecondary }}>
                    {importFile ? importFile.name : "Supported columns: question, optionA, optionB, optionC, optionD, correctAnswer, explanation, category, level, topic, difficulty"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  style={{ padding: "0.6rem 1.25rem", borderRadius: "8px", border: `1px solid ${theme.colors.borderLight}`, backgroundColor: "transparent", color: theme.colors.textSecondary, fontWeight: "700", cursor: "pointer" }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importLoading || !importFile}
                  style={{
                    padding: "0.6rem 1.5rem",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.bgPrimary,
                    fontWeight: "800",
                    cursor: importFile ? "pointer" : "not-allowed",
                    opacity: importFile ? 1 : 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                >
                  {importLoading && <Loader2 size={14} className="spin-icon" />}
                  Import Questions
                </button>
              </div>
            </form>

            {/* Import results summary report */}
            {importSummary && (
              <div style={{ marginTop: "1.5rem", borderTop: `1px solid ${theme.colors.borderLight}`, paddingTop: "1.5rem", overflowY: "auto", flex: "1" }}>
                <h4 style={{ margin: "0 0 1rem", fontWeight: "800", fontSize: "0.95rem" }}>Import Summary Report</h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ padding: "0.75rem", borderRadius: "6px", backgroundColor: `${theme.colors.success}10`, border: `1px solid ${theme.colors.success}20`, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <CheckCircle2 size={16} color={theme.colors.success} />
                    <div>
                      <div style={{ fontSize: "0.75rem", color: theme.colors.textSecondary }}>Imported Successfully</div>
                      <strong style={{ color: theme.colors.success }}>{importSummary.imported} questions</strong>
                    </div>
                  </div>
                  
                  <div style={{ padding: "0.75rem", borderRadius: "6px", backgroundColor: `${theme.colors.danger}10`, border: `1px solid ${theme.colors.danger}20`, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <XCircle size={16} color={theme.colors.danger} />
                    <div>
                      <div style={{ fontSize: "0.75rem", color: theme.colors.textSecondary }}>Failed / Rejected</div>
                      <strong style={{ color: theme.colors.danger }}>{importSummary.failed} questions</strong>
                    </div>
                  </div>
                </div>

                {importSummary.errors?.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.8rem", color: theme.colors.warning, fontWeight: "700", display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.5rem" }}>
                      <AlertTriangle size={14} />
                      Validation Warnings & Errors ({importSummary.errors.length})
                    </div>
                    <div style={{ 
                      maxHeight: "150px", 
                      overflowY: "auto", 
                      fontSize: "0.8rem", 
                      padding: "0.75rem", 
                      borderRadius: "6px", 
                      backgroundColor: `${theme.colors.surfaceSecondary}50`, 
                      border: `1px solid ${theme.colors.borderLight}`,
                      color: theme.colors.textSecondary,
                      fontFamily: "monospace",
                      display: "grid",
                      gap: "0.25rem"
                    }}>
                      {importSummary.errors.map((err, idx) => (
                        <div key={idx} style={{ color: theme.colors.danger }}>• {err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {zoomedChartId && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(3,0,20,0.88)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: isMobile ? "1rem" : "2rem"
        }}>
          <div 
            className="glass-panel animate-fade-in" 
            style={{
              width: "100%",
              maxWidth: "1000px",
              height: isMobile ? "80vh" : "75vh",
              display: "flex",
              flexDirection: "column",
              borderRadius: "1.5rem",
              background: theme.colors.surfacePrimary,
              border: `1px solid ${theme.colors.borderLight}`,
              padding: isMobile ? "1.5rem 1rem" : "2rem",
              position: "relative",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setZoomedChartId(null)}
              style={{
                position: "absolute",
                top: isMobile ? "1rem" : "1.5rem",
                right: isMobile ? "1rem" : "1.5rem",
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${theme.colors.borderLight}`,
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                color: theme.colors.textPrimary,
                cursor: "pointer",
                zIndex: 10
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Title */}
            <h2 style={{ fontSize: isMobile ? "1.1rem" : "1.35rem", fontWeight: "900", margin: "0 0 2rem", paddingRight: "3rem" }}>
              {zoomedChartId === 'daily_trends' && 'Platform Engagement Trend (Daily Interactions)'}
              {zoomedChartId === 'most_used_features' && 'Feature Popularity (Usage Share)'}
              {zoomedChartId === 'actions_breakdown' && 'Detailed Actions Breakdown'}
              {zoomedChartId === 'degree_breakdown' && 'Candidate Degree Breakdown'}
              {zoomedChartId === 'gender_breakdown' && 'Gender Diversity Breakdown'}
              {zoomedChartId === 'skills_frequency' && 'Candidate Core Skills Frequency'}
              {zoomedChartId === 'score_by_degree' && 'Average Score by Academic Degree'}
            </h2>

            {/* Modal Chart Container */}
            <div style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                {zoomedChartId === 'daily_trends' && (
                  <LineChart data={analyticsData.daily_trends} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                    <XAxis dataKey="date" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Line type="monotone" dataKey="actions" name="Interactions" stroke={theme.colors.primary} strokeWidth={3.5} activeDot={{ r: 8 }} />
                  </LineChart>
                )}

                {zoomedChartId === 'most_used_features' && (
                  <BarChart data={analyticsData.most_used_features} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} horizontal={false} />
                    <XAxis type="number" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis dataKey="feature" type="category" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} width={130} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Bar dataKey="count" name="Clicks/Uses" radius={[0, 4, 4, 0]}>
                      {analyticsData.most_used_features.map((entry, index) => {
                        const colors = [theme.colors.primary, theme.colors.info, theme.colors.success, theme.colors.warning, '#8b5cf6', '#ec4899'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                )}

                {zoomedChartId === 'actions_breakdown' && (
                  <BarChart data={analyticsData.actions_breakdown} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                    <XAxis dataKey="action" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Bar dataKey="count" name="Interactions" fill={theme.colors.success} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}

                {zoomedChartId === 'degree_breakdown' && (
                  <BarChart data={analyticsData.degree_distribution} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                    <XAxis dataKey="degree" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Bar dataKey="count" name="Candidates" fill={theme.colors.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}

                {zoomedChartId === 'gender_breakdown' && (
                  <BarChart data={analyticsData.gender_distribution} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                    <XAxis dataKey="gender" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Bar dataKey="count" name="Candidates" fill={theme.colors.info} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}

                {zoomedChartId === 'skills_frequency' && (
                  <BarChart data={analyticsData.skills_distribution} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} horizontal={false} />
                    <XAxis type="number" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis dataKey="skill" type="category" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Bar dataKey="count" name="Candidates with Skill" fill={theme.colors.success} radius={[0, 4, 4, 0]} />
                  </BarChart>
                )}

                {zoomedChartId === 'score_by_degree' && (
                  <BarChart 
                    data={
                      (() => {
                        const degrees = new Set([
                          ...analyticsData.aptitude_by_degree.map(d => d.degree),
                          ...analyticsData.interview_by_degree.map(d => d.degree)
                        ]);
                        return Array.from(degrees).map(deg => {
                          const apt = analyticsData.aptitude_by_degree.find(d => d.degree === deg);
                          const int = analyticsData.interview_by_degree.find(d => d.degree === deg);
                          return {
                            degree: deg,
                            "Aptitude (%)": apt ? apt.avg_accuracy : null,
                            "Interview (%)": int ? int.avg_score : null
                          };
                        });
                      })()
                    } 
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.borderLight} />
                    <XAxis dataKey="degree" stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <YAxis stroke={theme.colors.textTertiary} style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: theme.colors.surfacePrimary, border: `1px solid ${theme.colors.borderLight}`, borderRadius: '8px', color: theme.colors.textPrimary }} />
                    <Bar dataKey="Aptitude (%)" fill={theme.colors.warning} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Interview (%)" fill={theme.colors.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}
