import { RiskState } from '../../types/risk';
import { TelemetryFrame } from '../simulation/scenarioEngine';
import { LiveAudioMetrics } from '../audio/audioAnalyzer';
import { BackendTelemetryUpdate, BackendInferenceUpdate, BackendRiskUpdate } from '../backend/useBackendInference';

export type TelemetryMode = 'SIMULATION' | 'LIVE_INPUT' | 'BACKEND';

export type MicLifecycleState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'MIC_ACTIVE'
  | 'MIC_DENIED'
  | 'MIC_ERROR'
  | 'STOPPED';

export interface UnifiedTelemetryFrame {
  mode: TelemetryMode;
  modeBadgeLabel: string;
  isMlAvailable: boolean;
  timeLabel: string;
  phaseLabel: string;
  caller: {
    name: string;
    role: string;
    department: string;
    callerId: string;
    channel: string;
  };
  audioMetrics: {
    qualityStatus: 'PASS' | 'WARN' | 'DEGRADED' | 'SILENT' | 'FAIL' | 'INSUFFICIENT';
    snrDb: number | null;
    signalLevelDbfs: number | null;
    peakDbfs: number | null;
    voiceActivity: 'ACTIVE' | 'SILENT' | 'UNAVAILABLE';
    clipping: 'NONE' | 'CLIPPING_DETECTED' | 'UNAVAILABLE';
    sampleRate: number | null;
    channels: number | null;
  };
  mlMetrics: {
    speakerMatchPct: number | null;
    syntheticProbPct: number | null;
    speakerMatchText: string;
    syntheticProbText: string;
    deepfakeStatusText: string;
  };
  evidenceBreakdown: {
    syntheticVoicePoints: number | null;
    speakerMismatchPoints: number | null;
    acousticAnomalyPoints: number | null;
    contextualRiskPoints: number | null;
    fusedRiskScore: number | null;
  };
  riskState: RiskState;
  riskExplanation: string;
  evidenceTimeline: Array<{
    id: string;
    time: string;
    description: string;
    points: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  triggeredPolicy: {
    id: string;
    name: string;
    action: 'MONITOR' | 'CHALLENGE_2FA' | 'ROUTE_TO_HUMAN' | 'TERMINATE_CALL';
    status: 'INACTIVE' | 'TRIGGERED' | 'EXECUTED' | 'BLOCKED';
  } | null;
  recommendedAction: {
    type: 'VERIFY_CALLER' | 'TERMINATE_CALL' | 'MONITOR' | 'ESCALATE_ANALYST';
    title: string;
    description: string;
    requiresIntervention: boolean;
  } | null;
}

export interface BackendTelemetryState {
  sessionId: string | null;
  connectionStatus: 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED';
  latestTelemetry: BackendTelemetryUpdate | null;
  latestInference: BackendInferenceUpdate | null;
  latestRisk: BackendRiskUpdate | null;
  startedAt?: number;
}

function riskStateFromBackend(value: string | null | undefined): RiskState {
  const states: RiskState[] = [
    'TRUSTED', 'MONITOR', 'SUSPICIOUS', 'HIGH_RISK', 'CRITICAL', 'UNVERIFIED', 'INSUFFICIENT_EVIDENCE',
  ];
  return states.includes(value as RiskState) ? (value as RiskState) : 'INSUFFICIENT_EVIDENCE';
}

function actionTypeFromBackend(value: string | undefined): NonNullable<UnifiedTelemetryFrame['recommendedAction']>['type'] {
  if (value === 'VERIFY_CALLER' || value === 'TERMINATE_CALL' || value === 'ESCALATE_ANALYST') return value;
  return 'MONITOR';
}

function policyActionFromBackend(value: string): NonNullable<UnifiedTelemetryFrame['triggeredPolicy']>['action'] {
  if (value === 'TERMINATE_SESSION') return 'TERMINATE_CALL';
  if (value === 'REQUIRE_STEP_UP_VERIFICATION') return 'CHALLENGE_2FA';
  if (value === 'ROUTE_TO_ANALYST') return 'ROUTE_TO_HUMAN';
  return 'MONITOR';
}

export function adaptSimulationFrame(simFrame: TelemetryFrame): UnifiedTelemetryFrame {
  return {
    mode: 'SIMULATION',
    modeBadgeLabel: 'SIMULATION • SYNTHETIC TELEMETRY',
    isMlAvailable: true,
    timeLabel: `T+${simFrame.timeSeconds}s`,
    phaseLabel: simFrame.phaseLabel,
    caller: { ...simFrame.caller },
    audioMetrics: {
      qualityStatus: simFrame.metrics.audioQualityStatus,
      snrDb: simFrame.metrics.snrDb,
      signalLevelDbfs: -18.0,
      peakDbfs: -6.0,
      voiceActivity: 'ACTIVE',
      clipping: 'NONE',
      sampleRate: 48000,
      channels: 1,
    },
    mlMetrics: {
      speakerMatchPct: simFrame.metrics.speakerMatchPct,
      syntheticProbPct: simFrame.metrics.syntheticProbPct,
      speakerMatchText: `${simFrame.metrics.speakerMatchPct}%`,
      syntheticProbText: `${simFrame.metrics.syntheticProbPct}%`,
      deepfakeStatusText: `${simFrame.metrics.syntheticProbPct}% Likelihood`,
    },
    evidenceBreakdown: { ...simFrame.evidenceBreakdown },
    riskState: simFrame.riskState,
    riskExplanation: 'Deterministic simulation telemetry active for architecture demonstration.',
    evidenceTimeline: [...simFrame.evidenceTimeline],
    triggeredPolicy: simFrame.triggeredPolicy ? { ...simFrame.triggeredPolicy } : null,
    recommendedAction: simFrame.recommendedAction ? { ...simFrame.recommendedAction } : null,
  };
}

export function adaptLiveAudioMetrics(
  liveMetrics: LiveAudioMetrics | null,
  micState: MicLifecycleState,
  sessionStartTime?: number
): UnifiedTelemetryFrame {
  const elapsedSec = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
  const isMicActive = micState === 'MIC_ACTIVE';

  let phaseLabel = 'LIVE MICROPHONE IDLE';
  if (micState === 'REQUESTING_PERMISSION') phaseLabel = 'REQUESTING MIC PERMISSION';
  else if (micState === 'MIC_ACTIVE') {
    phaseLabel = liveMetrics?.voiceActivity === 'ACTIVE' ? 'LIVE AUDIO • VOICE DETECTED' : 'LIVE AUDIO • LISTENING';
  } else if (micState === 'MIC_DENIED') phaseLabel = 'MIC PERMISSION DENIED';
  else if (micState === 'MIC_ERROR') phaseLabel = 'MICROPHONE DEVICE ERROR';
  else if (micState === 'STOPPED') phaseLabel = 'MICROPHONE STOPPED';

  const riskState: RiskState = isMicActive ? 'UNVERIFIED' : 'INSUFFICIENT_EVIDENCE';

  const riskExplanation = isMicActive
    ? 'Live microphone audio captured locally. Neural speaker identity & voice clone verification require backend ML inference connection.'
    : 'Microphone stream inactive or unverified. Awaiting live audio input.';

  return {
    mode: 'LIVE_INPUT',
    modeBadgeLabel: 'LIVE INPUT • MICROPHONE',
    isMlAvailable: false,
    timeLabel: isMicActive ? `LIVE (${elapsedSec}s)` : 'STANDBY',
    phaseLabel,
    caller: {
      name: 'Local Presenter / Evaluator',
      role: 'Live Microphone Input',
      department: 'Local SOC Terminal',
      callerId: 'DEV_MIC_LOCAL_01',
      channel: 'WebAudio MediaStream',
    },
    audioMetrics: {
      qualityStatus: liveMetrics ? liveMetrics.qualityStatus : 'INSUFFICIENT',
      snrDb: liveMetrics ? liveMetrics.approxSnrDb : null,
      signalLevelDbfs: liveMetrics ? liveMetrics.signalLevelDbfs : null,
      peakDbfs: liveMetrics ? liveMetrics.peakDbfs : null,
      voiceActivity: liveMetrics ? liveMetrics.voiceActivity : 'UNAVAILABLE',
      clipping: liveMetrics ? liveMetrics.clipping : 'UNAVAILABLE',
      sampleRate: liveMetrics ? liveMetrics.sampleRate : null,
      channels: liveMetrics ? liveMetrics.channels : null,
    },
    mlMetrics: {
      speakerMatchPct: null,
      syntheticProbPct: null,
      speakerMatchText: 'AWAITING ML INFERENCE',
      syntheticProbText: 'AWAITING ML INFERENCE',
      deepfakeStatusText: 'NOT AVAILABLE',
    },
    evidenceBreakdown: {
      syntheticVoicePoints: null,
      speakerMismatchPoints: null,
      acousticAnomalyPoints: liveMetrics && liveMetrics.qualityStatus === 'DEGRADED' ? 15 : 0,
      contextualRiskPoints: 0,
      fusedRiskScore: null,
    },
    riskState,
    riskExplanation,
    evidenceTimeline: isMicActive
      ? [
          {
            id: 'ev_live_01',
            time: 'Live',
            description: `Microphone active (${liveMetrics?.sampleRate || 48000}Hz • ${liveMetrics?.channels || 1}ch)`,
            points: '+0 risk',
            severity: 'low',
          },
          {
            id: 'ev_live_02',
            time: 'Live',
            description: `Signal level: ${liveMetrics ? liveMetrics.signalLevelDbfs : '-'} dBFS (${liveMetrics?.voiceActivity || 'SILENT'})`,
            points: '+0 risk',
            severity: 'low',
          },
          {
            id: 'ev_live_03',
            time: 'Live',
            description: 'Neural Voice Clone Detector: AWAITING ML INFERENCE CONNECTION',
            points: 'UNVERIFIED',
            severity: 'medium',
          },
        ]
      : [
          {
            id: 'ev_live_idle',
            time: 'Standby',
            description: 'Microphone stream inactive. Click "Enable Microphone" to begin live audio analysis.',
            points: 'IDLE',
            severity: 'low',
          },
        ],
    triggeredPolicy: null,
    recommendedAction: isMicActive
      ? {
          type: 'MONITOR',
          title: 'Live Audio Stream Active',
          description: 'Acoustic metrics processed locally. Connect backend ML service for neural verification.',
          requiresIntervention: false,
        }
      : {
          type: 'MONITOR',
          title: 'Microphone Inactive',
          description: 'Click Enable Microphone to capture real audio telemetry.',
          requiresIntervention: false,
        },
  };
}

export function adaptBackendTelemetry(state: BackendTelemetryState): UnifiedTelemetryFrame {
  const { latestTelemetry, latestInference, latestRisk } = state;
  const audio = latestTelemetry?.audio_quality;
  const acoustic = latestInference?.acoustic_analysis;
  const speaker = latestInference?.speaker_verification;
  const synthetic = latestInference?.synthetic_speech;
  const riskState = riskStateFromBackend(latestRisk?.risk_state);
  const policy = latestRisk?.policy;
  const isConnected = state.connectionStatus === 'CONNECTED';
  const hasInference = Boolean(latestInference);
  const hasRisk = Boolean(latestRisk);

  const evidenceTimeline = latestRisk?.evidence?.map((evidence, index) => ({
    id: `backend-evidence-${index}-${latestRisk.timestamp_ms}`,
    time: new Date(latestRisk.timestamp_ms).toLocaleTimeString([], { hour12: false }),
    description: evidence.description,
    points: evidence.points === null ? evidence.status : `+${evidence.points}`,
    severity: (evidence.severity === 'critical' || evidence.severity === 'high' || evidence.severity === 'medium' ? evidence.severity : 'low') as 'low' | 'medium' | 'high' | 'critical',
  })) || [{
    id: 'backend-awaiting',
    time: 'Standby',
    description: isConnected ? 'Backend connected. Awaiting first audio inference frame.' : 'Backend inference service is not connected.',
    points: isConnected ? 'AWAITING' : 'OFFLINE',
    severity: 'low' as const,
  }];

  return {
    mode: 'BACKEND',
    modeBadgeLabel: 'BACKEND • LIVE INFERENCE',
    isMlAvailable: hasInference && (synthetic?.status === 'AVAILABLE' || speaker?.status === 'AVAILABLE'),
    timeLabel: state.startedAt ? `LIVE (${Math.floor((Date.now() - state.startedAt) / 1000)}s)` : 'STANDBY',
    phaseLabel: latestRisk ? `RISK ENGINE • ${riskState}` : isConnected ? 'BACKEND CONNECTED • PROCESSING AUDIO' : 'BACKEND DISCONNECTED',
    caller: {
      name: 'Live Microphone Session',
      role: 'Backend Inference Stream',
      department: 'VoxShield Analysis Service',
      callerId: state.sessionId || 'BACKEND_SESSION_PENDING',
      channel: 'WebSocket /ws/v1/voice-analysis',
    },
    audioMetrics: {
      qualityStatus: (audio?.status || acoustic?.quality_status || 'INSUFFICIENT') as UnifiedTelemetryFrame['audioMetrics']['qualityStatus'],
      snrDb: audio?.noise_margin_db ?? null,
      signalLevelDbfs: audio?.rms_dbfs ?? null,
      peakDbfs: audio?.peak_dbfs ?? null,
      voiceActivity: audio ? (audio.is_silence ? 'SILENT' : 'ACTIVE') : acoustic ? (acoustic.voice_activity ? 'ACTIVE' : 'SILENT') : 'UNAVAILABLE',
      clipping: audio ? (audio.clipping ? 'CLIPPING_DETECTED' : 'NONE') : acoustic ? (acoustic.clipping ? 'CLIPPING_DETECTED' : 'NONE') : 'UNAVAILABLE',
      sampleRate: latestTelemetry?.acoustic_metrics.sample_rate ?? null,
      channels: 1,
    },
    mlMetrics: {
      speakerMatchPct: speaker?.similarity_score !== null && speaker?.similarity_score !== undefined ? Math.round(speaker.similarity_score * 100) : null,
      syntheticProbPct: synthetic?.status === 'AVAILABLE' ? Math.round(synthetic.probability * 100) : null,
      speakerMatchText: speaker?.status === 'AVAILABLE' && speaker.similarity_score !== null ? `${Math.round(speaker.similarity_score * 100)}%` : speaker?.status === 'NO_ENROLLED_IDENTITY' ? 'NO ENROLLED IDENTITY' : 'MODEL UNAVAILABLE',
      syntheticProbText: synthetic?.status === 'AVAILABLE' ? `${Math.round(synthetic.probability * 100)}%` : synthetic?.status === 'INSUFFICIENT_AUDIO' ? 'INSUFFICIENT AUDIO' : 'MODEL UNAVAILABLE',
      deepfakeStatusText: synthetic?.status === 'AVAILABLE' ? `${Math.round(synthetic.probability * 100)}% Likelihood` : 'MODEL UNAVAILABLE',
    },
    evidenceBreakdown: {
      syntheticVoicePoints: latestRisk?.evidence.find((e) => e.signal.toLowerCase().includes('synthetic'))?.points ?? null,
      speakerMismatchPoints: latestRisk?.evidence.find((e) => e.signal.toLowerCase().includes('speaker'))?.points ?? null,
      acousticAnomalyPoints: latestRisk?.evidence.find((e) => e.signal.toLowerCase().includes('acoustic'))?.points ?? 0,
      contextualRiskPoints: latestRisk?.evidence.find((e) => e.signal.toLowerCase().includes('context'))?.points ?? 0,
      fusedRiskScore: latestRisk?.fused_risk_score ?? null,
    },
    riskState: hasRisk ? riskState : 'INSUFFICIENT_EVIDENCE',
    riskExplanation: latestRisk?.risk_state
      ? `Server-authoritative risk decision: ${latestRisk.risk_state}. ${latestRisk.recommended_action?.description || 'Evidence evaluated by backend risk engine.'}`
      : 'Backend connected. Awaiting server-authoritative risk decision.',
    evidenceTimeline,
    triggeredPolicy: policy
      ? {
          id: policy.policy_id,
          name: policy.policy_name,
          action: policyActionFromBackend(policy.action),
          status: policy.action === 'TERMINATE_SESSION' ? 'EXECUTED' : 'TRIGGERED',
        }
      : null,
    recommendedAction: latestRisk?.recommended_action
      ? {
          type: actionTypeFromBackend(latestRisk.recommended_action.type),
          title: latestRisk.recommended_action.title,
          description: latestRisk.recommended_action.description,
          requiresIntervention: latestRisk.recommended_action.requires_intervention,
        }
      : {
          type: 'MONITOR',
          title: isConnected ? 'Awaiting Backend Decision' : 'Backend Unavailable',
          description: isConnected ? 'The backend is processing audio. No risk decision has been received yet.' : 'Start the FastAPI backend to enable real-time server inference.',
          requiresIntervention: false,
        },
  };
}
