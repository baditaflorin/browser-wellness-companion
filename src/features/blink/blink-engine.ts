/**
 * Blink Detection Engine
 * Uses Eye Aspect Ratio (EAR) from MediaPipe Face Mesh landmarks.
 * Tracks blink rate per minute and detects prolonged no-blink periods.
 */

export interface BlinkResult {
  blinksPerMinute: number;
  totalBlinks: number;
  lastBlinkAgo: number;    // ms since last blink
  isBlinking: boolean;
  earLeft: number;
  earRight: number;
  timestamp: number;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

export class BlinkEngine {
  private readonly EAR_THRESHOLD = 0.21;
  private readonly CONSEC_FRAMES = 2;

  private blinkTimestamps: number[] = [];
  private consecBelow = 0;
  private wasBelow = false;
  private totalBlinks = 0;
  private lastBlinkTime = Date.now();
  private startTime = Date.now();

  /**
   * MediaPipe Face Mesh eye landmarks:
   * Left eye:  [33, 160, 158, 133, 153, 144]
   * Right eye: [362, 385, 387, 263, 373, 380]
   *
   * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
   */
  analyze(landmarks: Landmark[]): BlinkResult {
    const now = Date.now();

    if (!landmarks || landmarks.length < 468) {
      return this.makeResult(now, false, 0, 0);
    }

    // Left eye EAR
    const earLeft = this.computeEAR(
      landmarks[33], landmarks[160], landmarks[158],
      landmarks[133], landmarks[153], landmarks[144]
    );

    // Right eye EAR
    const earRight = this.computeEAR(
      landmarks[362], landmarks[385], landmarks[387],
      landmarks[263], landmarks[373], landmarks[380]
    );

    const ear = (earLeft + earRight) / 2;
    let isBlinking = false;

    if (ear < this.EAR_THRESHOLD) {
      this.consecBelow++;
    } else {
      if (this.consecBelow >= this.CONSEC_FRAMES && this.wasBelow) {
        // Blink detected
        this.totalBlinks++;
        this.lastBlinkTime = now;
        this.blinkTimestamps.push(now);
        isBlinking = true;
      }
      this.consecBelow = 0;
    }
    this.wasBelow = ear < this.EAR_THRESHOLD;

    // Remove timestamps older than 60s for per-minute calculation
    const oneMinuteAgo = now - 60_000;
    this.blinkTimestamps = this.blinkTimestamps.filter(t => t > oneMinuteAgo);

    return this.makeResult(now, isBlinking, earLeft, earRight);
  }

  private computeEAR(
    p1: Landmark, p2: Landmark, p3: Landmark,
    p4: Landmark, p5: Landmark, p6: Landmark
  ): number {
    const vertical1 = this.dist(p2, p6);
    const vertical2 = this.dist(p3, p5);
    const horizontal = this.dist(p1, p4);
    if (horizontal < 0.001) return 0;
    return (vertical1 + vertical2) / (2 * horizontal);
  }

  private dist(a: Landmark, b: Landmark): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private makeResult(now: number, isBlinking: boolean, earLeft: number, earRight: number): BlinkResult {
    return {
      blinksPerMinute: this.blinkTimestamps.length,
      totalBlinks: this.totalBlinks,
      lastBlinkAgo: now - this.lastBlinkTime,
      isBlinking,
      earLeft,
      earRight,
      timestamp: now,
    };
  }

  reset(): void {
    this.blinkTimestamps = [];
    this.consecBelow = 0;
    this.wasBelow = false;
    this.totalBlinks = 0;
    this.lastBlinkTime = Date.now();
    this.startTime = Date.now();
  }
}
