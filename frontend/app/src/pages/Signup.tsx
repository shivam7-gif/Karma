import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import alexa_1 from '../assets/hero_section/alexa_1.jpg';
import { BrandLogo } from '../components/BrandLogo';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 600);
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigate('/dashboard');
    }, 500);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 90% 80% at 50% 30%, #0d213a 0%, #060c16 60%, #020408 100%)',
        padding: '24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Outer Card with 40% / 60% Grid Split */}
      <div
        className="auth-container-grid"
        style={{
          width: '100%',
          maxWidth: '1080px',
          height: 'min(720px, 94vh)',
          borderRadius: '24px',
          background: 'rgba(11, 18, 30, 0.75)',
          backdropFilter: 'var(--blur-heavy)',
          WebkitBackdropFilter: 'var(--blur-heavy)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(76, 141, 255, 0.1)',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Left Side: 40% Space for Picture & Showcase */}
        <div
          className="auth-picture-column"
          style={{
            width: '40%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '36px 32px',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Background Image */}
          <img
            src={alexa_1}
            alt="Karma Echo Smart Home Visual"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 35%',
              filter: 'brightness(0.72) contrast(1.08)',
            }}
          />

          {/* Vignette Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(3, 8, 16, 0.75) 0%, rgba(6, 14, 28, 0.4) 40%, rgba(3, 8, 16, 0.92) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Branding on Left */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <BrandLogo size={30} />
          </div>

          {/* Bottom Feature Badges on Left */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(76, 141, 255, 0.2)',
                border: '1px solid rgba(76, 141, 255, 0.4)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '14px',
              }}
            >
              <Sparkles size={13} style={{ color: 'var(--accent-blue)' }} />
              <span>Early Access Simulator</span>
            </div>

            <h3
              style={{
                color: '#FFFFFF',
                fontSize: '22px',
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: '-0.02em',
                marginBottom: '12px',
                textShadow: '0 2px 12px rgba(0, 0, 0, 0.6)',
              }}
            >
              Experience Next-Gen Home AI.
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '13px' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                <span>Multimodal Echo & Echo Show modes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '13px' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                <span>Live tool execution & developer trace</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '13px' }}>
                <CheckCircle2 size={15} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                <span>Smart list & itinerary organization</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: 60% Width for Sign-Up Logic */}
        <div
          className="auth-form-column"
          style={{
            width: '60%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '40px 48px',
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '22px' }}>
            <h1
              style={{
                color: '#FFFFFF',
                fontSize: '28px',
                fontWeight: 600,
                letterSpacing: '-0.025em',
                marginBottom: '6px',
              }}
            >
              Create an account
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                margin: 0,
              }}
            >
              Sign up with Google, GitHub, or your email to get started
            </p>
          </div>

          {/* OAuth Buttons (Google & GitHub) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '11px 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(76, 141, 255, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>

            {/* GitHub OAuth Button */}
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '11px 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(76, 141, 255, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>GitHub</span>
            </button>
          </div>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              or continue with email
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Full Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                Full Name
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '9px 14px',
                  gap: '10px',
                }}
              >
                <User size={16} style={{ color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  required
                  placeholder="Olivia Hayes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                Email Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '9px 14px',
                  gap: '10px',
                }}
              >
                <Mail size={16} style={{ color: 'var(--text-secondary)' }} />
                <input
                  type="email"
                  required
                  placeholder="olivia@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                Create Password
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '9px 14px',
                  gap: '10px',
                }}
              >
                <Lock size={16} style={{ color: 'var(--text-secondary)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading ? 'default' : 'pointer',
                boxShadow: '0 4px 16px rgba(76, 141, 255, 0.4)',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--text-accent-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'var(--accent-blue)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <span>{isLoading ? 'Creating account...' : 'Create Account'}</span>
              {!isLoading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Toggle to Login */}
          <div
            style={{
              marginTop: '20px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--accent-blue)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .auth-container-grid {
            flex-direction: column !important;
            height: auto !important;
            max-height: 94vh !important;
          }
          .auth-picture-column {
            width: 100% !important;
            height: 180px !important;
            padding: 20px !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          }
          .auth-form-column {
            width: 100% !important;
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Signup;
