import { useState, useEffect, useRef, useCallback } from 'react';
import { envConfig } from '../config/env';

export interface BackendTelemetryUpdate {
  type: 'telemetry.update'; session_id: string; timestamp_ms: number; sequence_ack: number;
  audio_quality: { status: string; rms_dbfs: number; peak_dbfs: number; is_silence: boolean; clipping: boolean; noise_margin_db: number };
  acoustic_metrics: { duration_ms: number; sample_rate: number; total_samples: number; preprocessing_latency_ms: number };
}
export interface BackendInferenceUpdate {
  type: 'inference.update'; session_id: string; timestamp_ms: number;
  speaker_verification: { similarity_score: number | null; confidence: number | null; status: string; identity_id: string; latency_ms: number };
  synthetic_speech: { probability: number; confidence: number; status: string; model_id: string; latency_ms: number };
  acoustic_analysis: { quality_status: string; quality_score: number; voice_activity: boolean; spectral_anomaly: number; clipping: boolean; latency_ms: number };
  raw_synthetic_probability: number | null;
  accumulated_synthetic_evidence: number | null;
  speaker_verification_evidence: number | null;
}
export interface BackendRiskUpdate {
  type: 'risk.update'; session_id: string; timestamp_ms: number; risk_state: string; fused_risk_score: number | null; confidence: string;
  evidence: Array<{ signal: string; points: number | null; status: string; description: string; severity: string }>;
  policy: { policy_id: string; policy_name: string; action: string; reason: string; timestamp_ms: number; session_id: string; severity: string } | null;
  recommended_action: { type: string; title: string; description: string; requires_intervention: boolean } | null;
}
export interface BackendErrorEvent { type: 'error'; session_id: string; code: string; message: string }
type ServerEvent = BackendTelemetryUpdate | BackendInferenceUpdate | BackendRiskUpdate | BackendErrorEvent | { type: 'session.started'; session_id: string } | { type: 'session.stopped'; session_id: string };
export interface BackendConnectionState { status: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED'; sessionId: string | null; error: string | null }
export interface BackendRiskHistoryPoint { timestamp_ms: number; fused_risk_score: number | null; risk_state: string }

export function useBackendInference(identityId?: string) {
  const [connectionState, setConnectionState] = useState<BackendConnectionState>({ status: 'IDLE', sessionId: null, error: null });
  const [lastTelemetry, setLastTelemetry] = useState<BackendTelemetryUpdate | null>(null);
  const [lastInference, setLastInference] = useState<BackendInferenceUpdate | null>(null);
  const [lastRisk, setLastRisk] = useState<BackendRiskUpdate | null>(null);
  const [riskHistory, setRiskHistory] = useState<BackendRiskHistoryPoint[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sequenceRef = useRef(0);
  const sessionIdRef = useRef(`sess_${Math.random().toString(36).slice(2, 14)}`);

  const stopAudioCapture = useCallback(() => {
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    processorRef.current?.disconnect();
    analyserRef.current?.disconnect();
    if (contextRef.current && contextRef.current.state !== 'closed') contextRef.current.close().catch(() => {});
    streamRef.current?.getTracks().forEach((track) => track.stop());
    sendIntervalRef.current = null; animationRef.current = null; processorRef.current = null; analyserRef.current = null; contextRef.current = null; streamRef.current = null;
    chunksRef.current = []; sequenceRef.current = 0; setAudioData(null);
  }, []);

  const disconnect = useCallback(() => {
    stopAudioCapture();
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.stop', session_id: sessionIdRef.current }));
    ws?.close(); wsRef.current = null;
    activeSessionIdRef.current = null;
    setConnectionState({ status: 'IDLE', sessionId: null, error: null });
    setLastTelemetry(null); setLastInference(null); setLastRisk(null); setRiskHistory([]);
  }, [stopAudioCapture]);

  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass(); contextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8; analyserRef.current = analyser;
      const processor = context.createScriptProcessor(1024, 1, 1); processorRef.current = processor;
      source.connect(analyser); source.connect(processor); processor.connect(context.destination);
      processor.onaudioprocess = (event) => { chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0))); };
      const spectrum = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => { if (!analyserRef.current) return; analyserRef.current.getByteFrequencyData(spectrum); setAudioData(new Uint8Array(spectrum)); animationRef.current = requestAnimationFrame(draw); };
      draw();
      sendIntervalRef.current = setInterval(() => {
        if (chunksRef.current.length === 0 || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const length = chunksRef.current.reduce((total, chunk) => total + chunk.length, 0);
        const samples = new Float32Array(length); let offset = 0;
        chunksRef.current.forEach((chunk) => { samples.set(chunk, offset); offset += chunk.length; }); chunksRef.current = [];
        const bytes = new Uint8Array(samples.buffer.slice(0));
        let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
        wsRef.current?.send(JSON.stringify({ type: 'audio.chunk', session_id: sessionIdRef.current, sequence_number: ++sequenceRef.current, timestamp_ms: Date.now(), sample_rate: context.sampleRate, channels: 1, encoding: 'pcm_f32le', payload_b64: btoa(binary), chunk_duration_ms: (samples.length / context.sampleRate) * 1000 }));
      }, 100);
    } catch (error) { setConnectionState((previous) => ({ ...previous, status: 'ERROR', error: error instanceof Error ? `Microphone unavailable: ${error.message}` : 'Microphone unavailable' })); stopAudioCapture(); }
  }, [stopAudioCapture]);

  const startStreaming = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnectionState({ status: 'CONNECTING', sessionId: null, error: null });
    const sessionId = `sess_${Math.random().toString(36).slice(2, 14)}`;
    sessionIdRef.current = sessionId;
    activeSessionIdRef.current = sessionId;
    setLastTelemetry(null);
    setLastInference(null);
    setLastRisk(null);
    const endpoint = `${envConfig.wsUrl.replace(/\/$/, '')}/voice-analysis/${sessionId}`;
    const ws = new WebSocket(endpoint); wsRef.current = ws;
    ws.onopen = () => { setConnectionState({ status: 'CONNECTED', sessionId, error: null }); ws.send(JSON.stringify({ type: 'session.start', session_id: sessionId, sample_rate: 16000, channels: 1, identity_id: identityId })); void startAudioCapture(); };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerEvent;
        if ('session_id' in message && message.session_id !== activeSessionIdRef.current) return;
        if (message.type === 'telemetry.update') setLastTelemetry(message);
        else if (message.type === 'inference.update') {
          setLastInference((previous) => {
            if (previous?.session_id === message.session_id && previous.timestamp_ms > message.timestamp_ms) return previous;
            return message;
          });
        } else if (message.type === 'risk.update') {
          setLastRisk((previous) => {
            if (previous?.session_id === message.session_id && previous.timestamp_ms > message.timestamp_ms) return previous;
            return message;
          });
          setRiskHistory((previous) => [...previous, {
            timestamp_ms: message.timestamp_ms,
            fused_risk_score: message.fused_risk_score,
            risk_state: message.risk_state,
          }].slice(-120));
        } else if (message.type === 'error') {
          setConnectionState((previous) => ({ ...previous, status: 'ERROR', error: `${message.code}: ${message.message}` }));
        }
      } catch {
        setConnectionState((previous) => ({ ...previous, status: 'ERROR', error: 'Malformed backend event' }));
      }
    };
    ws.onerror = () => setConnectionState((previous) => ({ ...previous, status: 'ERROR', error: 'WebSocket connection error' }));
    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      activeSessionIdRef.current = null;
      stopAudioCapture();
      setConnectionState((previous) => previous.status === 'ERROR' ? previous : { ...previous, status: 'DISCONNECTED' });
    };
  }, [identityId, startAudioCapture, stopAudioCapture]);

  useEffect(() => () => { disconnect(); }, [disconnect]);
  return { connectionState, lastTelemetry, lastInference, lastRisk, riskHistory, audioData, startStreaming, stopStreaming: disconnect, sessionId: sessionIdRef.current };
}