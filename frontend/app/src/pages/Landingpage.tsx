import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AlexaViewer from '../components/AlexaViewer';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [modelLoaded, setModelLoaded] = useState(false);
  const [progress, setProgress] = useState(15);
  const [isReady, setIsReady] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Smooth progress bar simulation syncing with real load
  useEffect(() => {
    if (modelLoaded) {
      setProgress(100);
      const timer = setTimeout(() => setIsReady(true), 350);
      return () => clearTimeout(timer);
    }
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return prev;
        return prev + Math.floor(Math.random() * 6) + 3;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [modelLoaded]);

  const handleClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.92); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)  scale(1);    }
        }
        @keyframes ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(28,170,217,0.6); }
          50%       { box-shadow: 0 0 0 10px rgba(28,170,217,0); }
        }
      `}</style>

      {/* Full-viewport 3D canvas */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, cursor: 'pointer' }}>
        {!isReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FFFFFF',
              zIndex: 10,
              transition: 'opacity 0.5s ease',
              opacity: modelLoaded ? 0 : 1,
              pointerEvents: modelLoaded ? 'none' : 'auto',
            }}
          >
            {/* Centered Brand Loading Box */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
                maxWidth: '320px',
                padding: '0 24px',
              }}
            >
              {/* Brand Logo Pulse */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
                  animation: 'pulse-slow 2s infinite ease-in-out',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
                  }}
                />
              </div>

              {/* Title & Tagline */}
              <div style={{ textAlign: 'center' }}>
                <h2
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    color: '#0F172A',
                    margin: 0,
                  }}
                >
                  Karma
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#64748B',
                    margin: '4px 0 0 0',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Voice-First Personal AI Assistant
                </p>
              </div>

              {/* Progress Bar Container */}
              <div
                style={{
                  width: '100%',
                  marginTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    background: '#F1F5F9',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #2563EB 0%, #60A5FA 100%)',
                      borderRadius: '9999px',
                      transition: 'width 0.25s ease-out',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#94A3B8',
                    fontWeight: 500,
                  }}
                >
                  <span>Initializing assistant…</span>
                  <span>{Math.min(progress, 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{
          width: '100%', height: '100%',
          opacity: modelLoaded ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}>
          <AlexaViewer
            onProgress={(p) => setProgress((prev) => Math.max(prev, p))}
            onLoad={() => setModelLoaded(true)}
            onClick={handleClick}
          />
        </div>
      </div>

      {/* Sign Up button */}
      <div style={{ position: 'fixed', top: '24px', right: '28px', zIndex: 50 }}>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          style={{
            padding: '10px 22px', borderRadius: '999px',
            background: '#4C8DFF', border: 'none',
            color: '#fff', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.01em',
            boxShadow: '0 4px 20px rgba(76,141,255,0.35)',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          Sign Up
        </button>
      </div>

      {/* "How can I help you?" toast — bottom-centre */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '48px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          animation: 'toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(15,15,20,0.92)',
            backdropFilter: 'blur(16px)',
            borderRadius: '50px',
            padding: '14px 24px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(28,170,217,0.4)',
          }}>
            {/* Alexa cyan dot */}
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: '#1CAAD9',
              animation: 'ring-pulse 1s ease-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '15px', fontWeight: 600,
              color: '#fff', whiteSpace: 'nowrap',
            }}>
              How can I help you?
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default Landing;