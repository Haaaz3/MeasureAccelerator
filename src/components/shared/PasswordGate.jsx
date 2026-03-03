import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';

const SESSION_KEY = 'insight-forge-authed';

// Oracle Redwood Light tokens
const colors = {
  accent: '#C74634',
  accentHover: '#B03D2E',
  bg: '#F7F7F8',
  bgSecondary: '#EFEFEF',
  text: '#201F1E',
  muted: '#6B6B6F',
  border: '#E0E0E3',
  white: '#FFFFFF',
  error: '#D32F2F',
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function PasswordGate({ children }) {
  const authHash = import.meta.env.VITE_AUTH_HASH;

  // If no auth hash configured, skip authentication
  if (!authHash) {
    return children;
  }

  const [isAuthed, setIsAuthed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === 'true') {
      setIsAuthed(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const hash = await hashPassword(password);
      if (hash === authHash.toLowerCase()) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        setIsAuthed(true);
      } else {
        setError('Incorrect password');
      }
    } catch (err) {
      setError('Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show nothing while checking sessionStorage
  if (isChecking) {
    return null;
  }

  // If authenticated, render children
  if (isAuthed) {
    return children;
  }

  // Render login form
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          backgroundColor: colors.white,
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Logo / Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${colors.accent}, #e85d4e)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <ShieldCheck size={28} color={colors.white} />
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: colors.text,
              margin: 0,
            }}
          >
            Insight Forge
          </h1>
          <p
            style={{
              fontSize: 14,
              color: colors.muted,
              marginTop: 4,
            }}
          >
            Enter password to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Password"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 14,
                border: `1px solid ${error ? colors.error : colors.border}`,
                borderRadius: 8,
                backgroundColor: colors.bgSecondary,
                color: colors.text,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => {
                if (!error) e.target.style.borderColor = colors.accent;
              }}
              onBlur={(e) => {
                if (!error) e.target.style.borderColor = colors.border;
              }}
            />
            {error && (
              <p
                style={{
                  fontSize: 13,
                  color: colors.error,
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: colors.white,
              backgroundColor: isSubmitting ? colors.muted : colors.accent,
              border: 'none',
              borderRadius: 8,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.target.style.backgroundColor = colors.accentHover;
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.target.style.backgroundColor = colors.accent;
            }}
          >
            {isSubmitting ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
