import { useState, useEffect, useRef, useCallback } from 'react';
import { MicLifecycleState } from '../adapters/telemetryAdapter';
import { LiveAudioMetrics, calculateRealAudioMetrics } from './audioAnalyzer';

export function useMicAudio() {
  const [micState, setMicState] = useState<MicLifecycleState>('IDLE');
  const [micAudioData, setMicAudioData] = useState<Uint8Array | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveAudioMetrics | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | undefined>(undefined);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastStateUpdateRef = useRef<number>(0);

  const stopMic = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicState((prev) => (prev === 'IDLE' ? 'IDLE' : 'STOPPED'));
    setMicAudioData(null);
    setLiveMetrics(null);
    setSessionStartTime(undefined);
  }, []);

  const startMic = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicState('MIC_ERROR');
      return;
    }

    setMicState('REQUESTING_PERMISSION');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      source.connect(analyser);

      setMicState('MIC_ACTIVE');
      setSessionStartTime(Date.now());

      const freqBuffer = new Uint8Array(analyser.frequencyBinCount);
      const timeBuffer = new Float32Array(analyser.fftSize);

      const updateLoop = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(freqBuffer);
        setMicAudioData(new Uint8Array(freqBuffer));

        // Throttle React state telemetry updates to ~10 updates/sec (every 100ms)
        const now = performance.now();
        if (now - lastStateUpdateRef.current >= 100) {
          lastStateUpdateRef.current = now;
          analyserRef.current.getFloatTimeDomainData(timeBuffer);

          const metrics = calculateRealAudioMetrics(
            timeBuffer,
            audioCtx.sampleRate,
            stream.getAudioTracks()[0]?.getSettings().channelCount || 1
          );

          setLiveMetrics(metrics);
        }

        animationRef.current = requestAnimationFrame(updateLoop);
      };

      updateLoop();
    } catch (err: unknown) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setMicState('MIC_DENIED');
      } else {
        setMicState('MIC_ERROR');
      }
      stopMic();
    }
  }, [stopMic]);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return {
    micState,
    isMicActive: micState === 'MIC_ACTIVE',
    micAudioData,
    liveMetrics,
    sessionStartTime,
    startMic,
    stopMic,
  };
}
