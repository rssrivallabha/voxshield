import { RiskState, ConfidenceLevel } from '../../types/risk';

export interface EvidenceTimelineEvent {
  id: string;
  time: string;
  description: string;
  points: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TelemetryFrame {
  stepIndex: number;
  timeSeconds: number;
  phaseLabel: string;
  caller: {
    name: string;
    role: string;
    department: string;
    callerId: string;
    channel: string;
  };
  metrics: {
    speakerMatchPct: number;
    syntheticProbPct: number;
    audioQualityScore: number;
    audioQualityStatus: 'PASS' | 'WARN' | 'FAIL' | 'INSUFFICIENT';
    snrDb: number;
    packetLossPct: number;
    latencyMs: number;
  };
  evidenceBreakdown: {
    syntheticVoicePoints: number;
    speakerMismatchPoints: number;
    acousticAnomalyPoints: number;
    contextualRiskPoints: number;
    fusedRiskScore: number;
  };
  riskState: RiskState;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  anomalies: {
    acousticAnomaly: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    codecAnomaly: boolean;
    voiceprintMismatch: boolean;
  };
  evidenceTimeline: EvidenceTimelineEvent[];
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

export type ScenarioType = 'VOICE_CLONE_ATTACK' | 'TRUSTED_CALL';

export const VOICE_CLONE_SCENARIO: TelemetryFrame[] = [
  {
    stepIndex: 0,
    timeSeconds: 0,
    phaseLabel: 'CALL CONNECTED',
    caller: {
      name: 'Eleanor Vance',
      role: 'VP Treasury',
      department: 'Executive Finance',
      callerId: '+1 (555) 019-2834',
      channel: 'WebRTC Secure Desk',
    },
    metrics: {
      speakerMatchPct: 96,
      syntheticProbPct: 4,
      audioQualityScore: 92,
      audioQualityStatus: 'PASS',
      snrDb: 32,
      packetLossPct: 0.1,
      latencyMs: 12,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 4,
      speakerMismatchPoints: 4,
      acousticAnomalyPoints: 4,
      contextualRiskPoints: 0,
      fusedRiskScore: 12,
    },
    riskState: 'TRUSTED',
    confidence: 'HIGH',
    confidenceScore: 0.96,
    anomalies: {
      acousticAnomaly: 'NORMAL',
      codecAnomaly: false,
      voiceprintMismatch: false,
    },
    evidenceTimeline: [
      {
        id: 'ev_100',
        time: '00:00',
        description: 'Session initiated & voice profile matched',
        points: '+0 risk',
        severity: 'low',
      },
    ],
    triggeredPolicy: null,
    recommendedAction: {
      type: 'MONITOR',
      title: 'Standard Monitoring',
      description: 'Voice characteristics within nominal security threshold.',
      requiresIntervention: false,
    },
  },
  {
    stepIndex: 1,
    timeSeconds: 2,
    phaseLabel: 'ANALYZING VOICE',
    caller: {
      name: 'Eleanor Vance',
      role: 'VP Treasury',
      department: 'Executive Finance',
      callerId: '+1 (555) 019-2834',
      channel: 'WebRTC Secure Desk',
    },
    metrics: {
      speakerMatchPct: 94,
      syntheticProbPct: 8,
      audioQualityScore: 90,
      audioQualityStatus: 'PASS',
      snrDb: 30,
      packetLossPct: 0.15,
      latencyMs: 13,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 4,
      speakerMismatchPoints: 6,
      acousticAnomalyPoints: 8,
      contextualRiskPoints: 0,
      fusedRiskScore: 18,
    },
    riskState: 'TRUSTED',
    confidence: 'HIGH',
    confidenceScore: 0.94,
    anomalies: {
      acousticAnomaly: 'NORMAL',
      codecAnomaly: false,
      voiceprintMismatch: false,
    },
    evidenceTimeline: [
      {
        id: 'ev_100',
        time: '00:00',
        description: 'Session initiated & voice profile matched',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_101',
        time: '00:02',
        description: 'Audio quality verified (SNR 30dB)',
        points: '+0 risk',
        severity: 'low',
      },
    ],
    triggeredPolicy: null,
    recommendedAction: {
      type: 'MONITOR',
      title: 'Standard Monitoring',
      description: 'Voice characteristics within nominal security threshold.',
      requiresIntervention: false,
    },
  },
  {
    stepIndex: 2,
    timeSeconds: 4,
    phaseLabel: 'ACOUSTIC ANOMALY DETECTED',
    caller: {
      name: 'Eleanor Vance',
      role: 'VP Treasury',
      department: 'Executive Finance',
      callerId: '+1 (555) 019-2834',
      channel: 'WebRTC Secure Desk',
    },
    metrics: {
      speakerMatchPct: 88,
      syntheticProbPct: 28,
      audioQualityScore: 84,
      audioQualityStatus: 'PASS',
      snrDb: 26,
      packetLossPct: 0.3,
      latencyMs: 14,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 12,
      speakerMismatchPoints: 6,
      acousticAnomalyPoints: 18,
      contextualRiskPoints: 0,
      fusedRiskScore: 36,
    },
    riskState: 'MONITOR',
    confidence: 'MEDIUM',
    confidenceScore: 0.84,
    anomalies: {
      acousticAnomaly: 'ELEVATED',
      codecAnomaly: true,
      voiceprintMismatch: false,
    },
    evidenceTimeline: [
      {
        id: 'ev_100',
        time: '00:00',
        description: 'Session initiated & voice profile matched',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_101',
        time: '00:02',
        description: 'Audio quality verified (SNR 30dB)',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_102',
        time: '00:04',
        description: 'Acoustic anomaly: Phase spectrum distortion in F1/F2 band',
        points: '+18 risk',
        severity: 'medium',
      },
    ],
    triggeredPolicy: null,
    recommendedAction: {
      type: 'MONITOR',
      title: 'Elevate Monitoring Level',
      description: 'Spectral anomaly detected. Observing vocal tract consistency.',
      requiresIntervention: false,
    },
  },
  {
    stepIndex: 3,
    timeSeconds: 6,
    phaseLabel: 'SPEAKER MISMATCH IDENTIFIED',
    caller: {
      name: 'Eleanor Vance',
      role: 'VP Treasury',
      department: 'Executive Finance',
      callerId: '+1 (555) 019-2834',
      channel: 'WebRTC Secure Desk',
    },
    metrics: {
      speakerMatchPct: 72,
      syntheticProbPct: 62,
      audioQualityScore: 80,
      audioQualityStatus: 'PASS',
      snrDb: 24,
      packetLossPct: 0.4,
      latencyMs: 15,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 24,
      speakerMismatchPoints: 20,
      acousticAnomalyPoints: 18,
      contextualRiskPoints: 6,
      fusedRiskScore: 68,
    },
    riskState: 'SUSPICIOUS',
    confidence: 'HIGH',
    confidenceScore: 0.88,
    anomalies: {
      acousticAnomaly: 'HIGH',
      codecAnomaly: true,
      voiceprintMismatch: true,
    },
    evidenceTimeline: [
      {
        id: 'ev_100',
        time: '00:00',
        description: 'Session initiated & voice profile matched',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_101',
        time: '00:02',
        description: 'Audio quality verified (SNR 30dB)',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_102',
        time: '00:04',
        description: 'Acoustic anomaly: Phase spectrum distortion in F1/F2 band',
        points: '+18 risk',
        severity: 'medium',
      },
      {
        id: 'ev_103',
        time: '00:06',
        description: 'Speaker embedding mismatch: Expected >0.85, observed 0.72',
        points: '+24 risk',
        severity: 'high',
      },
    ],
    triggeredPolicy: {
      id: 'pol_sec_03',
      name: 'Suspicious Route to SOC Specialist',
      action: 'ROUTE_TO_HUMAN',
      status: 'TRIGGERED',
    },
    recommendedAction: {
      type: 'VERIFY_CALLER',
      title: 'Verify Caller Identity',
      description: 'Speaker mismatch detected during active conversation.',
      requiresIntervention: true,
    },
  },
  {
    stepIndex: 4,
    timeSeconds: 8,
    phaseLabel: 'SYNTHETIC VOICE CONFIRMED',
    caller: {
      name: 'Eleanor Vance',
      role: 'VP Treasury',
      department: 'Executive Finance',
      callerId: '+1 (555) 019-2834',
      channel: 'WebRTC Secure Desk',
    },
    metrics: {
      speakerMatchPct: 61,
      syntheticProbPct: 87,
      audioQualityScore: 78,
      audioQualityStatus: 'PASS',
      snrDb: 22,
      packetLossPct: 0.5,
      latencyMs: 16,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 34,
      speakerMismatchPoints: 20,
      acousticAnomalyPoints: 18,
      contextualRiskPoints: 12,
      fusedRiskScore: 84,
    },
    riskState: 'HIGH_RISK',
    confidence: 'HIGH',
    confidenceScore: 0.94,
    anomalies: {
      acousticAnomaly: 'CRITICAL',
      codecAnomaly: true,
      voiceprintMismatch: true,
    },
    evidenceTimeline: [
      {
        id: 'ev_100',
        time: '00:00',
        description: 'Session initiated & voice profile matched',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_101',
        time: '00:02',
        description: 'Audio quality verified (SNR 30dB)',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_102',
        time: '00:04',
        description: 'Acoustic anomaly: Phase spectrum distortion in F1/F2 band',
        points: '+18 risk',
        severity: 'medium',
      },
      {
        id: 'ev_103',
        time: '00:06',
        description: 'Speaker embedding mismatch: Expected >0.85, observed 0.72',
        points: '+24 risk',
        severity: 'high',
      },
      {
        id: 'ev_104',
        time: '00:08',
        description: 'Neural Classifier: 87% synthetic speech likelihood',
        points: '+38 risk',
        severity: 'critical',
      },
      {
        id: 'ev_105',
        time: '00:08',
        description: 'Contextual risk: Urgent wire transfer request detected',
        points: '+12 risk',
        severity: 'medium',
      },
    ],
    triggeredPolicy: {
      id: 'pol_sec_01',
      name: 'Automatic High-Risk Challenge',
      action: 'CHALLENGE_2FA',
      status: 'TRIGGERED',
    },
    recommendedAction: {
      type: 'VERIFY_CALLER',
      title: 'Initiate Out-of-Band 2FA Challenge',
      description: 'High risk of synthetic impersonation. Issue secondary identity verification.',
      requiresIntervention: true,
    },
  },
  {
    stepIndex: 5,
    timeSeconds: 10,
    phaseLabel: 'CRITICAL THREAT — POLICY INTERVENTION',
    caller: {
      name: 'Eleanor Vance',
      role: 'VP Treasury',
      department: 'Executive Finance',
      callerId: '+1 (555) 019-2834',
      channel: 'WebRTC Secure Desk',
    },
    metrics: {
      speakerMatchPct: 52,
      syntheticProbPct: 96,
      audioQualityScore: 76,
      audioQualityStatus: 'PASS',
      snrDb: 21,
      packetLossPct: 0.6,
      latencyMs: 16,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 42,
      speakerMismatchPoints: 31,
      acousticAnomalyPoints: 18,
      contextualRiskPoints: 12,
      fusedRiskScore: 103,
    },
    riskState: 'CRITICAL',
    confidence: 'HIGH',
    confidenceScore: 0.98,
    anomalies: {
      acousticAnomaly: 'CRITICAL',
      codecAnomaly: true,
      voiceprintMismatch: true,
    },
    evidenceTimeline: [
      {
        id: 'ev_100',
        time: '00:00',
        description: 'Session initiated & voice profile matched',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_101',
        time: '00:02',
        description: 'Audio quality verified (SNR 30dB)',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_102',
        time: '00:04',
        description: 'Acoustic anomaly: Phase spectrum distortion in F1/F2 band',
        points: '+18 risk',
        severity: 'medium',
      },
      {
        id: 'ev_103',
        time: '00:06',
        description: 'Speaker embedding mismatch: Expected >0.85, observed 0.72',
        points: '+24 risk',
        severity: 'high',
      },
      {
        id: 'ev_104',
        time: '00:08',
        description: 'Neural Classifier: 87% synthetic speech likelihood',
        points: '+38 risk',
        severity: 'critical',
      },
      {
        id: 'ev_105',
        time: '00:08',
        description: 'Contextual risk: Urgent wire transfer request detected',
        points: '+12 risk',
        severity: 'medium',
      },
      {
        id: 'ev_106',
        time: '00:10',
        description: 'Policy threshold exceeded -> CRITICAL_IMPERSONATION_TERMINATION',
        points: 'ACTION',
        severity: 'critical',
      },
    ],
    triggeredPolicy: {
      id: 'pol_sec_02',
      name: 'Critical Impersonation Termination',
      action: 'TERMINATE_CALL',
      status: 'EXECUTED',
    },
    recommendedAction: {
      type: 'TERMINATE_CALL',
      title: 'Terminate Connection & Lock Account',
      description: 'Confirmed voice cloning attack targeting financial authorization desk.',
      requiresIntervention: true,
    },
  },
];

export const TRUSTED_CALL_SCENARIO: TelemetryFrame[] = [
  {
    stepIndex: 0,
    timeSeconds: 0,
    phaseLabel: 'CALL CONNECTED',
    caller: {
      name: 'David Miller',
      role: 'Chief Architect',
      department: 'Technology',
      callerId: '+1 (555) 014-9921',
      channel: 'Customer Support Line A',
    },
    metrics: {
      speakerMatchPct: 98,
      syntheticProbPct: 2,
      audioQualityScore: 95,
      audioQualityStatus: 'PASS',
      snrDb: 35,
      packetLossPct: 0.05,
      latencyMs: 9,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 2,
      speakerMismatchPoints: 2,
      acousticAnomalyPoints: 4,
      contextualRiskPoints: 0,
      fusedRiskScore: 8,
    },
    riskState: 'TRUSTED',
    confidence: 'HIGH',
    confidenceScore: 0.99,
    anomalies: {
      acousticAnomaly: 'NORMAL',
      codecAnomaly: false,
      voiceprintMismatch: false,
    },
    evidenceTimeline: [
      {
        id: 'ev_200',
        time: '00:00',
        description: 'Session initiated & voice profile matched (d=0.08)',
        points: '+0 risk',
        severity: 'low',
      },
    ],
    triggeredPolicy: null,
    recommendedAction: {
      type: 'MONITOR',
      title: 'Voice Verified',
      description: 'High confidence identity match. Call permitted to proceed.',
      requiresIntervention: false,
    },
  },
  {
    stepIndex: 1,
    timeSeconds: 3,
    phaseLabel: 'CONTINUOUS MONITORING',
    caller: {
      name: 'David Miller',
      role: 'Chief Architect',
      department: 'Technology',
      callerId: '+1 (555) 014-9921',
      channel: 'Customer Support Line A',
    },
    metrics: {
      speakerMatchPct: 97,
      syntheticProbPct: 3,
      audioQualityScore: 94,
      audioQualityStatus: 'PASS',
      snrDb: 34,
      packetLossPct: 0.05,
      latencyMs: 9,
    },
    evidenceBreakdown: {
      syntheticVoicePoints: 2,
      speakerMismatchPoints: 3,
      acousticAnomalyPoints: 5,
      contextualRiskPoints: 0,
      fusedRiskScore: 10,
    },
    riskState: 'TRUSTED',
    confidence: 'HIGH',
    confidenceScore: 0.98,
    anomalies: {
      acousticAnomaly: 'NORMAL',
      codecAnomaly: false,
      voiceprintMismatch: false,
    },
    evidenceTimeline: [
      {
        id: 'ev_200',
        time: '00:00',
        description: 'Session initiated & voice profile matched (d=0.08)',
        points: '+0 risk',
        severity: 'low',
      },
      {
        id: 'ev_201',
        time: '00:03',
        description: 'Continuous biometric liveness verified',
        points: '+0 risk',
        severity: 'low',
      },
    ],
    triggeredPolicy: null,
    recommendedAction: {
      type: 'MONITOR',
      title: 'Voice Verified',
      description: 'High confidence identity match. Call permitted to proceed.',
      requiresIntervention: false,
    },
  },
];
