import { adaptBackendTelemetry } from '../lib/adapters/telemetryAdapter';

describe('live BACKEND inference sequence', () => {
  it('retains AVAILABLE RawNet2 output through a later risk.update', () => {
    const inference = {
      type: 'inference.update',
      session_id: 'browser_session',
      timestamp_ms: 100,
      speaker_verification: {
        similarity_score: null,
        confidence: null,
        status: 'NO_ENROLLED_IDENTITY',
        identity_id: 'unknown',
        latency_ms: 0,
      },
      synthetic_speech: {
        probability: 0,
        confidence: 1,
        status: 'AVAILABLE',
        model_id: 'rawnet2_pytorch',
        latency_ms: 250,
      },
      acoustic_analysis: {
        quality_status: 'PASS',
        quality_score: 1,
        voice_activity: true,
        spectral_anomaly: 0,
        clipping: false,
        latency_ms: 1,
      },
    };
    const risk = {
      type: 'risk.update',
      session_id: 'browser_session',
      timestamp_ms: 101,
      risk_state: 'TRUSTED',
      fused_risk_score: 0,
      confidence: 'HIGH',
      evidence: [{
        signal: 'Neural Synthetic Speech Detector',
        points: 0,
        status: 'ACTIVE',
        description: 'Synthetic probability: 0.0% (confidence: 100.0%)',
        severity: 'low',
      }],
      policy: null,
      recommended_action: null,
    };

    const frame = adaptBackendTelemetry({
      connectionStatus: 'CONNECTED',
      sessionId: 'browser_session',
      startedAt: 0,
      latestTelemetry: null,
      latestInference: inference as any,
      latestRisk: risk as any,
    });

    expect(frame.mlMetrics.syntheticProbPct).toBe(0);
    expect(frame.mlMetrics.syntheticProbText).toBe('0%');
    expect(frame.mlMetrics.speakerMatchText).toBe('NO ENROLLED IDENTITY');
    expect(frame.evidenceTimeline[0].description).toContain('Synthetic probability: 0.0%');
  });
});
