/**
 * API client for backend communication
 */
import axios from 'axios';

const RAW_API_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.REACT_APP_API_URL ||
  'http://127.0.0.1:8000';

const ROOT_API_URL = RAW_API_URL.replace(/\/+$/, '');
const API_BASE_URL = ROOT_API_URL.endsWith('/api/v1') ? ROOT_API_URL : `${ROOT_API_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

const AUTH_TOKEN_KEY = 'aptisense.token';

export function setAuthToken(token) {
  if (!token) {
    return;
  }
  const normalized = typeof token === 'string' ? token : (token.access_token || token.token || '');
  if (!normalized) {
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, normalized);
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Attach Authorization header when token is present in localStorage
apiClient.interceptors.request.use((config) => {
  try {
    const token = getAuthToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Interview endpoints
export const interviewAPI = {
  start: (data) => apiClient.post('/interview/start', data),
  submitAnswer: (data) => apiClient.post('/interview/answer', data),
  getNextQuestion: (sessionId) => apiClient.get(`/interview/next-question/${sessionId}`),
  endInterview: (sessionId) => apiClient.post(`/interview/end/${sessionId}`),
  getReport: (sessionId) => apiClient.get(`/interview/report/${sessionId}`),
  getStatus: (sessionId) => apiClient.get(`/interview/status/${sessionId}`),
  checkHealth: (sessionId) => apiClient.get(`/interview/health/${sessionId}`),
};

// Proctoring endpoints
export const proctoringAPI = {
  analyzeFrame: (sessionId, data) => apiClient.post(`/proctoring/analyze-frame/${sessionId}`, data),
  getIntegrityScore: (sessionId) => apiClient.get(`/proctoring/integrity-score/${sessionId}`),
  getBriefSummary: (sessionId) => apiClient.get(`/proctoring/brief-summary/${sessionId}`),
  flagSuspiciousActivity: (sessionId, data) => apiClient.post(`/proctoring/flag-suspicious/${sessionId}`, data),
};

// Compute an explicit base for aptitude routes that always targets the
// application root (strip any trailing /api/v1 if present). This prevents
// accidental requests to e.g. /api/v1/aptitude/... when the backend exposes
// /aptitude/... at the root.
const APTITUDE_BASE = API_BASE_URL.replace(/\/api\/v1$/, "") || ROOT_API_URL;

export const aptitudeAPI = {
  // Aptitude routes live at the application root, not under /api/v1.
  getQuestions: (category) => apiClient.get(`${APTITUDE_BASE}/aptitude/${category}`),
  submitAttempt: (data) => apiClient.post(`${APTITUDE_BASE}/aptitude/submit`, data),
  getAttempt: (attemptId) => apiClient.get(`${APTITUDE_BASE}/aptitude/attempt/${attemptId}`),
  getCategories: () => apiClient.get(`${APTITUDE_BASE}/aptitude/categories`),
  getSets: (category, level) => apiClient.get(`${APTITUDE_BASE}/aptitude/${category}/sets`, { params: { level } }),
  getSetQuestions: (category, setNumber, level) => apiClient.get(`${APTITUDE_BASE}/aptitude/${category}/set/${setNumber}`, { params: { level } }),
  saveProgress: (data) => apiClient.post(`${APTITUDE_BASE}/aptitude/progress/save`, data),
  getProgress: (category, level) => apiClient.get(`${APTITUDE_BASE}/aptitude/progress/${category}`, { params: { level } }),
  getAttempts: () => apiClient.get(`${APTITUDE_BASE}/aptitude/attempts`),
  getAnalytics: () => apiClient.get(`${APTITUDE_BASE}/aptitude/analytics`),
};

export const authAPI = {
  signup: (data) => apiClient.post('/auth/signup', data),
  login: (data) => apiClient.post('/auth/login', data),
  googleLogin: (data) => apiClient.post('/auth/google', data),
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.patch('/auth/profile', data),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
};

export const adminAPI = {
  getStats: () => apiClient.get('/admin/stats'),
  getUsers: () => apiClient.get('/admin/users'),
  updateUserRole: (userId, role) => apiClient.patch(`/admin/users/${userId}/role`, { role }),
  deleteUser: (userId) => apiClient.delete(`/admin/users/${userId}`),
  getQuestions: (params) => apiClient.get('/admin/questions', { params }),
  getQuestion: (id) => apiClient.get(`/admin/questions/${id}`),
  createQuestion: (data) => apiClient.post('/admin/questions', data),
  updateQuestion: (id, data) => apiClient.put(`/admin/questions/${id}`, data),
  deleteQuestion: (id) => apiClient.delete(`/admin/questions/${id}`),
  importQuestions: (formData) => apiClient.post('/admin/questions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  exportQuestionsUrl: () => `${API_BASE_URL}/admin/questions/export`,
  getAnalytics: (params) => apiClient.get('/admin/analytics', { params })
};

export async function signup(payload) {
  const res = await authAPI.signup(payload);
  return res.data;
}

export async function login(payload) {
  const res = await authAPI.login(payload);
  return res.data;
}

export async function loginWithGoogle(credential) {
  const res = await authAPI.googleLogin({ credential });
  return res.data;
}

export async function fetchCurrentUser() {
  const res = await authAPI.me();
  return res.data;
}

export async function updateProfile(payload) {
  const res = await authAPI.updateProfile(payload);
  return res.data;
}

export async function forgotPassword(email) {
  const res = await authAPI.forgotPassword(email);
  return res.data;
}

export async function resetPassword(payload) {
  const res = await authAPI.resetPassword(payload);
  return res.data;
}

export async function changePassword(payload) {
  const res = await authAPI.changePassword(payload);
  return res.data;
}

export async function getAdminStats() {
  const res = await adminAPI.getStats();
  return res.data;
}

export async function getAdminUsers() {
  const res = await adminAPI.getUsers();
  return res.data;
}

export async function updateUserRole(userId, role) {
  const res = await adminAPI.updateUserRole(userId, role);
  return res.data;
}

export async function deleteAdminUser(userId) {
  const res = await adminAPI.deleteUser(userId);
  return res.data;
}

export async function submitAptitudeAttempt(data) {
  const response = await aptitudeAPI.submitAttempt(data);
  return response.data;
}

export async function getAptitudeAttempt(attemptId) {
  const response = await aptitudeAPI.getAttempt(attemptId);
  return response.data;
}

export const analyticsAPI = {
  getSummary: (user_id) => apiClient.get(`/analytics/summary${user_id ? `?user_id=${encodeURIComponent(user_id)}` : ''}`),
  getSessions: (user_id) => apiClient.get(`/analytics/sessions${user_id ? `?user_id=${encodeURIComponent(user_id)}` : ''}`),
};

export async function getAnalyticsSummary(user_id = null) {
  const response = await analyticsAPI.getSummary(user_id || null);
  return response.data;
}

export async function getAnalyticsSessions(user_id = null) {
  const response = await analyticsAPI.getSessions(user_id || null);
  return response.data;
}


export async function getQuestions(category) {
  const response = await apiClient.get(`/questions/${category}`);

  return response.data;
}

export async function evaluateAnswer(payload) {
  const response = await apiClient.post('/evaluate', payload);
  return response.data;
}

export async function getAptitudeQuestions(category) {
  const response = await aptitudeAPI.getQuestions(category);
  return response.data;
}

export const chatbotAPI = {
  sendMessage: (messages) => apiClient.post('/chatbot/chat', { messages }),
};

export default apiClient;