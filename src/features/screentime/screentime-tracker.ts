/**
 * Screen Time Tracker
 * Monitors active screen time, break intervals, and triggers nudges
 * when the user has been continuously active for too long.
 */

export interface ScreenTimeResult {
  totalActiveMs: number;
  currentSessionMs: number;
  lastBreakAgo: number;    // ms since last break
  isActive: boolean;
  sessionsToday: number;
  nudgeNeeded: boolean;
  timestamp: number;
}

export class ScreenTimeTracker {
  private readonly NUDGE_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes
  private readonly BREAK_THRESHOLD_MS = 5 * 60 * 1000;  // 5 min away = a break
  private readonly IDLE_THRESHOLD_MS = 30 * 1000;        // 30s no movement = idle

  private sessionStart = Date.now();
  private totalActiveMs = 0;
  private lastActivityTime = Date.now();
  private lastBreakTime = Date.now();
  private isActive = true;
  private sessionsToday = 1;
  private nudgeAcknowledged = false;
  private dayStart: number;

  constructor() {
    this.dayStart = this.getStartOfDay();
    this.setupVisibilityListener();
  }

  private getStartOfDay(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.markInactive();
      } else {
        this.markActive();
      }
    });
  }

  /** Call this every frame when face is detected */
  onFaceDetected(): void {
    const now = Date.now();
    this.lastActivityTime = now;
    if (!this.isActive) {
      this.markActive();
    }
  }

  /** Call this when no face is detected */
  onFaceLost(): void {
    // Don't immediately mark inactive — might be looking away briefly
    const now = Date.now();
    if (now - this.lastActivityTime > this.IDLE_THRESHOLD_MS) {
      this.markInactive();
    }
  }

  private markActive(): void {
    if (!this.isActive) {
      const now = Date.now();
      const awayTime = now - this.lastActivityTime;
      if (awayTime >= this.BREAK_THRESHOLD_MS) {
        this.lastBreakTime = now;
        this.sessionsToday++;
        this.nudgeAcknowledged = false;
      }
      this.sessionStart = now;
      this.isActive = true;
    }
  }

  private markInactive(): void {
    if (this.isActive) {
      this.totalActiveMs += Date.now() - this.sessionStart;
      this.isActive = false;
    }
  }

  acknowledgeNudge(): void {
    this.nudgeAcknowledged = true;
    this.lastBreakTime = Date.now();
    this.sessionStart = Date.now();
  }

  getStatus(): ScreenTimeResult {
    const now = Date.now();

    // Reset daily
    if (now - this.dayStart > 24 * 60 * 60 * 1000) {
      this.totalActiveMs = 0;
      this.sessionsToday = 1;
      this.dayStart = this.getStartOfDay();
    }

    const currentSessionMs = this.isActive ? now - this.sessionStart : 0;
    const totalMs = this.totalActiveMs + currentSessionMs;
    const sinceBreak = now - this.lastBreakTime;
    const nudgeNeeded = sinceBreak >= this.NUDGE_THRESHOLD_MS && !this.nudgeAcknowledged;

    return {
      totalActiveMs: totalMs,
      currentSessionMs,
      lastBreakAgo: sinceBreak,
      isActive: this.isActive,
      sessionsToday: this.sessionsToday,
      nudgeNeeded,
      timestamp: now,
    };
  }

  reset(): void {
    this.sessionStart = Date.now();
    this.totalActiveMs = 0;
    this.lastActivityTime = Date.now();
    this.lastBreakTime = Date.now();
    this.isActive = true;
    this.sessionsToday = 1;
    this.nudgeAcknowledged = false;
  }
}
