import React, { useState, useEffect } from 'react';
import { LogOut, HeartHandshake } from 'lucide-react';
import TenantDashboard from './components/TenantDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import AdminDashboard from './components/AdminDashboard';
import FloatingBot from './components/FloatingBot';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'TENANT' | 'OWNER' | 'ADMIN'>('TENANT');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch logged-in user profile if token exists
  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
      } else {
        // Token might be expired, log out
        handleLogout();
      }
    } catch (err) {
      console.error(err);
      handleLogout();
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setErrorMsg('');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const url = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login' 
      ? { email, password }
      : { email, password, name, role };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        
        // Clean form
        setEmail('');
        setPassword('');
        setName('');
      } else {
        setErrorMsg(data.error || 'Authentication failed. Please check credentials.');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('Server connection failed. Is the backend running?');
    }
  };

  const handleProfileUpdated = (updatedUser: any) => {
    setUser(updatedUser);
  };

  return (
    <div className="app-container">
      {/* GLOBAL NAVBAR */}
      <header className="navbar">
        <div className="nav-brand">
          <HeartHandshake size={24} color="var(--accent-primary)" />
          <span>FlatSync</span>
        </div>
        {user && (
          <div className="nav-links">
            <div className="nav-user">
              <span style={{ fontWeight: 600 }}>{user.name}</span>
              <span className="user-badge">{user.role}</span>
            </div>
            <button className="btn btn-secondary btn-icon" onClick={handleLogout} title="Log Out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </header>

      {/* AUTHENTICATION VIEW */}
      {!user ? (
        <div style={{ 
          flexGrow: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: 24,
          background: 'radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%)'
        }}>
          <div className="glass-card modal-content" style={{ maxWidth: 440 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ 
                display: 'inline-flex', 
                background: 'rgba(99, 102, 241, 0.1)', 
                padding: 16, 
                borderRadius: '50%',
                marginBottom: 16 
              }}>
                <HeartHandshake size={36} color="var(--accent-primary)" />
              </div>
              <h2 style={{ color: 'white' }}>
                {authMode === 'login' ? 'Welcome Back' : 'Join FlatSync'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {authMode === 'login' ? 'Find matching roommates and listings in seconds.' : 'Create an account and connect with owners/tenants.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter your name"
                    value={name}
                    required
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@example.com"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {authMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">I want to...</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button
                      type="button"
                      className={`btn ${role === 'TENANT' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRole('TENANT')}
                    >
                      Find a Room (Tenant)
                    </button>
                    <button
                      type="button"
                      className={`btn ${role === 'OWNER' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRole('OWNER')}
                    >
                      Post a Room (Owner)
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid var(--danger)', 
                  color: 'var(--danger)', 
                  padding: 12, 
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 16
                }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 12, fontSize: 15 }} disabled={loading}>
                {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Register Account'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              </span>
              <span 
                style={{ color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setErrorMsg('');
                }}
              >
                {authMode === 'login' ? 'Sign Up' : 'Sign In'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ROUTING BASED ON USER ROLE */
        <main style={{ flexGrow: 1 }}>
          {user.role === 'TENANT' && (
            <TenantDashboard token={token!} user={user} onProfileUpdate={handleProfileUpdated} />
          )}
          {user.role === 'OWNER' && (
            <OwnerDashboard token={token!} user={user} />
          )}
          {user.role === 'ADMIN' && (
            <AdminDashboard token={token!} />
          )}
        </main>
      )}
      {/* FLOATING BOT ASSISTANT */}
      {user && <FloatingBot />}
    </div>
  );
}
