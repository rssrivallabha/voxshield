import { describe, it, expect } from 'vitest';
import { adaptSimulationFrame, adaptLiveAudioMetrics } from '../lib/adapters/telemetryAdapter';
import { VOICE_CLONE_SCENARIO } from '../lib/simulation/scenarioEngine';
import { calculateRealAudioMetrics } from '../lib/audio/audioAnalyzer';

describe('Telemetry Adapter Selection & Normalization', () => {
  it('adapts simulation frame with ML available and real speaker metrics', () => {
    const simFrame = VOICE_CLONE_SCENARIO[4]; // HIGH_RISK frame
    const adapted = adaptSimulationFrame(simFrame);

    expect(adapted.mode).toBe('SIMULATION');
    expect(adapted.modeBadgeLabel).toContain('SIMULATION');
    expect(adapted.isMlAvailable).toBe(true);
    expect(adapted.mlMetrics.speakerMatchPct).toBe(61);
    expect(adapted.mlMetrics.syntheticProbPct).toBe(87);
    expect(adapted.riskState).toBe('HIGH_RISK');
    expect(adapted.evidenceBreakdown.fusedRiskScore).toBe(84);
  });

  it('live input mode marks ML fields as AWAITING even when mic active', () => {
    const liveMetrics = calculateRealAudioMetrics(new Float32Array(256).fill(0.3), 48000, 1);
    const adapted = adaptLiveAudioMetrics(liveMetrics, 'MIC_ACTIVE', Date.now());

    expect(adapted.mode).toBe('LIVE_INPUT');
    expect(adapted.modeBadgeLabel).toContain('LIVE INPUT');
    expect(adapted.isMlAvailable).toBe(false);
    expect(adapted.mlMetrics.speakerMatchPct).toBeNull();
    expect(adapted.mlMetrics.syntheticProbPct).toBeNull();
    expect(adapted.mlMetrics.speakerMatchText).toBe('AWAITING ML INFERENCE');
    expect(adapted.mlMetrics.syntheticProbText).toBe('AWAITING ML INFERENCE');
    expect(adapted.mlMetrics.deepfakeStatusText).toBe('NOT AVAILABLE');
    expect(adapted.riskState).toBe('UNVERIFIED');
    expect(adapted.evidenceBreakdown.fusedRiskScore).toBeNull();
  });

  it('live input with inactive mic yields INSUFFICIENT_EVIDENCE risk state', () => {
    const adapted = adaptLiveAudioMetrics(null, 'STOPPED');
    expect(adapted.riskState).toBe('INSUFFICIENT_EVIDENCE');
    expect(adapted.mlMetrics.speakerMatchText).toBe('AWAITING ML INFERENCE');
    expect(adapted.audioMetrics.qualityStatus).toBe('INSUFFICIENT');
  });

  it('live input preserves measured acoustic telemetry values', () => {
    const liveMetrics = calculateRealAudioMetrics(new Float32Array(256).fill(0.55), 44100, 1);
    const adapted = adaptLiveAudioMetrics(liveMetrics, 'MIC_ACTIVE', Date.now());

    expect(adapted.audioMetrics.signalLevelDbfs).toBe(liveMetrics.signalLevelDbfs);
    expect(adapted.audioMetrics.peakDbfs).toBe(liveMetrics.peakDbfs);
    expect(adapted.audioMetrics.voiceActivity).toBe(liveMetrics.voiceActivity);
    expect(adapted.audioMetrics.clipping).toBe(liveMetrics.clipping);
    expect(adapted.audioMetrics.sampleRate).toBe(44100);
    expect(adapted.audioMetrics.channels).toBe(1);
  });
});
