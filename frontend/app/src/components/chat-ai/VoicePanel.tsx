import React, { useState, useEffect, useRef } from 'react';
import { X, Mic } from 'lucide-react';
import AuroraOrb, { type VoiceState } from './AuroraOrb';
import { useAudioLevel } from '../../hooks/useAudioLevel';

interface VoicePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (text: string) => Promise<string | void> | void;
  latestAssistantReply?: string;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  latestAssistantReply,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userTranscript, setUserTranscript] = useState('');
  const [spokenCaption, setSpokenCaption] = useState<string[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);

  const {
    audioLevelRef,
    isMicActive,
    startMic,
    stopMic,
    triggerWordPulse,
    startSpeechSimulation,
    stopSpeechSimulation,
  } = useAudioLevel();

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setUserTranscript(transcriptPiece);
            handleSubmitPrompt(transcriptPiece);
          } else {
            interim += transcriptPiece;
          }
        }
        if (interim) {
          setUserTranscript(interim);
        }
      };

      rec.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
      };

      rec.onend = () => {
        if (voiceState === 'listening') {
          try {
            rec.start();
          } catch (e) {
            // ignore
          }
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [voiceState]);

  // Handle panel close cleanup
  useEffect(() => {
    if (!isOpen) {
      stopMic();
      stopSpeechSimulation();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setVoiceState('idle');
      setUserTranscript('');
      setActiveWordIndex(-1);
    }
  }, [isOpen, stopMic, stopSpeechSimulation]);

  // Click-to-start activation (required by iOS / Safari for AudioContext)
  const handleActivateVoice = async () => {
    const micStarted = await startMic();
    if (micStarted) {
      setVoiceState('listening');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // ignore
        }
      }
    } else {
      setVoiceState('idle');
    }
  };

  const handleToggleMic = async () => {
    if (isMicActive) {
      stopMic();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setVoiceState('idle');
    } else {
      await handleActivateVoice();
    }
  };

  // Speak agent's text aloud with synchronized word-boundary highlights and shader pulses
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_\[\]()]/g, ' ').trim();
    const words = cleanText.split(/\s+/).filter(Boolean);

    setSpokenCaption(words);
    setActiveWordIndex(0);
    setVoiceState('speaking');
    startSpeechSimulation();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Find approximate word index
        const charIdx = event.charIndex;
        let runningLength = 0;
        for (let i = 0; i < words.length; i++) {
          runningLength += words[i].length + 1;
          if (runningLength >= charIdx) {
            setActiveWordIndex(i);
            break;
          }
        }
        triggerWordPulse(0.85, 260);
      }
    };

    utterance.onend = () => {
      stopSpeechSimulation();
      setActiveWordIndex(-1);
      setVoiceState('listening');
    };

    utterance.onerror = () => {
      stopSpeechSimulation();
      setActiveWordIndex(-1);
      setVoiceState('listening');
    };

    window.speechSynthesis.speak(utterance);
  };

  // When latest assistant reply changes, speak it if VoicePanel is open
  useEffect(() => {
    if (isOpen && latestAssistantReply && voiceState === 'thinking') {
      speakText(latestAssistantReply);
    }
  }, [latestAssistantReply, isOpen, voiceState]);

  // Listen for Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Submit spoken text
  const handleSubmitPrompt = async (textToSend?: string) => {
    const text = textToSend || userTranscript;
    if (!text.trim()) return;

    setVoiceState('thinking');
    stopMic();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    if (onSendMessage) {
      const reply = await onSendMessage(text);
      if (typeof reply === 'string' && reply) {
        speakText(reply);
      }
    }
    setUserTranscript('');
  };

  if (!isOpen) return null;

  // Dynamic status text
  const statusLine =
    voiceState === 'listening'
      ? 'Listening…'
      : voiceState === 'thinking'
      ? 'Thinking…'
      : voiceState === 'speaking'
      ? 'Speaking…'
      : 'Tap to talk';

  return (
    <div
      role="dialog"
      aria-label="Karma Voice Mode"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0a10',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'voiceOverlayFadeIn 0.25s ease-out',
        padding: '24px',
      }}
    >
      {/* Voice Modal Container with scale-in transition */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          animation: 'voiceOrbScaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background:
                  voiceState === 'listening'
                    ? '#38bdf8'
                    : voiceState === 'speaking'
                    ? 'var(--accent, #8b3dff)'
                    : voiceState === 'thinking'
                    ? '#c084fc'
                    : '#64748b',
                boxShadow:
                  voiceState === 'listening'
                    ? '0 0 10px #38bdf8'
                    : voiceState === 'speaking'
                    ? '0 0 12px var(--accent, #8b3dff)'
                    : 'none',
              }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#e2e8f0',
                letterSpacing: '-0.01em',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Karma Voice
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice mode (Esc)"
            title="Close (Esc)"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 220px Circular Aurora Orb with SoftAurora */}
        <div style={{ margin: '8px 0 28px 0' }}>
          <AuroraOrb
            size={220}
            state={voiceState}
            audioLevelRef={audioLevelRef}
            onClick={handleToggleMic}
          />
        </div>

        {/* Dynamic Status / Caption Area */}
        <div
          style={{
            minHeight: '60px',
            maxHeight: '120px',
            width: '100%',
            overflowY: 'auto',
            textAlign: 'center',
            padding: '4px 16px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {voiceState === 'speaking' && spokenCaption.length > 0 ? (
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'rgba(255, 255, 255, 0.75)',
                margin: 0,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {spokenCaption.map((word, idx) => {
                const isActive = idx === activeWordIndex;
                return (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      marginRight: '5px',
                      color: isActive ? '#f0abfc' : 'rgba(255, 255, 255, 0.75)',
                      fontWeight: isActive ? 600 : 400,
                      textShadow: isActive ? '0 0 12px rgba(240, 171, 252, 0.8)' : 'none',
                      transform: isActive ? 'scale(1.06)' : 'scale(1)',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </p>
          ) : userTranscript ? (
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.5,
                color: '#38bdf8',
                fontWeight: 500,
                margin: 0,
                fontFamily: 'var(--font-sans)',
              }}
            >
              “{userTranscript}”
            </p>
          ) : (
            <p
              style={{
                fontSize: '14px',
                color: '#94a3b8',
                margin: 0,
                fontWeight: 400,
                letterSpacing: '-0.01em',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {statusLine}
            </p>
          )}
        </div>

        {/* Exactly two bottom controls: Mic Toggle and Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'center',
          }}
        >
          {/* Button 1: Mic Toggle (Talk / Stop) */}
          <button
            type="button"
            onClick={handleToggleMic}
            aria-label={isMicActive ? 'Stop listening' : 'Start talking'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: 'var(--r-full, 9999px)',
              border: isMicActive
                ? '1px solid rgba(239, 68, 68, 0.5)'
                : '1px solid rgba(139, 61, 255, 0.4)',
              background: isMicActive
                ? 'rgba(239, 68, 68, 0.15)'
                : 'var(--accent, #8b3dff)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isMicActive
                ? '0 0 16px rgba(239, 68, 68, 0.3)'
                : '0 2px 14px rgba(139, 61, 255, 0.35)',
            }}
          >
            <Mic size={16} strokeWidth={2} />
            <span>{isMicActive ? 'Stop' : 'Talk'}</span>
          </button>

          {/* Button 2: Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice mode"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: 'var(--r-full, 9999px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            <X size={16} />
            <span>Close</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes voiceOverlayFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes voiceOrbScaleIn {
          from {
            transform: scale(0.65) translateY(30px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default VoicePanel;
