import React from 'react';
import { Brain, Mail } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export function Footer({ onNavigate }) {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const year = new Date().getFullYear();

  const platformLinks = [
    { label: 'Interview Types', key: 'interview-types' },
    { label: 'Mock Interview', key: 'mock-interview' },
    { label: 'Aptitude Test', key: 'aptitude-test' },
    { label: 'AI Analysis', key: 'analysis-dashboard' },
  ];

  const accountLinks = currentUser
    ? [
        { label: 'My Profile', key: 'profile' },
        { label: 'Previous Attempts', key: 'previous-attempts' },
        { label: 'Interview History', key: 'history' },
      ]
    : [
        { label: 'Login', key: 'login' },
        { label: 'Sign Up', key: 'signup' },
      ];

  const footerCols = [
    { title: 'Platform', links: platformLinks },
    { title: 'Account', links: accountLinks },
  ];

  return (
    <footer
      className="site-footer"
      style={{
        borderTop: `1px solid ${theme.colors.borderLight}`,
        background: 'linear-gradient(to top, rgba(8, 6, 22, 0.95), rgba(13, 10, 36, 0.85))',
        backdropFilter: 'blur(16px)',
        marginTop: 'auto',
        padding: '3rem 0 1.5rem 0',
      }}
    >
      <div className="footer-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '3rem' }}>
        
        {/* Brand Info */}
        <div className="footer-brand" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="footer-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }} onClick={() => onNavigate?.('home')}>
            <Brain size={24} color={theme.colors.primary} />
            <span className="text-gradient-neon" style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              AptiSense AI
            </span>
          </div>
          <p style={{ color: theme.colors.textSecondary, fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '340px', margin: 0 }}>
            An advanced AI-powered placement preparation ecosystem. Elevate your potential with adaptive aptitude diagnostics, real-time proctored mock speaking interviews, and deep performance insights.
          </p>
          <div className="footer-social" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <a 
              href="mailto:support@aptisense.ai" 
              aria-label="Email support" 
              className="footer-social-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: `1px solid ${theme.colors.borderLight}`, color: theme.colors.textSecondary, transition: 'all 0.2s ease' }}
            >
              <Mail size={16} />
            </a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer" 
              aria-label="GitHub repository" 
              className="footer-social-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: `1px solid ${theme.colors.borderLight}`, color: theme.colors.textSecondary, transition: 'all 0.2s ease' }}
            >
              <GithubIcon />
            </a>
            <a 
              href="https://linkedin.com" 
              target="_blank" 
              rel="noreferrer" 
              aria-label="LinkedIn profile" 
              className="footer-social-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', border: `1px solid ${theme.colors.borderLight}`, color: theme.colors.textSecondary, transition: 'all 0.2s ease' }}
            >
              <LinkedinIcon />
            </a>
          </div>
        </div>

        {/* Dynamic Columns */}
        {footerCols.map((col) => (
          <div key={col.title} className="footer-col" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ color: theme.colors.textPrimary, fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              {col.title}
            </h4>
            <ul className="footer-link-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {col.links.map((link) => (
                <li key={link.key}>
                  <button 
                    type="button" 
                    className="footer-link" 
                    onClick={() => onNavigate?.(link.key)}
                    style={{ background: 'none', border: 'none', padding: 0, color: theme.colors.textSecondary, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left', transition: 'color 0.2s ease', fontWeight: 500 }}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Bottom Row */}
      <div 
        className="footer-bottom" 
        style={{ 
          maxWidth: '1200px', 
          margin: '2rem auto 0 auto', 
          padding: '1.5rem 2rem 0 2rem', 
          borderTop: `1px solid ${theme.colors.borderLight}`, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <span style={{ color: theme.colors.textSecondary, fontSize: '0.75rem' }}>
          © {year} AptiSense AI. All rights reserved.
        </span>
        
        {/* Systems Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
          All Systems Operational
        </div>

        <span style={{ color: theme.colors.textSecondary, fontSize: '0.75rem' }}>
          v2.0.0 · Recruitment Intelligence Platform
        </span>
      </div>
    </footer>
  );
}
