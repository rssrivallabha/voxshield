import { adaptBackendTelemetry } from '../lib/adapters/telemetryAdapter';

describe('BACKEND mapping: syntheticProbText reflects AVAILABLE even with speaker NO_ENROLLED_IDENTITY', () => {
  it('uses synthetic_speech.status to map syntheticProbText', () => {
    const payload = {
      type: 'inference.update',
      session_id: 's1',
      timestamp_ms: 0,
      speaker_verification: {
        similarity_score: null,
        confidence: null,
        status: 'NO_ENROLLED_IDENTITY',
        identity_id: 'unknown',
        latency_ms: 0,
      },
      synthetic_speech: {
        probability: 0.0,
        confidence: 1.0,
        status: 'AVAILABLE',
        model_id: 'rawnet2_pytorch',
        latency_ms: 10,
      },
      acoustic_analysis: {
        quality_status: 'PASS',
        quality_score: 1.0,
        voice_activity: true,
        spectral_anomaly: 0.0,
        clipping: false,
        latency_ms: 1,
      },
    };

    const frame = adaptBackendTelemetry({
      connectionStatus: 'CONNECTED',
      sessionId: 's1',
      latestTelemetry: {
        type: 'telemetry.update',
        session_id: 's1',
        timestamp_ms: 0,
        sequence_ack: 1,
        audio_quality: {
          status: 'PASS',
          rms_dbfs: -20,
          peak_dbfs: -7.6,
          is_silence: false,
          clipping: false,
          noise_margin_db: 40,
        },
        acoustic_metrics: {
          duration_ms: 1000,
          sample_rate: 16000,
          total_samples: 2048,
          preprocessing_latency_ms: 1,
        },
      } as any,
      latestInference: payload as any,
      latestRisk: {
        type: 'risk.update',
        session_id: 's1',
        timestamp_ms: 0,
        risk_state: 'TRUSTED',
        fused_risk_score: 0.0,
        confidence: 'HIGH',
        evidence: [],
        policy: null,
        recommended_action: null,
      } as any,
      startedAt: Date.now(),
    } as any);

    expect(frame.mlMetrics.syntheticProbText).toContain('%');
    expect(frame.mlMetrics.syntheticProbText).not.toContain('MODEL UNAVAILABLE');
  });
});
