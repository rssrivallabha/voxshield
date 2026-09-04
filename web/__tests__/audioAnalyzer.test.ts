import { describe, it, expect } from 'vitest';
import { calculateRealAudioMetrics } from '../lib/audio/audioAnalyzer';

describe('Live Audio Analyzer', () => {
  it('returns SILENT quality when given empty buffer', () => {
    const result = calculateRealAudioMetrics(new Float32Array(0));
    expect(result.qualityStatus).toBe('SILENT');
    expect(result.voiceActivity).toBe('SILENT');
    expect(result.clipping).toBe('NONE');
    expect(result.sampleRate).toBe(48000);
  });

  it('detects clipping when amplitude >= 0.98', () => {
    const buffer = new Float32Array(256).fill(0.99);
    const result = calculateRealAudioMetrics(buffer, 48000, 1);
    expect(result.clipping).toBe('CLIPPING_DETECTED');
    expect(result.qualityStatus).toBe('DEGRADED');
  });

  it('reports ACTIVE voice activity for audible signal', () => {
    const buffer = new Float32Array(256).fill(0.3);
    const result = calculateRealAudioMetrics(buffer, 48000, 1);
    expect(result.voiceActivity).toBe('ACTIVE');
    expect(result.signalLevelDbfs).toBeGreaterThan(-45);
  });

  it('reports SILENT for near-zero amplitude', () => {
    const buffer = new Float32Array(256);
    for (let i = 0; i < 256; i++) buffer[i] = 0.0001;
    const result = calculateRealAudioMetrics(buffer, 48000, 1);
    expect(result.voiceActivity).toBe('SILENT');
    expect(result.qualityStatus).toBe('SILENT');
  });

  it('handles Uint8Array time domain data', () => {
    const buffer = new Uint8Array(256).fill(200); // High amplitude in 0-255 range
    const result = calculateRealAudioMetrics(buffer, 48000, 1);
    expect(result.sampleRate).toBe(48000);
    expect(result.channels).toBe(1);
    expect(result.signalLevelDbfs).toBeGreaterThan(-50);
  });
});
