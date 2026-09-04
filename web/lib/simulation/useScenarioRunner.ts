import { useState, useEffect, useCallback, useRef } from 'react';
import { TelemetryFrame, VOICE_CLONE_SCENARIO, TRUSTED_CALL_SCENARIO, ScenarioType } from './scenarioEngine';

export interface ScenarioRunnerState {
  scenarioType: ScenarioType;
  isPlaying: boolean;
  stepIndex: number;
  currentFrame: TelemetryFrame;
  history: Array<{ timeSeconds: number; fusedRiskScore: number; riskState: string }>;
  interventionState: 'NONE' | 'CHALLENGED' | 'TERMINATED' | 'ESCALATED';
}

export function useScenarioRunner(initialScenario: ScenarioType = 'VOICE_CLONE_ATTACK') {
  const [scenarioType, setScenarioType] = useState<ScenarioType>(initialScenario);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [interventionState, setInterventionState] = useState<'NONE' | 'CHALLENGED' | 'TERMINATED' | 'ESCALATED'>('NONE');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scenarioFrames = scenarioType === 'VOICE_CLONE_ATTACK' ? VOICE_CLONE_SCENARIO : TRUSTED_CALL_SCENARIO;
  const currentFrame = scenarioFrames[stepIndex] || scenarioFrames[scenarioFrames.length - 1];

  const [history, setHistory] = useState<Array<{ timeSeconds: number; fusedRiskScore: number; riskState: string }>>([
    {
      timeSeconds: currentFrame.timeSeconds,
      fusedRiskScore: currentFrame.evidenceBreakdown.fusedRiskScore,
      riskState: currentFrame.riskState,
    },
  ]);

  const resetScenario = useCallback((newType?: ScenarioType) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const targetType = newType || scenarioType;
    if (newType) setScenarioType(newType);
    setStepIndex(0);
    setIsPlaying(false);
    setInterventionState('NONE');
    const initialFrame = targetType === 'VOICE_CLONE_ATTACK' ? VOICE_CLONE_SCENARIO[0] : TRUSTED_CALL_SCENARIO[0];
    setHistory([
      {
        timeSeconds: initialFrame.timeSeconds,
        fusedRiskScore: initialFrame.evidenceBreakdown.fusedRiskScore,
        riskState: initialFrame.riskState,
      },
    ]);
  }, [scenarioType]);

  const startScenario = useCallback((type?: ScenarioType) => {
    resetScenario(type);
    setIsPlaying(true);
  }, [resetScenario]);

  const pauseScenario = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resumeScenario = useCallback(() => {
    if (stepIndex < scenarioFrames.length - 1) {
      setIsPlaying(true);
    }
  }, [stepIndex, scenarioFrames.length]);

  const triggerIntervention = useCallback((action: 'CHALLENGED' | 'TERMINATED' | 'ESCALATED') => {
    setInterventionState(action);
    pauseScenario();
  }, [pauseScenario]);

  useEffect(() => {
    if (!isPlaying) return;

    timerRef.current = setInterval(() => {
      setStepIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (nextIndex >= scenarioFrames.length) {
          setIsPlaying(false);
          if (timerRef.current) clearInterval(timerRef.current);
          return prevIndex;
        }

        const nextFrame = scenarioFrames[nextIndex];
        setHistory((prevHistory) => [
          ...prevHistory,
          {
            timeSeconds: nextFrame.timeSeconds,
            fusedRiskScore: nextFrame.evidenceBreakdown.fusedRiskScore,
            riskState: nextFrame.riskState,
          },
        ]);

        return nextIndex;
      });
    }, 2200); // 2.2s per telemetry step transition

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, scenarioFrames]);

  return {
    scenarioType,
    isPlaying,
    stepIndex,
    totalSteps: scenarioFrames.length,
    currentFrame,
    history,
    interventionState,
    startScenario,
    pauseScenario,
    resumeScenario,
    resetScenario,
    triggerIntervention,
  };
}
