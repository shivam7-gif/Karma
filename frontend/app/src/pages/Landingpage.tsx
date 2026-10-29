import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlexaViewer from '../components/AlexaViewer';
import { LiquidGlassCarousel, type LiquidGlassCarouselItem } from '@/components/ui/liquid-glass-carousel';
import loadingSvg from '../assets/loader/loading.svg';

import alexaHeroImg from '@/assets/hero_section/alexa_1.jpg';
import authPic1 from '@/assets/auth/pic_1.jpg';
import authPic2 from '@/assets/auth/pic_2.jpg';
import karmaHeroImg from '@/assets/hero.png';

const carouselItems: LiquidGlassCarouselItem[] = [
  { title: "Karma 3D Echo", src: alexaHeroImg, aspect: 1 },
  { title: "Neural Analytics", src: authPic1, aspect: 3 / 4 },
  { title: "AI Core Intelligence", src: authPic2, aspect: 3 / 4 },
  { title: "Autonomous Interface", src: karmaHeroImg, aspect: 1 },
  { title: "Voice Synthesizer", src: alexaHeroImg, aspect: 1 },
  { title: "Deep Synthesis Engine", src: authPic1, aspect: 3 / 4 },
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [modelLoaded, setModelLoaded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const videoSectionRef = React.useRef<HTMLElement>(null);

  const handleClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const scrollToVideo = () => {
    videoSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
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

      {/* Liquid Glass Carousel Hero Background */}
      <div className="h-svh w-full fixed inset-0 z-0">
        <LiquidGlassCarousel
          items={carouselItems}
          panelHeight={420}
        />
      </div>

      {/* Loading Overlay */}
      {!modelLoaded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FFFFFF',
            zIndex: 100,
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

      {/* Main Scrollable Landing Container */}
      <div className="relative z-10 w-full min-h-screen">
        {/* Hero Section 1: 3D Alexa Model */}
        <section className="min-h-screen w-full flex items-center justify-center relative pointer-events-auto">
          <div
            style={{
              width: 'min(480px, 90vw)',
              height: 'min(480px, 90vh)',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                opacity: modelLoaded ? 1 : 0,
                transition: 'opacity 0.8s ease',
              }}
            >
              <AlexaViewer
                onLoad={() => setModelLoaded(true)}
                onClick={handleClick}
              />
            </div>
          </div>

          {/* Smooth Scroll Cue to the Video Hero Section below */}
          <div
            onClick={scrollToVideo}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-pointer text-neutral-400 hover:text-neutral-700 transition-colors z-20"
            title="Scroll to view video"
          >
            <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Scroll Down</span>
            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        {/* Hero Section 2: Video Section directly below 3D Model */}
        <section
          ref={videoSectionRef}
          className="min-h-screen w-full flex items-center justify-center px-4 sm:px-8 py-20 relative pointer-events-auto"
        >
          <div className="w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-neutral-200/80 bg-black/90 backdrop-blur-md">
            <video
              src="/alexa/video_1.mp4"
              autoPlay
              loop
              muted
              playsInline
              controls
              className="w-full h-auto object-cover rounded-3xl"
            />
          </div>
        </section>
      </div>

      {/* Sign Up button */}
      <div style={{ position: 'fixed', top: '24px', right: '28px', zIndex: 50 }}>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          style={{
            padding: '10px 22px',
            borderRadius: '999px',
            background: '#4C8DFF',
            border: 'none',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.01em',
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
        <div
          style={{
            position: 'fixed',
            bottom: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            animation: 'toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(15,15,20,0.92)',
              backdropFilter: 'blur(16px)',
              borderRadius: '50px',
              padding: '14px 24px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(28,170,217,0.4)',
            }}
          >
            {/* Alexa cyan dot */}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#1CAAD9',
                animation: 'ring-pulse 1s ease-out infinite',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              How can I help you?
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default Landing;