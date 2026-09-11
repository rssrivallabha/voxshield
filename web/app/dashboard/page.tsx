'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { RiskIndicator } from '@/components/data-display/RiskIndicator';
import { ConfidenceIndicator } from '@/components/data-display/ConfidenceIndicator';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { LiveWaveform } from '@/components/visualization/LiveWaveform';
import { EvidenceFusionPanel } from '@/components/visualization/EvidenceFusionPanel';
import { InterventionPanel } from '@/components/visualization/InterventionPanel';
import { RiskHistoryChart } from '@/components/visualization/RiskHistoryChart';
import { useScenarioRunner } from '@/lib/simulation/useScenarioRunner';
import { useMicAudio } from '@/lib/audio/useMicAudio';
import { useBackendInference } from '@/lib/backend/useBackendInference';
import { phone, activity, play, pause, rotateCcw, mic, micOff, server, serverOff } from '@/lib/icons';
import {
  TelemetryMode,
  adaptSimulationFrame,
  adaptLiveAudioMetrics,
  adaptBackendTelemetry,
  UnifiedTelemetryFrame,
  BackendTelemetryState,
} from '@/lib/adapters/telemetryAdapter';

export default function SOCDashboard() {
  const [activeMode, setActiveMode] = React.useState<TelemetryMode>('SIMULATION');

  // Simulation Runner State
  const {
    scenarioType,
    isPlaying: isSimPlaying,
    stepIndex,
    totalSteps,
    currentFrame: currentSimFrame,
    history: simHistory,
    interventionState,
    startScenario,
    pauseScenario,
    resumeScenario,
    resetScenario,
    triggerIntervention,
  } = useScenarioRunner('VOICE_CLONE_ATTACK');

  // Live Microphone Lifecycle & Telemetry State
  const {
    micState,
    isMicActive,
    micAudioData,
    liveMetrics,
    sessionStartTime,
    startMic,
    stopMic,
  } = useMicAudio();

  // Backend Inference State
  const {
    connectionState,
    lastTelemetry,
    lastInference,
    lastRisk,
    riskHistory,
    startStreaming,
    stopStreaming,
    sessionId,
  } = useBackendInference();

  const backendTelemetryState: BackendTelemetryState = React.useMemo(() => ({
    sessionId,
    connectionStatus: connectionState.status,
    latestTelemetry: lastTelemetry,
    latestInference: lastInference,
    latestRisk: lastRisk,
    startedAt: connectionState.status === 'CONNECTED' ? Date.now() : undefined,
  }), [sessionId, connectionState.status, lastTelemetry, lastInference, lastRisk]);

  // Mode Switcher handler
  const handleModeSwitch = (mode: TelemetryMode) => {
    setActiveMode(mode);
    if (mode === 'SIMULATION' && isMicActive) {
      stopMic();
    } else if (mode === 'LIVE_INPUT' && isSimPlaying) {
      pauseScenario();
    } else if (mode === 'BACKEND') {
      if (isSimPlaying) pauseScenario();
      if (isMicActive) stopMic();
    }
  };

   // Adapt active telemetry according to selected mode
   const activeTelemetry: UnifiedTelemetryFrame = React.useMemo(() => {
     if (activeMode === 'SIMULATION') {
       return adaptSimulationFrame(currentSimFrame);
     }
     if (activeMode === 'LIVE_INPUT') {
       return adaptLiveAudioMetrics(liveMetrics, micState, sessionStartTime);
     }
     return adaptBackendTelemetry(backendTelemetryState);
   }, [activeMode, currentSimFrame, liveMetrics, micState, sessionStartTime, backendTelemetryState]);

  return (
    <PermissionGuard>
      <div className="space-y-6">
        {/* Console Header & Operating Mode Switcher */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-panel-border pb-4">
          <PageHeader
            title="Voice Security Operations Console"
            description="Real-time voice trust analysis, synthetic speech detection, and intervention pipeline"
          />

          <div className="flex flex-wrap items-center gap-3 bg-panel-elevated p-2 rounded-lg border border-panel-border">
            {/* Primary Mode Toggle */}
            <div className="flex items-center rounded-md bg-panel p-1 border border-panel-border">
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-fast ${
                  activeMode === 'SIMULATION'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => handleModeSwitch('SIMULATION')}
              >
                Simulation
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-fast ${
                  activeMode === 'LIVE_INPUT'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => handleModeSwitch('LIVE_INPUT')}
              >
                Live Input (Mic)
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-fast ${
                  activeMode === 'BACKEND'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => handleModeSwitch('BACKEND')}
              >
                Backend Inference
              </button>
            </div>

            <div className="h-5 w-px bg-panel-border" />

            {/* Mode-Specific Controls */}
            {activeMode === 'SIMULATION' ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant={scenarioType === 'VOICE_CLONE_ATTACK' ? 'primary' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => startScenario('VOICE_CLONE_ATTACK')}
                  >
                    Voice Clone Attack
                  </Button>
                  <Button
                    variant={scenarioType === 'TRUSTED_CALL' ? 'primary' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => startScenario('TRUSTED_CALL')}
                  >
                    Trusted Call
                  </Button>
                </div>

                <div className="h-4 w-px bg-panel-border mx-1" />

                {!isSimPlaying ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => (stepIndex === 0 ? startScenario() : resumeScenario())}
                  >
                    {play({ className: 'h-3.5 w-3.5' })}
                    <span>{stepIndex === 0 ? 'Start' : 'Resume'}</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={pauseScenario}>
                    {pause({ className: 'h-3.5 w-3.5' })}
                    <span>Pause</span>
                  </Button>
                )}

                <Button variant="ghost" size="sm" className="text-xs" onClick={() => resetScenario()} title="Reset Scenario">
                  {rotateCcw({ className: 'h-3.5 w-3.5' })}
                </Button>
              </div>
            ) : activeMode === 'LIVE_INPUT' ? (
              <div className="flex items-center gap-2">
                {!isMicActive ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={micState === 'REQUESTING_PERMISSION'}
                    onClick={startMic}
                  >
                    {mic({ className: 'h-3.5 w-3.5' })}
                    <span>{micState === 'REQUESTING_PERMISSION' ? 'Requesting Access...' : 'Enable Microphone'}</span>
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={stopMic}>
                    {micOff({ className: 'h-3.5 w-3.5' })}
                    <span>Stop Microphone</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {connectionState.status === 'IDLE' || connectionState.status === 'DISCONNECTED' || connectionState.status === 'ERROR' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={startStreaming}
                  >
                    {server({ className: 'h-3.5 w-3.5' })}
                    <span>Connect Backend</span>
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={stopStreaming}>
                    {serverOff({ className: 'h-3.5 w-3.5' })}
                    <span>Disconnect</span>
                  </Button>
                )}
                <span className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-panel border border-panel-border">
                  {connectionState.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase & Mode Status Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-panel-border bg-panel-elevated">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${
                (activeMode === 'SIMULATION' && isSimPlaying) || 
                (activeMode === 'LIVE_INPUT' && isMicActive) ||
                (activeMode === 'BACKEND' && connectionState.status === 'CONNECTED')
                  ? 'bg-signal-active animate-live-indicator'
                  : 'bg-muted'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                  {activeTelemetry.modeBadgeLabel}
                </span>
                {activeMode === 'LIVE_INPUT' && (
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Status: {micState}
                  </span>
                )}
                {activeMode === 'BACKEND' && (
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Session: {sessionId?.slice(0, 8)}...
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-foreground mt-0.5 block">{activeTelemetry.phaseLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            <div>
              <span className="text-muted-foreground block">Session Time</span>
              <span className="text-foreground font-semibold">{activeTelemetry.timeLabel}</span>
            </div>
            {activeMode === 'SIMULATION' && (
              <div>
                <span className="text-muted-foreground block">Frame Step</span>
                <span className="text-foreground font-semibold">
                  {stepIndex + 1} / {totalSteps}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground block">Risk State</span>
              <RiskIndicator state={activeTelemetry.riskState} size="sm" />
            </div>
          </div>
        </div>

        {/* Console Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Session Identity, Waveform, Audio Telemetry & Fusion */}
          <div className="space-y-6">
            <Panel>
              <PanelHeader
                title="Active Session Identity"
                description={`${activeTelemetry.caller.name} • ${activeTelemetry.caller.role}`}
                icon={phone({ className: 'h-4 w-4' })}
                actions={
                  <span className="font-mono text-xs text-muted-foreground px-2 py-0.5 rounded border border-panel-border bg-panel">
                    {activeTelemetry.caller.callerId}
                  </span>
                }
              />
              <PanelBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded border border-panel-border bg-panel-elevated">
                    <span className="text-muted-foreground block font-mono">Target Channel</span>
                    <span className="font-semibold text-foreground">{activeTelemetry.caller.channel}</span>
                  </div>
                  <div className="p-2.5 rounded border border-panel-border bg-panel-elevated">
                    <span className="text-muted-foreground block font-mono">Department</span>
                    <span className="font-semibold text-foreground">{activeTelemetry.caller.department}</span>
                  </div>
                </div>

                {/* Live Waveform Visualizer */}
                <LiveWaveform
                  isPlaying={
                    (activeMode === 'SIMULATION' && isSimPlaying) || 
                    (activeMode === 'LIVE_INPUT' && isMicActive) ||
                    (activeMode === 'BACKEND' && connectionState.status === 'CONNECTED')
                  }
                  hasAnomaly={activeTelemetry.evidenceBreakdown.acousticAnomalyPoints ? activeTelemetry.evidenceBreakdown.acousticAnomalyPoints > 0 : false}
                  syntheticProbPct={activeTelemetry.mlMetrics.syntheticProbPct || 0}
                  snrDb={activeTelemetry.audioMetrics.snrDb || 30}
                  micAudioData={activeMode === 'LIVE_INPUT' || activeMode === 'BACKEND' ? micAudioData : null}
                />

                {/* Telemetry Metrics */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 rounded-lg border border-panel-border bg-panel-elevated space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Speaker Similarity</span>
                      <span
                        className={`font-mono font-bold ${
                          activeTelemetry.mlMetrics.speakerMatchPct === null
                            ? 'text-amber-500 text-[10px]'
                            : activeTelemetry.mlMetrics.speakerMatchPct < 75
                            ? 'text-risk-high'
                            : 'text-confidence-high'
                        }`}
                      >
                        {activeTelemetry.mlMetrics.speakerMatchText}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      {activeTelemetry.mlMetrics.speakerMatchPct !== null ? (
                        <div
                          className={`h-full transition-standard ${
                            activeTelemetry.mlMetrics.speakerMatchPct < 75 ? 'bg-risk-high' : 'bg-confidence-high'
                          }`}
                          style={{ width: `${activeTelemetry.mlMetrics.speakerMatchPct}%` }}
                        />
                      ) : (
                        <div className="h-full bg-amber-500/40 w-full animate-pulse" />
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-panel-border bg-panel-elevated space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Raw Synthetic Probability</span>
                      <span
                        className={`font-mono font-bold ${
                          activeTelemetry.mlMetrics.syntheticProbPct === null
                            ? 'text-amber-500 text-[10px]'
                            : activeTelemetry.mlMetrics.syntheticProbPct > 50
                            ? 'text-risk-critical'
                            : 'text-confidence-high'
                        }`}
                      >
                        {activeTelemetry.mlMetrics.syntheticProbText}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      {activeTelemetry.mlMetrics.syntheticProbPct !== null ? (
                        <div
                          className={`h-full transition-standard ${
                            activeTelemetry.mlMetrics.syntheticProbPct > 50 ? 'bg-risk-critical' : 'bg-confidence-high'
                          }`}
                          style={{ width: `${activeTelemetry.mlMetrics.syntheticProbPct}%` }}
                        />
                      ) : (
                        <div className="h-full bg-amber-500/40 w-full animate-pulse" />
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-panel-border bg-panel-elevated space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Temporal Synthetic Evidence</span>
                      <span
                        className={`font-mono font-bold ${
                          activeTelemetry.mlMetrics.temporalSyntheticEvidencePct === null
                            ? 'text-amber-500 text-[10px]'
                            : activeTelemetry.mlMetrics.temporalSyntheticEvidencePct > 50
                            ? 'text-risk-high'
                            : 'text-confidence-high'
                        }`}
                      >
                        {activeTelemetry.mlMetrics.temporalSyntheticEvidencePct !== null
                          ? `${activeTelemetry.mlMetrics.temporalSyntheticEvidencePct}%`
                          : 'UNAVAILABLE'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      {activeTelemetry.mlMetrics.temporalSyntheticEvidencePct !== null ? (
                        <div
                          className={`h-full transition-standard ${
                            activeTelemetry.mlMetrics.temporalSyntheticEvidencePct > 50 ? 'bg-risk-high' : 'bg-confidence-high'
                          }`}
                          style={{ width: `${activeTelemetry.mlMetrics.temporalSyntheticEvidencePct}%` }}
                        />
                      ) : (
                        <div className="h-full bg-amber-500/40 w-full animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Local Acoustic Audio Telemetry Details */}
                <div className="p-3 rounded-lg border border-panel-border bg-panel-elevated space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span>
                      Audio Quality: <strong className="text-foreground">{activeTelemetry.audioMetrics.qualityStatus}</strong>
                    </span>
                    {activeTelemetry.isMlAvailable ? (
                      <ConfidenceIndicator level="HIGH" value={94} />
                    ) : (
                      <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {activeMode === 'BACKEND' ? 'BACKEND INFERENCE' : 'ML INFERENCE DISCONNECTED'}
                      </span>
                    )}
                  </div>

                  {(activeMode === 'LIVE_INPUT' || activeMode === 'BACKEND') && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-panel-border text-[11px] text-muted-foreground">
                      <div>
                        Signal Level: <span className="text-foreground font-semibold">{activeTelemetry.audioMetrics.signalLevelDbfs !== null ? `${activeTelemetry.audioMetrics.signalLevelDbfs} dBFS` : '-'}</span>
                      </div>
                      <div>
                        Peak Level: <span className="text-foreground font-semibold">{activeTelemetry.audioMetrics.peakDbfs !== null ? `${activeTelemetry.audioMetrics.peakDbfs} dBFS` : '-'}</span>
                      </div>
                      <div>
                        Voice Activity: <span className="text-foreground font-semibold">{activeTelemetry.audioMetrics.voiceActivity}</span>
                      </div>
                      <div>
                        Clipping: <span className="text-foreground font-semibold">{activeTelemetry.audioMetrics.clipping}</span>
                      </div>
                      <div>
                        Sample Rate: <span className="text-foreground font-semibold">{activeTelemetry.audioMetrics.sampleRate ? `${activeTelemetry.audioMetrics.sampleRate / 1000} kHz` : '-'}</span>
                      </div>
                      <div>
                        Channels: <span className="text-foreground font-semibold">{activeTelemetry.audioMetrics.channels !== null ? `${activeTelemetry.audioMetrics.channels} (Mono)` : '-'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </PanelBody>
            </Panel>

            {/* Evidence Fusion Panel */}
            <EvidenceFusionPanel
              syntheticPoints={activeTelemetry.evidenceBreakdown.syntheticVoicePoints}
              speakerMismatchPoints={activeTelemetry.evidenceBreakdown.speakerMismatchPoints}
              acousticAnomalyPoints={activeTelemetry.evidenceBreakdown.acousticAnomalyPoints}
              contextualPoints={activeTelemetry.evidenceBreakdown.contextualRiskPoints}
              fusedScore={activeTelemetry.evidenceBreakdown.fusedRiskScore}
              riskState={activeTelemetry.riskState}
              isMlAvailable={activeTelemetry.isMlAvailable}
              riskExplanation={activeTelemetry.riskExplanation}
            />
          </div>

          {/* Right Column: Security Action & Trajectory & Timeline */}
          <div className="space-y-6">
            {/* Automated Security Intervention Panel */}
            <InterventionPanel
              policy={activeTelemetry.triggeredPolicy}
              recommendedAction={activeTelemetry.recommendedAction}
              interventionState={activeMode === 'SIMULATION' ? interventionState : 'NONE'}
              onIntervention={triggerIntervention}
            />

            {/* Risk History Time Series */}
            <RiskHistoryChart history={
              activeMode === 'SIMULATION' 
                ? simHistory 
                : activeMode === 'BACKEND' && riskHistory.length > 0
                  ? riskHistory.map((point, index) => ({
                      timeSeconds: index,
                      fusedRiskScore: point.fused_risk_score ?? 0,
                      riskState: point.risk_state as typeof activeTelemetry.riskState,
                    }))
                  : [{ timeSeconds: 0, fusedRiskScore: 0, riskState: 'UNVERIFIED' }]
            } />

            {/* Live Evidence Stream Timeline */}
            <Panel>
              <PanelHeader
                title="Evidence Stream Timeline"
                description={
                  activeMode === 'SIMULATION'
                    ? 'Real-time chronological telemetry events'
                    : activeMode === 'BACKEND'
                      ? 'Server-authoritative evidence & risk events'
                      : 'Live acoustic stream & ML pipeline state'
                }
                icon={activity({ className: 'h-4 w-4' })}
              />
              <PanelBody className="space-y-2">
                {activeTelemetry.evidenceTimeline.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-2.5 rounded border border-panel-border bg-panel-elevated text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground">{ev.time}</span>
                      <span className="text-foreground truncate">{ev.description}</span>
                    </div>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        ev.severity === 'critical'
                          ? 'bg-risk-critical/10 text-risk-critical border border-risk-critical/30'
                          : ev.severity === 'high'
                          ? 'bg-risk-high/10 text-risk-high border border-risk-high/30'
                          : ev.severity === 'medium'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                          : 'bg-panel text-muted-foreground border border-panel-border'
                      }`}
                    >
                      {ev.points}
                    </span>
                  </div>
                ))}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}