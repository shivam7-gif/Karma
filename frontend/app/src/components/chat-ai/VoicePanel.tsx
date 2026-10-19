import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Sparkles, Send } from 'lucide-react';
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
  const [hasStartedAudio, setHasStartedAudio] = useState(false);

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
    setHasStartedAudio(true);
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

  return (
    <div
      role="dialog"
      aria-label="Voice Agent Mode"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.25s ease-out',
        padding: '20px',
      }}
    >
      {/* Voice Agent Modal Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(180deg, #0e1322 0%, #070913 100%)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '28px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
          padding: '28px 24px 32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Header Controls */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background:
                  voiceState === 'listening'
                    ? '#38bdf8'
                    : voiceState === 'speaking'
                    ? '#e100ff'
                    : voiceState === 'thinking'
                    ? '#c084fc'
                    : '#94a3b8',
                boxShadow:
                  voiceState === 'listening'
                    ? '0 0 10px #38bdf8'
                    : voiceState === 'speaking'
                    ? '0 0 12px #e100ff'
                    : 'none',
              }}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#e2e8f0',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Voice Agent Mode
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'rgba(255,255,255,0.08)',
                color: '#94a3b8',
                marginLeft: '4px',
              }}
            >
              {voiceState}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice panel"
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
        <div style={{ margin: '14px 0 24px 0' }}>
          <AuroraOrb
            size={220}
            state={voiceState}
            audioLevelRef={audioLevelRef}
            onClick={handleToggleMic}
          />
        </div>

        {/* Live Caption Under Orb with Spoken Words Highlighting One by One */}
        <div
          style={{
            minHeight: '64px',
            maxHeight: '110px',
            width: '100%',
            overflowY: 'auto',
            textAlign: 'center',
            padding: '8px 16px',
            marginBottom: '20px',
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
                color: 'rgba(255,255,255,0.7)',
                margin: 0,
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
                      color: isActive ? '#f0abfc' : 'rgba(255,255,255,0.75)',
                      fontWeight: isActive ? 700 : 400,
                      textShadow: isActive ? '0 0 12px rgba(240, 171, 252, 0.8)' : 'none',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
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
              }}
            >
              "{userTranscript}"
            </p>
          ) : (
            <p
              style={{
                fontSize: '14px',
                color: '#64748B',
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              {!hasStartedAudio
                ? 'Tap mic or orb to start listening'
                : voiceState === 'listening'
                ? 'Listening to your voice...'
                : voiceState === 'thinking'
                ? 'Synthesizing response...'
                : 'Ready'}
            </p>
          )}
        </div>

        {/* Bottom Interactive Voice Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {/* Mic Toggle Button */}
          <button
            type="button"
            onClick={handleToggleMic}
            aria-label={isMicActive ? 'Mute microphone' : 'Unmute microphone'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '9999px',
              border: isMicActive
                ? '1px solid rgba(56, 189, 248, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.15)',
              background: isMicActive
                ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(56, 189, 248, 0.2) 100%)'
                : 'rgba(255, 255, 255, 0.08)',
              color: isMicActive ? '#38bdf8' : '#e2e8f0',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isMicActive ? '0 0 20px rgba(56, 189, 248, 0.25)' : 'none',
            }}
          >
            {isMicActive ? <Mic size={18} /> : <MicOff size={18} />}
            <span>{isMicActive ? 'Listening' : 'Start Mic'}</span>
          </button>

          {/* If transcript exists, allow sending it */}
          {userTranscript && (
            <button
              type="button"
              onClick={() => handleSubmitPrompt()}
              aria-label="Send spoken prompt"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '9999px',
                border: 'none',
                background: '#2563EB',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Ask</span>
              <Send size={15} />
            </button>
          )}

          {/* Quick Demo Voice trigger */}
          <button
            type="button"
            onClick={() => {
              handleSubmitPrompt('Give me a brief overview of the Aurora Voice Agent mode');
            }}
            aria-label="Demo Voice Agent"
            title="Trigger demo speech synthesis"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#e2e8f0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoicePanel;
