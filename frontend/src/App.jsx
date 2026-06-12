import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { InterviewProvider } from './contexts/InterviewContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import HistoryPage from './pages/History';
import InterviewPage from './pages/Interview';
import InterviewTypesPage from './pages/InterviewTypes';
import MockInterviewPage from './pages/MockInterview';
import AptitudeTestPage from './pages/AptitudeTest';
import DashboardPage from './pages/Dashboard';
import ResultsPage from './pages/Results';
import ProfilePage from './pages/Profile';
import AdminPanelPage from './pages/AdminPanel';
import AptitudeAttemptsPage from './pages/AptitudeAttempts';

import { AppErrorBoundary } from './components/AppErrorBoundary';

function AppShell() {
  const [sessionId, setSessionId] = useState(null);
  const { currentUser, isLoading, login, logout } = useAuth();

  const [currentView, setCurrentView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page');

      const allowedViews = [
        'home',
        'interview',
        'interview-types',
        'mock-interview',
        'aptitude-test',
        'analysis-dashboard',
        'results',
        'login',
        'signup',
        'history',
        'profile',
        'admin',
        'previous-attempts'
      ];

      return allowedViews.includes(page) ? page : 'home';
    } catch (e) {
      return 'home';
    }
  });

  const handleLogout = () => {
    logout();
    setCurrentView('home');
  };

  const handleLoginSuccess = (user, token) => {
    login(user, token);
    setCurrentView('home');
  };

  const updateUrl = (page, nextSessionId = null, from = null) => {
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      if (nextSessionId) {
        params.set('session_id', nextSessionId);
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ view: page, sessionId: nextSessionId, from }, '', newUrl);
    } catch (e) {
      console.warn('[App] Failed to update navigation URL:', e);
    }
  };

  const handleNavigate = (view, options = {}) => {
    const route = typeof view === 'object' && view !== null ? view.view : view;
    const nextSessionId = typeof view === 'object' && view !== null ? view.sessionId : options.sessionId;
    const fromView = currentView || 'home';

    setSessionId(nextSessionId || null);

    try {
      window.__lastNavigate = route;
    } catch (e) {}
    setCurrentView(route);
    updateUrl(route, nextSessionId, fromView);
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const querySessionId = params.get('session_id');
      if (querySessionId) {
        setSessionId(querySessionId);
      }
    } catch (e) {
      // ignore invalid URL search params
    }
  }, []);

  const handleSessionCreated = (nextSessionId) => {
    setSessionId(nextSessionId);
  };

  const handleInterviewComplete = (nextSessionId) => {
    if (nextSessionId) {
      setSessionId(nextSessionId);
      try {
        localStorage.setItem('aptisense.openSession', nextSessionId);
      } catch (e) {
        console.warn('[App] Failed to persist session:', e);
      }
      handleNavigate('results', { sessionId: nextSessionId });
    } else {
      handleNavigate('results');
    }
  };

  // ROUTING

  if (currentView === 'interview') {
    return (
      <InterviewPage
        onNavigate={handleNavigate}
        onSessionCreated={handleSessionCreated}
        onComplete={handleInterviewComplete}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'interview-types') {
    return (
      <InterviewTypesPage
        onNavigate={handleNavigate}
        onComplete={handleInterviewComplete}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'mock-interview') {
    return (
      <MockInterviewPage
        onNavigate={handleNavigate}
        onComplete={handleInterviewComplete}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'aptitude-test') {
    return (
      <AptitudeTestPage
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'analysis-dashboard') {
    return (
      <DashboardPage
        onNavigate={handleNavigate}
        sessionId={sessionId}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'results') {
    return (
      <ResultsPage
        sessionId={sessionId}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        isAuthLoading={isLoading}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'history') {
    return (
      <HistoryPage
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'previous-attempts') {
    return (
      <AptitudeAttemptsPage
        sessionId={sessionId}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'login') {
    return (
      <LoginPage
        onNavigate={handleNavigate}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (currentView === 'signup') {
    return (
      <SignupPage
        onNavigate={handleNavigate}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (currentView === 'profile') {
    return (
      <ProfilePage
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (currentView === 'admin') {
    return (
      <AdminPanelPage
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <HomePage
      onNavigate={handleNavigate}
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <InterviewProvider>
            <AppShell />
          </InterviewProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}