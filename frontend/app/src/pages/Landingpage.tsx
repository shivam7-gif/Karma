import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlexaViewer from '../components/AlexaViewer';
import loadingSvg from '../assets/loader/loading.svg';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [modelLoaded, setModelLoaded] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <>
      <style>{`
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
        {!modelLoaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FFFFFF',
              zIndex: 10,
              transition: 'opacity 0.4s ease',
            }}
          >
            <img
              src={loadingSvg}
              alt="Loading..."
              style={{
                width: '110px',
                height: '110px',
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        <div style={{
          width: '100%', height: '100%',
          opacity: modelLoaded ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}>
          <AlexaViewer
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