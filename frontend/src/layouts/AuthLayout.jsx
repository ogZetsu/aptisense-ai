import React from 'react';
import { ArrowLeft, Brain } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { BackgroundFX } from '../components/BackgroundFX';
import { Footer } from '../components/Footer';

export function AuthLayout({ children, title, subtitle, onNavigate }) {
  const { theme } = useTheme();

  return (
    <div
      className="auth-layout"
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

      <header className="auth-header">
        <button type="button" className="nav-hover-btn auth-back-btn" onClick={() => onNavigate?.('home')}>
          <ArrowLeft size={16} />
          Back to Home
        </button>
        <button type="button" className="auth-brand" onClick={() => onNavigate?.('home')}>
          <Brain size={20} color={theme.colors.primary} />
          <span className="text-gradient-neon" style={{ fontWeight: 900 }}>AptiSense AI</span>
        </button>
      </header>

      <main className="auth-main">
        <div className="auth-card glass-panel">
          <div className="auth-card-header">
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{title}</h1>
            {subtitle && (
              <p style={{ color: theme.colors.textSecondary, margin: '0.5rem 0 0', fontSize: theme.fonts.size.sm }}>
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
