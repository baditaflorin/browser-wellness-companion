/**
 * Wellness Nudge System
 * Combines signals from all engines to decide when and what to nudge.
 */

import type { RPPGResult } from '../rppg/rppg-engine';
import type { PostureResult } from '../posture/posture-engine';
import type { BlinkResult } from '../blink/blink-engine';
import type { ScreenTimeResult } from '../screentime/screentime-tracker';

export interface NudgeMessage {
  id: string;
  type: 'break' | 'posture' | 'blink' | 'stress' | 'combined';
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  body: string;
  suggestion: string;
  icon: string;
}

export class NudgeSystem {
  private lastNudgeTime = 0;
  private readonly MIN_NUDGE_INTERVAL_MS = 5 * 60 * 1000; // 5 min between nudges
  private activeNudge: NudgeMessage | null = null;
  private nudgeHistory: { type: string; time: number }[] = [];
  private postureWarnStart = 0;
  private lowBlinkStart = 0;

  evaluate(
    rppg: RPPGResult | null,
    posture: PostureResult | null,
    blink: BlinkResult | null,
    screenTime: ScreenTimeResult | null
  ): NudgeMessage | null {
    const now = Date.now();
    if (now - this.lastNudgeTime < this.MIN_NUDGE_INTERVAL_MS) return null;

    const issues: string[] = [];
    let severity: 'info' | 'warning' | 'urgent' = 'info';
    let type: NudgeMessage['type'] = 'break';

    // Check 90-min screen time
    if (screenTime?.nudgeNeeded) {
      issues.push('90+ minutes without a break');
      severity = 'warning';
      type = 'break';
    }

    // Check posture — only nudge if bad for >60s
    if (posture?.state === 'slouching') {
      if (this.postureWarnStart === 0) this.postureWarnStart = now;
      if (now - this.postureWarnStart > 60_000) {
        issues.push('slouching detected');
        type = 'posture';
        if (severity === 'info') severity = 'warning';
      }
    } else {
      this.postureWarnStart = 0;
    }

    // Check blink rate — normal is 15-20/min, <10 is concerning
    if (blink && blink.blinksPerMinute < 8 && blink.blinksPerMinute > 0) {
      if (this.lowBlinkStart === 0) this.lowBlinkStart = now;
      if (now - this.lowBlinkStart > 30_000) {
        issues.push('low blink rate');
        type = 'blink';
        if (severity === 'info') severity = 'warning';
      }
    } else {
      this.lowBlinkStart = 0;
    }

    // Check elevated heart rate (stress marker)
    if (rppg && rppg.confidence > 0.5 && rppg.bpm > 100) {
      issues.push('elevated heart rate');
      type = 'stress';
      severity = 'urgent';
    }

    // Combined: stress + long session
    if (issues.length >= 2 && screenTime && screenTime.currentSessionMs > 60 * 60 * 1000) {
      type = 'combined';
      severity = 'urgent';
    }

    if (issues.length === 0) return null;

    const nudge = this.buildNudge(type, severity, issues);
    this.lastNudgeTime = now;
    this.activeNudge = nudge;
    this.nudgeHistory.push({ type, time: now });
    return nudge;
  }

  private buildNudge(type: NudgeMessage['type'], severity: NudgeMessage['severity'], issues: string[]): NudgeMessage {
    const nudges: Record<NudgeMessage['type'], Omit<NudgeMessage, 'id' | 'type' | 'severity'>> = {
      break: {
        title: 'Time for a Break',
        body: `You've been at your screen for a while. ${issues.join(', ')}.`,
        suggestion: 'Stand up, stretch, look at something 20 feet away for 20 seconds.',
        icon: '☕',
      },
      posture: {
        title: 'Check Your Posture',
        body: 'You\'ve been slouching for a while. Your back will thank you!',
        suggestion: 'Sit up straight, roll your shoulders back, and align your ears over your shoulders.',
        icon: '🧘',
      },
      blink: {
        title: 'Remember to Blink',
        body: 'Your blink rate is unusually low, which can cause dry eyes.',
        suggestion: 'Close your eyes for 2 seconds, then blink rapidly 10 times. Try the 20-20-20 rule.',
        icon: '👁️',
      },
      stress: {
        title: 'Stress Check',
        body: 'Your heart rate seems elevated. Take a moment to breathe.',
        suggestion: 'Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat 4 times.',
        icon: '🫁',
      },
      combined: {
        title: 'Wellness Alert',
        body: `Multiple wellness markers triggered: ${issues.join(', ')}.`,
        suggestion: 'Take a 5-minute break. Walk around, hydrate, and do some light stretching.',
        icon: '⚠️',
      },
    };

    const n = nudges[type];
    return {
      id: `nudge-${Date.now()}`,
      type,
      severity,
      title: n.title,
      body: n.body,
      suggestion: n.suggestion,
      icon: n.icon,
    };
  }

  dismiss(): void {
    this.activeNudge = null;
  }

  getActive(): NudgeMessage | null {
    return this.activeNudge;
  }

  getHistory(): { type: string; time: number }[] {
    return this.nudgeHistory;
  }
}
