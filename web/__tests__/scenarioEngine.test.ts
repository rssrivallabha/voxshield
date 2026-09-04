import { describe, it, expect } from 'vitest';
import { VOICE_CLONE_SCENARIO, TRUSTED_CALL_SCENARIO } from '../lib/simulation/scenarioEngine';

describe('Scenario Engine & Risk Escalation State Machine', () => {
  it('VOICE_CLONE_SCENARIO starts in TRUSTED state and escalates to CRITICAL', () => {
    const initialFrame = VOICE_CLONE_SCENARIO[0];
    const finalFrame = VOICE_CLONE_SCENARIO[VOICE_CLONE_SCENARIO.length - 1];

    expect(initialFrame.riskState).toBe('TRUSTED');
    expect(initialFrame.evidenceBreakdown.fusedRiskScore).toBeLessThan(20);

    expect(finalFrame.riskState).toBe('CRITICAL');
    expect(finalFrame.evidenceBreakdown.fusedRiskScore).toBeGreaterThanOrEqual(80);
    expect(finalFrame.triggeredPolicy?.action).toBe('TERMINATE_CALL');
  });

  it('multi-signal evidence breakdown correctly sums to fused risk score in attack scenario', () => {
    VOICE_CLONE_SCENARIO.forEach((frame) => {
      const { syntheticVoicePoints, speakerMismatchPoints, acousticAnomalyPoints, contextualRiskPoints, fusedRiskScore } =
        frame.evidenceBreakdown;

      const sum = syntheticVoicePoints + speakerMismatchPoints + acousticAnomalyPoints + contextualRiskPoints;
      expect(fusedRiskScore).toBe(sum);
    });
  });

  it('TRUSTED_CALL_SCENARIO remains TRUSTED with low fused risk throughout', () => {
    TRUSTED_CALL_SCENARIO.forEach((frame) => {
      expect(frame.riskState).toBe('TRUSTED');
      expect(frame.metrics.syntheticProbPct).toBeLessThan(10);
      expect(frame.metrics.speakerMatchPct).toBeGreaterThan(90);
      expect(frame.evidenceBreakdown.fusedRiskScore).toBeLessThan(20);
    });
  });
});
