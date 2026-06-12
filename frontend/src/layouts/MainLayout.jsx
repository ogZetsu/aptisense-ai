import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Brain,
  ChevronDown,
  History,
  Home,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { BackgroundFX } from '../components/BackgroundFX';
import { Footer } from '../components/Footer';
import { clearAuthToken } from '../services/api';
import ChatbotWidget from '../components/ChatbotWidget';

const defaultNavItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'interview-types', label: 'Interview Types', icon: MessageSquareText },
  { key: 'mock-interview', label: 'Mock Interview', icon: Mic },
  { key: 'aptitude-test', label: 'Aptitude Test', icon: Brain },
  { key: 'previous-attempts', label: 'Previous Attempts', icon: History },
  { key: 'analysis-dashboard', label: 'AI Analysis', icon: BarChart3 },
  { key: 'history', label: 'Interview History', icon: History },
];

export function MainLayout({
  children,
  showSidebar = true,
  activeView,
  onNavigate,
  navItems = defaultNavItems,
  currentUser = null,
  onLogout,
}) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { theme } = useTheme();

  const isAdmin = currentUser?.role === 'admin';
  const displayNavItems = isAdmin
    ? [...navItems, { key: 'admin', label: 'Admin Panel', icon: Shield }]
    : navItems;

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setUserMenuOpen(false);
    onLogout?.();
    onNavigate?.('home');
  };

  const navigateTo = (key) => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
    onNavigate?.(key);
  };

  const initials = (currentUser?.full_name || currentUser?.username || currentUser?.email || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="app-shell"
      style={{
        backgroundColor: theme.colors.bgPrimary,
        color: theme.colors.textPrimary,
        fontFamily: theme.fonts.family.sans,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <BackgroundFX />

      {/* Top navigation bar */}
      <header className="top-nav">
        <div className="top-nav-left">
          {showSidebar && isMobile && (
            <button
              type="button"
              className="nav-icon-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>
          )}
          <button type="button" className="top-nav-brand" onClick={() => navigateTo('home')}>
            <span className="text-gradient-neon" style={{ fontWeight: 900, fontSize: '1.1rem' }}>
              AptiSense AI
            </span>
          </button>
        </div>

        {/* Desktop inline nav */}
        {!isMobile && (
          <nav className="top-nav-links" aria-label="Main navigation">
            {displayNavItems.slice(0, 5).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`top-nav-link${activeView === item.key ? ' is-active' : ''}`}
                onClick={() => navigateTo(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div className="top-nav-right">
          {currentUser ? (
            <div className="user-menu-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="user-menu-trigger nav-hover-btn"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <span className="user-avatar">{initials}</span>
                <span className="user-menu-name">{currentUser.full_name || currentUser.username}</span>
                <ChevronDown size={14} className={`user-menu-chevron${userMenuOpen ? ' is-open' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown glass-panel">
                  <div className="user-dropdown-header">
                    <strong>{currentUser.full_name || currentUser.username}</strong>
                    <span>{currentUser.email || 'No email linked'}</span>
                    {isAdmin && <span className="admin-badge">Admin</span>}
                  </div>
                  <button type="button" className="user-dropdown-item" onClick={() => navigateTo('profile')}>
                    <User size={15} /> My Profile
                  </button>
                  <button type="button" className="user-dropdown-item" onClick={() => navigateTo('history')}>
                    <History size={15} /> Interview History
                  </button>
                  <button type="button" className="user-dropdown-item" onClick={() => navigateTo('previous-attempts')}>
                    <Brain size={15} /> Previous Attempts
                  </button>
                  {isAdmin && (
                    <button type="button" className="user-dropdown-item" onClick={() => navigateTo('admin')}>
                      <Shield size={15} /> Admin Panel
                    </button>
                  )}
                  <div className="user-dropdown-divider" />
                  <button type="button" className="user-dropdown-item user-dropdown-danger" onClick={handleLogout}>
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-nav-actions">
              <button type="button" className="nav-hover-btn" onClick={() => navigateTo('login')}>
                Login
              </button>
              <button type="button" className="nav-primary-btn" onClick={() => navigateTo('signup')}>
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar (desktop always visible, mobile drawer) */}
        {showSidebar && isMobile && (
          <>
            <aside className={`app-sidebar${sidebarOpen ? ' is-open' : ''}${isMobile ? ' is-mobile' : ''}`} style={{ paddingTop: '0' }}>
              {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1rem 1rem', borderBottom: `1px solid rgba(255, 255, 255, 0.08)`, marginBottom: '1rem' }}>
                  <span className="text-gradient-neon" style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                    AptiSense AI
                  </span>
                  <button
                    type="button"
                    className="nav-icon-btn"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close menu"
                    style={{ width: 34, height: 34 }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <nav className="sidebar-nav" aria-label="Sidebar navigation">
                {displayNavItems.map((item) => (
                  <SidebarButton
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    active={activeView === item.key}
                    onClick={() => navigateTo(item.key)}
                  />
                ))}
              </nav>
            </aside>

            {isMobile && sidebarOpen && (
              <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
            )}
          </>
        )}

        <main className="app-main">{children}</main>
      </div>

      <Footer onNavigate={onNavigate} />
      <ChatbotWidget />
    </div>
  );
}

function SidebarButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`sidebar-btn${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}
