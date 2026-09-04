'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { shieldAlert, phoneOff, userCheck, shieldCheck } from '@/lib/icons';

interface InterventionPanelProps {
  policy: {
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
  interventionState: 'NONE' | 'CHALLENGED' | 'TERMINATED' | 'ESCALATED';
  onIntervention: (action: 'CHALLENGED' | 'TERMINATED' | 'ESCALATED') => void;
  className?: string;
}

export function InterventionPanel({
  policy,
  recommendedAction,
  interventionState,
  onIntervention,
  className,
}: InterventionPanelProps) {
  const isHighRisk = recommendedAction?.requiresIntervention || policy?.status === 'TRIGGERED' || policy?.status === 'EXECUTED';

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-standard space-y-4 shadow-panel',
        interventionState === 'TERMINATED'
          ? 'border-destructive/60 bg-destructive/10'
          : interventionState === 'CHALLENGED'
          ? 'border-warning/60 bg-warning/10'
          : isHighRisk
          ? 'border-risk-critical/50 bg-risk-critical/5'
          : 'border-panel-border bg-panel',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-panel-border pb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center',
              isHighRisk ? 'bg-risk-critical-muted text-risk-critical' : 'bg-primary/10 text-primary'
            )}
          >
            {isHighRisk ? shieldAlert({ className: 'h-5 w-5' }) : shieldCheck({ className: 'h-5 w-5' })}
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Automated Policy & Security Action</h3>
            <p className="text-sm font-semibold text-foreground">
              {interventionState !== 'NONE'
                ? 'Security Action Executed'
                : isHighRisk
                ? 'Intervention Required'
                : 'Security Policy Nominal'}
            </p>
          </div>
        </div>
        {policy && (
          <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {policy.action}
          </span>
        )}
      </div>

      {interventionState !== 'NONE' ? (
        <div className="p-3 rounded-md border border-panel-border bg-panel-elevated space-y-2 text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 mb-1">
            {userCheck({ className: 'h-5 w-5' })}
          </div>
          <h4 className="text-sm font-bold text-foreground">
            {interventionState === 'CHALLENGED' && 'Out-of-Band 2FA Challenge Issued'}
            {interventionState === 'TERMINATED' && 'Voice Session Terminated & Locked'}
            {interventionState === 'ESCALATED' && 'Escalated to Senior Fraud Specialist'}
          </h4>
          <p className="text-xs text-muted-foreground">
            {interventionState === 'CHALLENGED' && 'Secondary push verification dispatched to caller mobile authenticator.'}
            {interventionState === 'TERMINATED' && 'SIP connection dropped immediately to prevent unauthorized fund transfer.'}
            {interventionState === 'ESCALATED' && 'Incident ticket #inc_8801 routed to SOC Tier 2 queue.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              {recommendedAction?.title || 'System Status Nominal'}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {recommendedAction?.description || 'Continuous monitoring active. No intervention policy triggered.'}
            </p>
          </div>

          {isHighRisk && (
            <div className="grid gap-2 sm:grid-cols-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onIntervention('CHALLENGED')}
              >
                {userCheck({ className: 'h-3.5 w-3.5' })}
                <span>Initiate 2FA</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onIntervention('ESCALATED')}
              >
                {shieldAlert({ className: 'h-3.5 w-3.5' })}
                <span>Escalate SOC</span>
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onIntervention('TERMINATED')}
              >
                {phoneOff({ className: 'h-3.5 w-3.5' })}
                <span>Terminate</span>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
