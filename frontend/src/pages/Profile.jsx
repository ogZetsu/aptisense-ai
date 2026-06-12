import React, { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Brain,
  Calendar,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Phone,
  Shield,
  User,
} from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchCurrentUser, getAnalyticsSummary, updateProfile, changePassword } from '../services/api';

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export default function ProfilePage({ onNavigate, currentUser, onLogout }) {
  const { theme } = useTheme();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(currentUser);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Profile field states
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [degree, setDegree] = useState('');
  const [branch, setBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [skills, setSkills] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwMessage, setPwMessage] = useState(null);
  const [pwError, setPwError] = useState(null);

  // Common UI states
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!currentUser?.user_id) {
        setLoading(false);
        setError('Please sign in to view your profile.');
        return;
      }

      try {
        const [userData, summary] = await Promise.all([
          fetchCurrentUser(),
          getAnalyticsSummary(currentUser.user_id).catch(() => null),
        ]);
        if (!mounted) return;
        setProfile(userData);
        setFullName(userData.full_name || userData.username || '');
        setGender(userData.gender || '');
        setDob(userData.dob || '');
        setContactNumber(userData.contact_number || '');
        setDegree(userData.degree || '');
        setBranch(userData.branch || '');
        setGraduationYear(userData.graduation_year || '');
        setCgpa(userData.cgpa || '');
        setSkills(userData.skills ? userData.skills.join(', ') : '');
        setGithubUrl(userData.github_url || '');
        setLinkedinUrl(userData.linkedin_url || '');
        setStats(summary);
        setError(null);
      } catch (err) {
        if (mounted) setError('Failed to load profile data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [currentUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const parsedSkills = skills
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const res = await updateProfile({
        full_name: fullName.trim(),
        gender: gender || null,
        dob: dob || null,
        contact_number: contactNumber.trim() || null,
        degree: degree || null,
        branch: branch.trim() || null,
        graduation_year: graduationYear ? parseInt(graduationYear, 10) : null,
        cgpa: cgpa ? parseFloat(cgpa) : null,
        skills: parsedSkills,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
      });
      const updated = res.user || res;
      setProfile(updated);
      updateUser(updated);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError(null);
    setPwMessage(null);

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err?.response?.data?.detail || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = (profile?.full_name || profile?.username || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const statCards = [
    { label: 'Interviews', value: stats?.interviews_conducted ?? 0, icon: Brain },
    { label: 'Aptitude Tests', value: stats?.aptitude_attempts ?? 0, icon: FileText },
    {
      label: 'Avg AI Score',
      value: stats?.interview_performance?.overall_score
        ? `${Math.round(stats.interview_performance.overall_score)}%`
        : '—',
      icon: Award,
    },
    {
      label: 'Integrity Score',
      value: stats?.proctoring_integrity?.average_integrity
        ? `${Math.round(stats.proctoring_integrity.average_integrity)}%`
        : '—',
      icon: BarChart3,
    },
  ];

  if (!currentUser?.user_id) {
    return (
      <MainLayout activeView="profile" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div className="page-container">
          <div className="empty-state glass-panel">
            <User size={32} color={theme.colors.primary} />
            <h2>Sign in required</h2>
            <p>Please sign in to view and manage your profile.</p>
            <button type="button" className="nav-primary-btn" onClick={() => onNavigate?.('login')}>
              Sign In
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout activeView="profile" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div className="page-container">
        <div className="page-header">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>My Profile</h1>
          <p style={{ color: theme.colors.textSecondary, marginTop: '0.35rem' }}>
            Manage your account, update your credentials, and view performance overview.
          </p>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin-icon" />
            <span>Loading profile...</span>
          </div>
        ) : (
          <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Form Section */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div className="profile-hero" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.75rem', borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: '1.25rem' }}>
                <div className="profile-avatar-lg">{initials}</div>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 800 }}>{profile?.full_name || profile?.username}</h2>
                  <p style={{ margin: '0.25rem 0 0', color: theme.colors.textSecondary, fontSize: theme.fonts.size.sm }}>
                    {profile?.email || 'No email'}
                  </p>
                  <div className="profile-badges" style={{ marginTop: '0.5rem' }}>
                    <span className="profile-badge">
                      {profile?.auth_provider === 'google' ? 'Google Account' : 'Email Account'}
                    </span>
                    {profile?.role === 'admin' && (
                      <span className="profile-badge admin-badge-inline">
                        <Shield size={12} /> Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {message && <div className="auth-alert auth-alert-success" style={{ marginBottom: '1.25rem' }}>{message}</div>}
              {error && <div className="auth-alert auth-alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

              <form onSubmit={handleSave}>
                {/* PERSONAL INFORMATION */}
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700, color: theme.colors.primary }}>
                  <User size={18} /> Personal Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Full Name *</span>
                    <input
                      type="text"
                      className="auth-input auth-input-plain"
                      placeholder="Your Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={saving}
                      required
                    />
                  </label>

                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Gender</span>
                    <select
                      className="auth-input auth-input-plain"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      disabled={saving}
                      style={{ background: theme.colors.backgroundAlt }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </label>

                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Date of Birth</span>
                    <input
                      type="date"
                      className="auth-input auth-input-plain"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      disabled={saving}
                    />
                  </label>

                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Contact Number</span>
                    <div style={{ position: 'relative' }}>
                      <Phone size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.textSecondary }} />
                      <input
                        type="tel"
                        className="auth-input auth-input-plain"
                        placeholder="10-digit mobile"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        disabled={saving}
                        style={{ paddingLeft: '32px' }}
                      />
                    </div>
                  </label>
                </div>

                {/* ACADEMIC DETAILS */}
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700, color: theme.colors.primary }}>
                  <GraduationCap size={18} /> Academic Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Degree / Program</span>
                    <select
                      className="auth-input auth-input-plain"
                      value={degree}
                      onChange={(e) => setDegree(e.target.value)}
                      disabled={saving}
                      style={{ background: theme.colors.backgroundAlt }}
                    >
                      <option value="">Select Degree</option>
                      <option value="MCA">MCA</option>
                      <option value="B.Tech CSE">B.Tech CSE</option>
                      <option value="B.Tech ECE">B.Tech ECE</option>
                      <option value="B.Tech IT">B.Tech IT</option>
                      <option value="BCA">BCA</option>
                      <option value="MBA">MBA</option>
                      <option value="M.Tech">M.Tech</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Branch / Specialization</span>
                    <input
                      type="text"
                      className="auth-input auth-input-plain"
                      placeholder="e.g. Computer Applications"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      disabled={saving}
                    />
                  </label>

                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Graduation Year</span>
                    <input
                      type="number"
                      className="auth-input auth-input-plain"
                      placeholder="e.g. 2026"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      disabled={saving}
                      min="2020"
                      max="2035"
                    />
                  </label>

                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Current CGPA (out of 10)</span>
                    <input
                      type="number"
                      className="auth-input auth-input-plain"
                      placeholder="e.g. 8.75"
                      value={cgpa}
                      onChange={(e) => setCgpa(e.target.value)}
                      disabled={saving}
                      min="0"
                      max="10"
                      step="0.01"
                    />
                  </label>
                </div>

                {/* PROFESSIONAL DETAILS */}
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700, color: theme.colors.primary }}>
                  <Award size={18} /> Professional Profile
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
                  <label className="auth-field" style={{ marginBottom: 0 }}>
                    <span className="auth-label">Core Skills (Comma separated)</span>
                    <textarea
                      className="auth-input auth-input-plain"
                      placeholder="e.g. React, Node.js, Python, MongoDB"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      disabled={saving}
                      rows={2}
                      style={{ resize: 'none', height: 'auto', padding: '0.75rem' }}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label className="auth-field" style={{ marginBottom: 0 }}>
                      <span className="auth-label">GitHub URL</span>
                      <div style={{ position: 'relative' }}>
                        <GithubIcon style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.textSecondary }} />
                        <input
                          type="url"
                          className="auth-input auth-input-plain"
                          placeholder="https://github.com/username"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          disabled={saving}
                          style={{ paddingLeft: '32px' }}
                        />
                      </div>
                    </label>

                    <label className="auth-field" style={{ marginBottom: 0 }}>
                      <span className="auth-label">LinkedIn URL</span>
                      <div style={{ position: 'relative' }}>
                        <LinkedinIcon style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.textSecondary }} />
                        <input
                          type="url"
                          className="auth-input auth-input-plain"
                          placeholder="https://linkedin.com/in/username"
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          disabled={saving}
                          style={{ paddingLeft: '32px' }}
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={saving} style={{ marginTop: '1rem', width: 'auto', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
                  {saving ? <><Loader2 size={16} className="spin-icon" /> Saving...</> : 'Save Profile Details'}
                </button>
              </form>
            </div>

            {/* Sidebar Stats and Security */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Performance */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, margin: '0 0 1rem 0' }}>Performance Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="profile-stat-card" style={{ padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Icon size={18} color={theme.colors.primary} style={{ marginBottom: '0.5rem' }} />
                        <div className="profile-stat-value" style={{ fontSize: '1.25rem', fontWeight: 800 }}>{stat.value}</div>
                        <div className="profile-stat-label" style={{ fontSize: '0.7rem', color: theme.colors.textSecondary, textAlign: 'center' }}>{stat.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Password update (email users only) */}
              {profile?.auth_provider === 'email' && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lock size={16} color={theme.colors.primary} /> Change Password
                  </h3>
                  
                  {pwMessage && <div className="auth-alert auth-alert-success" style={{ marginBottom: '1rem' }}>{pwMessage}</div>}
                  {pwError && <div className="auth-alert auth-alert-error" style={{ marginBottom: '1rem' }}>{pwError}</div>}

                  <form className="auth-form" onSubmit={handlePasswordChange} style={{ gap: '0.75rem' }}>
                    <label className="auth-field" style={{ marginBottom: 0 }}>
                      <span className="auth-label">Current Password</span>
                      <input
                        type="password"
                        className="auth-input auth-input-plain"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={changingPassword}
                        required
                      />
                    </label>

                    <label className="auth-field" style={{ marginBottom: 0 }}>
                      <span className="auth-label">New Password</span>
                      <input
                        type="password"
                        className="auth-input auth-input-plain"
                        placeholder="New password (min. 8 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={changingPassword}
                        required
                      />
                    </label>

                    <label className="auth-field" style={{ marginBottom: 0 }}>
                      <span className="auth-label">Confirm New Password</span>
                      <input
                        type="password"
                        className="auth-input auth-input-plain"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={changingPassword}
                        required
                      />
                    </label>

                    <button type="submit" className="auth-submit-btn" disabled={changingPassword} style={{ marginTop: '0.5rem' }}>
                      {changingPassword ? <><Loader2 size={16} className="spin-icon" /> Updating...</> : 'Update Password'}
                    </button>
                  </form>
                </div>
              )}

              {/* Quick Actions */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, margin: '0 0 1rem' }}>Quick Actions</h3>
                <div className="profile-action-btns" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button type="button" className="nav-hover-btn" onClick={() => onNavigate?.('interview-types')} style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>
                    Start Interview
                  </button>
                  <button type="button" className="nav-hover-btn" onClick={() => onNavigate?.('history')} style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>
                    View History
                  </button>
                  <button type="button" className="nav-hover-btn" onClick={() => onNavigate?.('analysis-dashboard')} style={{ textAlign: 'left', padding: '0.75rem 1rem' }}>
                    AI Analysis
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
