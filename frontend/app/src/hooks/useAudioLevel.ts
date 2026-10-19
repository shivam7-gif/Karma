import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioLevelData } from '../components/chat-ai/SoftAurora';

export function useAudioLevel() {
  const [audioData, setAudioData] = useState<AudioLevelData>({
    slow: 0,
    mid: 0,
    fast: 0,
    overall: 0,
  });

  const audioLevelRef = useRef<AudioLevelData>({
    slow: 0,
    mid: 0,
    fast: 0,
    overall: 0,
  });

  const [isMicActive, setIsMicActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Simulated speech envelope tracking
  const speechSimRef = useRef<{
    active: boolean;
    currentLevel: number;
    targetLevel: number;
    decayTimer: number;
  }>({
    active: false,
    currentLevel: 0,
    targetLevel: 0,
    decayTimer: 0,
  });

  // Fast attack, slow release smoothing loop
  const updateLevels = useCallback((rawTarget: number) => {
    const cur = audioLevelRef.current;
    const attack = 0.45;  // fast attack
    const release = 0.08; // slow release

    // Overall envelope
    const speed = rawTarget > cur.overall ? attack : release;
    const newOverall = cur.overall + (rawTarget - cur.overall) * speed;

    // Slow word-level swell
    const slowSpeed = rawTarget > cur.slow ? 0.15 : 0.04;
    const newSlow = cur.slow + (rawTarget - cur.slow) * slowSpeed;

    // Mid per-syllable pulse
    const midSpeed = rawTarget > cur.mid ? 0.35 : 0.12;
    const newMid = cur.mid + (rawTarget - cur.mid) * midSpeed;

    // Fast jitter for fine ripples
    const jitter = rawTarget > 0.05 ? (Math.random() - 0.5) * 0.3 * rawTarget : 0;
    const newFast = Math.max(0, Math.min(1, newMid * 0.8 + jitter));

    const nextData: AudioLevelData = {
      slow: Math.max(0, Math.min(1, newSlow)),
      mid: Math.max(0, Math.min(1, newMid)),
      fast: Math.max(0, Math.min(1, newFast)),
      overall: Math.max(0, Math.min(1, newOverall)),
    };

    audioLevelRef.current = nextData;
  }, []);

  // Frame processing loop for mic or simulated envelope
  useEffect(() => {
    let lastUiUpdate = 0;

    const processAudio = (time: number) => {
      let rawLevel = 0;

      // 1. Real mic analysis if active
      if (analyserRef.current && isMicActive) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS volume
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const normalized = dataArray[i] / 255;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        rawLevel = Math.min(1, rms * 3.5); // scale to 0..1
      }
      // 2. Simulated envelope if speech is active
      else if (speechSimRef.current.active) {
        const sim = speechSimRef.current;
        // natural oscillation and fluctuation
        const timeFactor = time * 0.007;
        const wobble = 0.75 + Math.sin(timeFactor * 3) * 0.15 + Math.cos(timeFactor * 7) * 0.1;
        rawLevel = sim.targetLevel * wobble;

        // Auto decay if silence interval
        if (Date.now() > sim.decayTimer) {
          sim.targetLevel = Math.max(0.08, sim.targetLevel * 0.88);
        }
      }

      updateLevels(rawLevel);

      // Throttled UI state update (every ~100ms) for components that need state
      if (time - lastUiUpdate > 100) {
        setAudioData({ ...audioLevelRef.current });
        lastUiUpdate = time;
      }

      animationFrameRef.current = requestAnimationFrame(processAudio);
    };

    animationFrameRef.current = requestAnimationFrame(processAudio);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMicActive, updateLevels]);

  // Start Mic Analysis (Click-triggered for iOS/Safari compliance)
  const startMic = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      analyserRef.current = analyser;
      setIsMicActive(true);
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      setIsMicActive(false);
      return false;
    }
  }, []);

  // Stop Mic Analysis
  const stopMic = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
    setIsMicActive(false);
  }, []);

  // Connect Web Speech boundary events or word bursts to speech envelope
  const triggerWordPulse = useCallback((intensity = 0.85, holdMs = 280) => {
    speechSimRef.current.active = true;
    speechSimRef.current.targetLevel = Math.min(1, intensity);
    speechSimRef.current.decayTimer = Date.now() + holdMs;
  }, []);

  const startSpeechSimulation = useCallback(() => {
    speechSimRef.current.active = true;
    speechSimRef.current.targetLevel = 0.75;
    speechSimRef.current.decayTimer = Date.now() + 5000;
  }, []);

  const stopSpeechSimulation = useCallback(() => {
    speechSimRef.current.active = false;
    speechSimRef.current.targetLevel = 0;
    speechSimRef.current.currentLevel = 0;
  }, []);

  return {
    audioData,
    audioLevelRef,
    isMicActive,
    startMic,
    stopMic,
    triggerWordPulse,
    startSpeechSimulation,
    stopSpeechSimulation,
  };
}
