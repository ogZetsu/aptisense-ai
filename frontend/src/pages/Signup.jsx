import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { signup as signupApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function SignupPage({ onNavigate, onLoginSuccess }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!fullName.trim()) return 'Please enter your full name.';
    if (!email.trim() || !email.includes('@')) return 'Please enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (!acceptedTerms) return 'You must accept the Terms & Conditions to create an account.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await signupApi({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      const token = res.access_token || res.token;
      const user = res.user || res;
      onLoginSuccess?.(user, token);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join AptiSense AI and start practicing with AI-powered interviews."
      onNavigate={onNavigate}
    >
      {error && <div className="auth-alert auth-alert-error">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span className="auth-label">Full name</span>
          <div className="auth-input-wrap">
            <User size={16} className="auth-input-icon" />
            <input
              type="text"
              className="auth-input"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              disabled={loading}
            />
          </div>
        </label>

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
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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

        <label className="auth-field">
          <span className="auth-label">Confirm password</span>
          <div className="auth-input-wrap">
            <Lock size={16} className="auth-input-icon" />
            <input
              type={showConfirm ? 'text' : 'password'}
              className="auth-input auth-input-with-toggle"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-toggle-password"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="auth-checkbox-field">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            disabled={loading}
          />
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.fonts.size.sm, lineHeight: 1.5 }}>
            I agree to the{' '}
            <button type="button" className="auth-link-btn" onClick={() => window.alert('Terms & Conditions: By using AptiSense AI you agree to fair use of the platform, data processing for interview analytics, and compliance with applicable privacy laws.')}>
              Terms & Conditions
            </button>{' '}
            and{' '}
            <button type="button" className="auth-link-btn" onClick={() => window.alert('Privacy Policy: We store your interview sessions and account data securely. We do not sell personal data to third parties.')}>
              Privacy Policy
            </button>
          </span>
        </label>

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? <><Loader2 size={18} className="spin-icon" /> Creating account...</> : 'Create Account'}
        </button>
      </form>

      <div className="auth-divider">
        <span>or sign up with</span>
      </div>

      <GoogleSignInButton
        mode="signup_with"
        onSuccess={onLoginSuccess}
        onError={setError}
        disabled={loading}
      />

      <p className="auth-switch-text">
        Already have an account?{' '}
        <button type="button" className="auth-link-btn" onClick={() => onNavigate?.('login')}>
          Sign in
        </button>
      </p>
    </AuthLayout>
  );
}
