/**
 * Blink Detection Engine v2
 * Supports two hot-swappable methods:
 *  1. EAR (Eye Aspect Ratio) — computed from raw landmarks
 *  2. Blendshapes — uses MediaPipe's pre-computed eyeBlinkLeft/Right scores
 * Reads settings from SettingsManager for live parameter tuning.
 */

import type { BlinkSettings } from '../../settings/settings-manager';
import { DEFAULT_SETTINGS } from '../../settings/settings-manager';

export interface BlinkResult {
  blinksPerMinute: number;
  totalBlinks: number;
  lastBlinkAgo: number;
  isBlinking: boolean;
  earLeft: number;
  earRight: number;
  method: 'ear' | 'blendshapes';
  debugValue: number;   // current detection value (EAR or blendshape score)
  threshold: number;    // current threshold being used
  timestamp: number;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface BlendshapeEntry {
  categoryName: string;
  score: number;
}

export class BlinkEngine {
  private settings: BlinkSettings;
  private blinkTimestamps: number[] = [];
  private consecBelow = 0;
  private wasBelow = false;
  private totalBlinks = 0;
  private lastBlinkTime = 0;
  private smoothedEAR = 0.3;
  private earInitialized = false;

  // Blendshape state
  private blendshapeConsecAbove = 0;
  private blendshapeWasAbove = false;
  private smoothedBlendshape = 0;
  private blendshapeInitialized = false;

  constructor(settings?: BlinkSettings) {
    this.settings = settings ?? DEFAULT_SETTINGS.blink;
  }

  updateSettings(settings: BlinkSettings): void {
    this.settings = settings;
    // Reset smoothing when method changes
    if (settings.method === 'ear') {
      this.blendshapeConsecAbove = 0;
      this.blendshapeWasAbove = false;
    } else {
      this.consecBelow = 0;
      this.wasBelow = false;
    }
  }

  /**
   * Analyze blinks using the currently selected method.
   * @param landmarks - MediaPipe face landmarks (468+)
   * @param blendshapes - Optional blendshape scores from MediaPipe
   */
  analyze(
    landmarks: Landmark[],
    blendshapes?: BlendshapeEntry[]
  ): BlinkResult {
    const now = Date.now();

    if (!landmarks || landmarks.length < 468) {
      return this.makeResult(now, false, 0, 0, 0);
    }

    // Compute EAR regardless (for display)
    const earLeft = this.computeEAR(
      landmarks[33], landmarks[160], landmarks[158],
      landmarks[133], landmarks[153], landmarks[144]
    );
    const earRight = this.computeEAR(
      landmarks[362], landmarks[385], landmarks[387],
      landmarks[263], landmarks[373], landmarks[380]
    );

    let isBlinking = false;
    let debugValue = 0;
    let threshold = 0;

    if (this.settings.method === 'blendshapes' && blendshapes && blendshapes.length > 0) {
      // === BLENDSHAPES METHOD ===
      const result = this.analyzeBlendshapes(blendshapes, now);
      isBlinking = result.isBlinking;
      debugValue = result.debugValue;
      threshold = this.settings.blendshapeThreshold;
    } else {
      // === EAR METHOD ===
      const result = this.analyzeEAR(earLeft, earRight, now);
      isBlinking = result.isBlinking;
      debugValue = result.debugValue;
      threshold = this.settings.earThreshold;
    }

    // Remove timestamps older than 60s
    const oneMinuteAgo = now - 60_000;
    this.blinkTimestamps = this.blinkTimestamps.filter(t => t > oneMinuteAgo);

    return this.makeResult(now, isBlinking, earLeft, earRight, debugValue, threshold);
  }

  private analyzeEAR(earLeft: number, earRight: number, now: number): { isBlinking: boolean; debugValue: number } {
    const rawEAR = (earLeft + earRight) / 2;

    // Smooth EAR
    if (!this.earInitialized) {
      this.smoothedEAR = rawEAR;
      this.earInitialized = true;
    } else {
      const sf = this.settings.earSmoothing;
      this.smoothedEAR = sf * this.smoothedEAR + (1 - sf) * rawEAR;
    }
    const ear = this.smoothedEAR;
    let isBlinking = false;

    if (ear < this.settings.earThreshold) {
      this.consecBelow++;
    } else {
      if (this.consecBelow >= this.settings.consecFrames && this.wasBelow) {
        if (now - this.lastBlinkTime > this.settings.debounceMs) {
          this.totalBlinks++;
          this.lastBlinkTime = now;
          this.blinkTimestamps.push(now);
          isBlinking = true;
        }
      }
      this.consecBelow = 0;
    }
    this.wasBelow = ear < this.settings.earThreshold;

    return { isBlinking, debugValue: ear };
  }

  private analyzeBlendshapes(blendshapes: BlendshapeEntry[], now: number): { isBlinking: boolean; debugValue: number } {
    // Find eyeBlink scores
    const blinkLeft = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score ?? 0;
    const blinkRight = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score ?? 0;
    const rawScore = (blinkLeft + blinkRight) / 2;

    // Smooth
    if (!this.blendshapeInitialized) {
      this.smoothedBlendshape = rawScore;
      this.blendshapeInitialized = true;
    } else {
      const sf = this.settings.earSmoothing; // reuse smoothing factor
      this.smoothedBlendshape = sf * this.smoothedBlendshape + (1 - sf) * rawScore;
    }
    const score = this.smoothedBlendshape;
    let isBlinking = false;

    // Blendshapes: high score = eyes closed (opposite of EAR)
    if (score > this.settings.blendshapeThreshold) {
      this.blendshapeConsecAbove++;
    } else {
      if (this.blendshapeConsecAbove >= this.settings.consecFrames && this.blendshapeWasAbove) {
        if (now - this.lastBlinkTime > this.settings.debounceMs) {
          this.totalBlinks++;
          this.lastBlinkTime = now;
          this.blinkTimestamps.push(now);
          isBlinking = true;
        }
      }
      this.blendshapeConsecAbove = 0;
    }
    this.blendshapeWasAbove = score > this.settings.blendshapeThreshold;

    return { isBlinking, debugValue: score };
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

  private makeResult(
    now: number, isBlinking: boolean,
    earLeft: number, earRight: number,
    debugValue: number, threshold = 0
  ): BlinkResult {
    return {
      blinksPerMinute: this.blinkTimestamps.length,
      totalBlinks: this.totalBlinks,
      lastBlinkAgo: now - this.lastBlinkTime,
      isBlinking,
      earLeft,
      earRight,
      method: this.settings.method,
      debugValue: Math.round(debugValue * 1000) / 1000,
      threshold,
      timestamp: now,
    };
  }

  reset(): void {
    this.blinkTimestamps = [];
    this.consecBelow = 0;
    this.wasBelow = false;
    this.totalBlinks = 0;
    this.lastBlinkTime = 0;
    this.smoothedEAR = 0.3;
    this.earInitialized = false;
    this.blendshapeConsecAbove = 0;
    this.blendshapeWasAbove = false;
    this.smoothedBlendshape = 0;
    this.blendshapeInitialized = false;
  }
}
