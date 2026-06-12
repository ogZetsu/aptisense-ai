import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { login as loginApi, forgotPassword, resetPassword } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function LoginPage({ onNavigate, onLoginSuccess }) {
  const { theme } = useTheme();
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot password states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1 = enter email, 2 = verify & enter new pass
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  // Common states
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginApi({ email: email.trim(), password });
      const token = res.access_token || res.token;
      const user = res.user || res;
      onLoginSuccess?.(user, token);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!forgotEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setResetStep(2);
      if (res.email_sent) {
        setSuccessMessage('Verification code has been sent to your email address!');
      } else {
        setSuccessMessage(`Verification code generated! (SMTP email is not configured in backend settings). For local testing, your code is: ${res.code}`);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to request password reset. Make sure this email is registered and does not use Google sign-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!resetCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        email: forgotEmail.trim(),
        code: resetCode.trim(),
        new_password: newPassword,
      });
      setSuccessMessage('Password reset successfully! You can now sign in.');
      setForgotMode(false);
      setResetStep(1);
      setEmail(forgotEmail);
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to reset password. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Timer effect
  React.useEffect(() => {
    if (!forgotMode || resetStep !== 2) return;
    
    setTimeLeft(600);
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoResend();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [forgotMode, resetStep]);

  const handleResendCode = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setTimeLeft(600);
      if (res.email_sent) {
        setSuccessMessage('New verification code sent to your email address!');
      } else {
        setSuccessMessage(`New code generated! (SMTP email is not configured). For local testing, code is: ${res.code}`);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoResend = async () => {
    setError(null);
    setSuccessMessage('Verification code expired! Automatically requesting a new code...');
    setLoading(true);
    try {
      const res = await forgotPassword(forgotEmail.trim());
      setTimeLeft(600);
      if (res.email_sent) {
        setSuccessMessage('A new verification code was automatically sent to your email address!');
      } else {
        setSuccessMessage(`New code generated automatically! For local testing, code is: ${res.code}`);
      }
    } catch (err) {
      setError('Verification code expired and automatic resend failed. Please click "Resend Code" manually.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGoogleSuccess = (user, token) => {
    onLoginSuccess?.(user, token);
  };

  return (
    <AuthLayout
      title={forgotMode ? 'Reset password' : 'Welcome back'}
      subtitle={
        forgotMode
          ? 'Enter your email address to recover your account.'
          : 'Sign in to continue your interview preparation journey.'
      }
      onNavigate={onNavigate}
    >
      {error && <div className="auth-alert auth-alert-error">{error}</div>}
      {successMessage && <div className="auth-alert auth-alert-success">{successMessage}</div>}

      {!forgotMode ? (
        /* LOGIN FORM */
        <>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-field">
              <span className="auth-label">Email address</span>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </label>

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input auth-input-with-toggle"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="auth-link-btn"
                style={{ fontSize: '0.85rem', fontWeight: 500 }}
                onClick={() => {
                  setForgotMode(true);
                  setResetStep(1);
                  setForgotEmail(email);
                  setError(null);
                  setSuccessMessage(null);
                }}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin-icon" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <GoogleSignInButton
            mode="continue_with"
            onSuccess={handleGoogleSuccess}
            onError={setError}
            disabled={loading}
          />

          <p className="auth-switch-text">
            Don&apos;t have an account?{' '}
            <button type="button" className="auth-link-btn" onClick={() => onNavigate?.('signup')}>
              Create account
            </button>
          </p>
        </>
      ) : (
        /* FORGOT PASSWORD FORM */
        <>
          {resetStep === 1 ? (
            <form className="auth-form" onSubmit={handleForgotSubmit}>
              <label className="auth-field">
                <span className="auth-label">Email address</span>
                <div className="auth-input-wrap">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </label>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin-icon" /> Requesting code...</> : 'Get Verification Code'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleResetSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.65rem 1rem', borderRadius: '8px', border: `1px solid ${theme.colors.borderLight}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: theme.colors.textSecondary }}>Code Expires In:</span>
                  <span style={{ fontWeight: '800', color: timeLeft < 60 ? '#f43f5e' : theme.colors.primary, fontFamily: 'monospace', fontSize: '0.95rem' }}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <button
                  type="button"
                  className="auth-link-btn"
                  style={{ fontSize: '0.85rem', fontWeight: 600 }}
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Resend Code
                </button>
              </div>

              <label className="auth-field">
                <span className="auth-label">Verification Code</span>
                <div className="auth-input-wrap">
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Enter 6-digit code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    disabled={loading}
                    maxLength={6}
                    required
                  />
                </div>
              </label>

              <label className="auth-field">
                <span className="auth-label">New Password</span>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="auth-input auth-input-with-toggle"
                    placeholder="Enter new password (min. 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-password"
                    onClick={() => setShowNewPassword((v) => !v)}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="auth-field">
                <span className="auth-label">Confirm New Password</span>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="auth-input"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </label>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin-icon" /> Resetting...</> : 'Reset Password'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="auth-link-btn"
              style={{ fontSize: '0.9rem', fontWeight: 600 }}
              onClick={() => {
                setForgotMode(false);
                setResetStep(1);
                setError(null);
                setSuccessMessage(null);
              }}
            >
              Back to Login
            </button>
          </div>
        </>
      )}

      <p className="auth-terms-note" style={{ color: theme.colors.textTertiary }}>
        By signing in you agree to our Terms of Service and Privacy Policy.
      </p>
    </AuthLayout>
  );
}
