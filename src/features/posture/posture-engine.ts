/**
 * Posture Detection Engine
 * Uses MediaPipe Face Mesh landmarks to estimate head tilt and forward lean.
 * Detects slouching by analyzing the nose-to-eye vertical ratio and head pitch.
 */

export type PostureState = 'good' | 'slouching' | 'unknown';

export interface PostureResult {
  state: PostureState;
  score: number;          // 0-100, 100 = perfect
  headPitch: number;      // degrees, negative = looking down
  shoulderDrop: number;   // ratio indicating forward lean
  timestamp: number;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

export class PostureEngine {
  private calibrationNoseY: number | null = null;
  private calibrationEyeDistance: number | null = null;
  private frameCount = 0;
  private readonly calibrationFrames = 60; // ~2s to calibrate
  private calibrationSamples: { noseY: number; eyeDist: number }[] = [];
  private lastState: PostureState = 'unknown';
  private smoothedScore = 100;

  /**
   * Analyze posture from MediaPipe Face Mesh landmarks.
   * Key landmarks:
   *   1   = nose tip
   *   10  = forehead top
   *   152 = chin
   *   33  = left eye inner corner
   *   263 = right eye inner corner
   *   168 = nose bridge (between eyes)
   */
  analyze(landmarks: Landmark[]): PostureResult {
    const now = Date.now();

    if (!landmarks || landmarks.length < 468) {
      return { state: 'unknown', score: 0, headPitch: 0, shoulderDrop: 0, timestamp: now };
    }

    const noseTip = landmarks[1];
    const forehead = landmarks[10];
    const chin = landmarks[152];
    const leftEyeInner = landmarks[33];
    const rightEyeInner = landmarks[263];
    const noseBridge = landmarks[168];

    // Eye distance (used as scale reference)
    const eyeDistance = Math.sqrt(
      (rightEyeInner.x - leftEyeInner.x) ** 2 +
      (rightEyeInner.y - leftEyeInner.y) ** 2
    );

    // Face vertical span
    const faceHeight = Math.sqrt(
      (forehead.x - chin.x) ** 2 +
      (forehead.y - chin.y) ** 2
    );

    // Head pitch estimation: nose bridge to nose tip vertical distance
    // When looking straight, nose is below bridge. When slouching/looking down, gap increases.
    const noseDropRatio = (noseTip.y - noseBridge.y) / (faceHeight || 1);

    // Relative Y position (how far down the face is in frame)
    const faceY = noseTip.y;

    // Calibration phase
    this.frameCount++;
    if (this.frameCount <= this.calibrationFrames) {
      this.calibrationSamples.push({ noseY: faceY, eyeDist: eyeDistance });
      if (this.frameCount === this.calibrationFrames) {
        this.calibrationNoseY = this.median(this.calibrationSamples.map(s => s.noseY));
        this.calibrationEyeDistance = this.median(this.calibrationSamples.map(s => s.eyeDist));
      }
      return { state: 'unknown', score: 100, headPitch: 0, shoulderDrop: 0, timestamp: now };
    }

    if (this.calibrationNoseY === null || this.calibrationEyeDistance === null) {
      return { state: 'unknown', score: 0, headPitch: 0, shoulderDrop: 0, timestamp: now };
    }

    // How much the face has dropped compared to calibration (normalized by eye distance)
    const faceDrop = (faceY - this.calibrationNoseY) / this.calibrationEyeDistance;

    // How much the face has shrunk (indicates moving away / leaning back)
    const sizeRatio = eyeDistance / this.calibrationEyeDistance;

    // Head pitch angle approximation
    const headPitch = noseDropRatio * 90 - 15; // rough degrees, calibrated offset

    // Score computation
    // faceDrop > 0.3 = noticeable slouch, > 0.6 = bad slouch
    // sizeRatio < 0.85 = too far, > 1.15 = too close
    let score = 100;
    score -= Math.max(0, faceDrop - 0.15) * 120;    // penalize dropping
    score -= Math.max(0, Math.abs(sizeRatio - 1) - 0.1) * 50; // penalize distance change
    score -= Math.max(0, -headPitch - 10) * 2;      // penalize looking down a lot
    score = Math.max(0, Math.min(100, score));

    // Smooth the score
    this.smoothedScore = this.smoothedScore * 0.85 + score * 0.15;
    const finalScore = Math.round(this.smoothedScore);

    // Classify
    let state: PostureState;
    if (finalScore >= 65) {
      state = 'good';
    } else {
      state = 'slouching';
    }
    this.lastState = state;

    return {
      state,
      score: finalScore,
      headPitch: Math.round(headPitch),
      shoulderDrop: Math.round(faceDrop * 100) / 100,
      timestamp: now,
    };
  }

  recalibrate(): void {
    this.calibrationNoseY = null;
    this.calibrationEyeDistance = null;
    this.frameCount = 0;
    this.calibrationSamples = [];
    this.smoothedScore = 100;
    this.lastState = 'unknown';
  }

  getState(): PostureState {
    return this.lastState;
  }

  private median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
