/**
 * rPPG (Remote Photoplethysmography) Engine v2
 * - Tracks actual camera FPS instead of assuming 30fps
 * - Adds signal detrending to remove auto-exposure drift (critical for mobile)
 * - Reads settings from SettingsManager for hot-swappable tuning
 * - Uses CHROM method for BVP extraction
 */

import type { RPPGSettings } from '../../settings/settings-manager';
import { DEFAULT_SETTINGS } from '../../settings/settings-manager';

export interface RPPGResult {
  bpm: number;
  confidence: number;
  signal: number[];
  rawSignal: number[];
  actualFps: number;
  timestamp: number;
}

export class RPPGEngine {
  private greenBuffer: number[] = [];
  private redBuffer: number[] = [];
  private blueBuffer: number[] = [];
  private frameTimestamps: number[] = [];
  private lastBPM = 0;
  private lastConfidence = 0;
  private filteredSignal: number[] = [];
  private rawSignal: number[] = [];
  private settings: RPPGSettings;

  constructor(settings?: RPPGSettings) {
    this.settings = settings ?? DEFAULT_SETTINGS.rppg;
  }

  updateSettings(settings: RPPGSettings): void {
    this.settings = settings;
  }

  /** Get the actual measured FPS from frame timestamps */
  private getActualFps(): number {
    if (this.frameTimestamps.length < 2) return 30;
    const recent = this.frameTimestamps.slice(-60); // last 60 frames
    const dt = (recent[recent.length - 1] - recent[0]) / 1000; // seconds
    if (dt < 0.1) return 30;
    return (recent.length - 1) / dt;
  }

  /** Extract mean RGB from a facial ROI */
  extractROI(
    imageData: ImageData,
    faceBox: { x: number; y: number; width: number; height: number }
  ): { r: number; g: number; b: number } | null {
    const { data, width } = imageData;
    let roi: { x: number; y: number; w: number; h: number };

    if (this.settings.roiForehead) {
      // Forehead ROI — less affected by facial expressions
      roi = {
        x: Math.floor(faceBox.x + faceBox.width * 0.25),
        y: Math.floor(faceBox.y + faceBox.height * 0.05),
        w: Math.floor(faceBox.width * 0.5),
        h: Math.floor(faceBox.height * 0.18),
      };
    } else {
      // Cheek ROI — stronger signal but more expression noise
      roi = {
        x: Math.floor(faceBox.x + faceBox.width * 0.2),
        y: Math.floor(faceBox.y + faceBox.height * 0.45),
        w: Math.floor(faceBox.width * 0.6),
        h: Math.floor(faceBox.height * 0.25),
      };
    }

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let dy = 0; dy < roi.h; dy++) {
      for (let dx = 0; dx < roi.w; dx++) {
        const px = roi.x + dx;
        const py = roi.y + dy;
        if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height) continue;
        const idx = (py * width + px) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }

    if (count < 50) return null;
    return { r: rSum / count, g: gSum / count, b: bSum / count };
  }

  /** Add a frame's mean RGB values to the buffer */
  addFrame(rgb: { r: number; g: number; b: number }): void {
    const now = performance.now();
    this.frameTimestamps.push(now);

    this.redBuffer.push(rgb.r);
    this.greenBuffer.push(rgb.g);
    this.blueBuffer.push(rgb.b);

    // Dynamic buffer size based on actual FPS and configured duration
    const fps = this.getActualFps();
    const maxFrames = Math.ceil(fps * this.settings.bufferSizeSec);

    while (this.redBuffer.length > maxFrames) {
      this.redBuffer.shift();
      this.greenBuffer.shift();
      this.blueBuffer.shift();
    }
    // Keep timestamp buffer bounded
    while (this.frameTimestamps.length > 300) {
      this.frameTimestamps.shift();
    }
  }

  /** Compute BPM using CHROM method */
  computeBPM(): RPPGResult {
    const now = Date.now();
    const fps = this.getActualFps();
    const minFrames = Math.ceil(fps * 3); // need at least 3 seconds

    if (this.greenBuffer.length < minFrames) {
      return { bpm: this.lastBPM, confidence: 0, signal: this.filteredSignal, rawSignal: this.rawSignal, actualFps: fps, timestamp: now };
    }

    const n = this.greenBuffer.length;

    // Optional detrending — removes slow drift from auto-exposure changes
    let rBuf = this.redBuffer;
    let gBuf = this.greenBuffer;
    let bBuf = this.blueBuffer;

    if (this.settings.useDetrending) {
      rBuf = this.detrend(rBuf);
      gBuf = this.detrend(gBuf);
      bBuf = this.detrend(bBuf);
    }

    // Normalize channels
    const rNorm = this.normalize(rBuf);
    const gNorm = this.normalize(gBuf);
    const bNorm = this.normalize(bBuf);

    // CHROM: Xs = 3R - 2G, Ys = 1.5R + G - 1.5B
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(3 * rNorm[i] - 2 * gNorm[i]);
      ys.push(1.5 * rNorm[i] + gNorm[i] - 1.5 * bNorm[i]);
    }

    // BVP = Xs - (std(Xs)/std(Ys)) * Ys
    const stdXs = this.std(xs);
    const stdYs = this.std(ys);
    const alpha = stdYs > 0.001 ? stdXs / stdYs : 1;
    const bvp: number[] = [];
    for (let i = 0; i < n; i++) {
      bvp.push(xs[i] - alpha * ys[i]);
    }

    // Bandpass filter using actual FPS
    const filtered = this.bandpassFilter(bvp, fps, this.settings.bandpassLow, this.settings.bandpassHigh);
    this.filteredSignal = filtered.slice(-128);
    this.rawSignal = bvp.slice(-128);

    // Find dominant frequency
    const { frequency, confidence } = this.findDominantFrequency(filtered, fps);
    const bpm = Math.round(frequency * 60);

    // Validate and smooth
    const minBPM = Math.round(this.settings.bandpassLow * 60);
    const maxBPM = Math.round(this.settings.bandpassHigh * 60);

    if (bpm >= minBPM && bpm <= maxBPM && confidence > this.settings.minConfidence) {
      const sf = this.settings.smoothingFactor;
      this.lastBPM = this.lastBPM > 0 ? Math.round(this.lastBPM * sf + bpm * (1 - sf)) : bpm;
      this.lastConfidence = confidence;
    }

    return { bpm: this.lastBPM, confidence: this.lastConfidence, signal: this.filteredSignal, rawSignal: this.rawSignal, actualFps: Math.round(fps), timestamp: now };
  }

  /** Remove linear trend from signal (detrending) */
  private detrend(arr: number[]): number[] {
    const n = arr.length;
    if (n < 2) return arr;

    // Simple linear detrending via least squares
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += arr[i];
      sumXY += i * arr[i];
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 0.001) return arr;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    return arr.map((v, i) => v - (slope * i + intercept));
  }

  private normalize(arr: number[]): number[] {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const s = this.std(arr);
    if (s < 0.001) return arr.map(() => 0);
    return arr.map(v => (v - mean) / s);
  }

  private std(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  private bandpassFilter(signal: number[], fs: number, fLow: number, fHigh: number): number[] {
    const hp = this.highpassFilter(signal, fs, fLow);
    return this.lowpassFilter(hp, fs, fHigh);
  }

  private highpassFilter(signal: number[], fs: number, fc: number): number[] {
    const rc = 1 / (2 * Math.PI * fc);
    const dt = 1 / fs;
    const alpha = rc / (rc + dt);
    const out = [signal[0]];
    for (let i = 1; i < signal.length; i++) {
      out.push(alpha * (out[i - 1] + signal[i] - signal[i - 1]));
    }
    return out;
  }

  private lowpassFilter(signal: number[], fs: number, fc: number): number[] {
    const rc = 1 / (2 * Math.PI * fc);
    const dt = 1 / fs;
    const alpha = dt / (rc + dt);
    const out = [signal[0]];
    for (let i = 1; i < signal.length; i++) {
      out.push(out[i - 1] + alpha * (signal[i] - out[i - 1]));
    }
    return out;
  }

  /** Find dominant frequency via autocorrelation with harmonic rejection */
  private findDominantFrequency(signal: number[], fs: number): { frequency: number; confidence: number } {
    const n = signal.length;
    const minLag = Math.floor(fs / this.settings.bandpassHigh);
    const maxLag = Math.floor(fs / this.settings.bandpassLow);
    const safeLag = Math.min(maxLag, Math.floor(n / 2));

    if (minLag >= safeLag || minLag < 1) return { frequency: 0, confidence: 0 };

    // Compute autocorrelation
    const corrs: { lag: number; corr: number }[] = [];
    let energy = 0;
    for (let i = 0; i < n; i++) energy += signal[i] * signal[i];
    if (energy < 0.001) return { frequency: 0, confidence: 0 };

    for (let lag = minLag; lag <= safeLag; lag++) {
      let corr = 0;
      for (let i = 0; i < n - lag; i++) {
        corr += signal[i] * signal[i + lag];
      }
      corr /= (n - lag);
      corrs.push({ lag, corr });
    }

    // Sort by correlation (descending)
    corrs.sort((a, b) => b.corr - a.corr);

    // Take the best peak
    const best = corrs[0];
    if (!best) return { frequency: 0, confidence: 0 };

    // Harmonic rejection: if the 2nd harmonic (half the lag) is stronger, prefer it
    const halfLag = Math.round(best.lag / 2);
    if (halfLag >= minLag) {
      const halfCorr = corrs.find(c => Math.abs(c.lag - halfLag) <= 1);
      if (halfCorr && halfCorr.corr > best.corr * 0.75) {
        // The fundamental might be at the half-lag
        const halfFreq = fs / halfLag;
        const halfBPM = halfFreq * 60;
        // Prefer the half-lag if it gives a more physiological BPM
        if (halfBPM >= 55 && halfBPM <= 100) {
          const normEnergy = energy / n;
          const confidence = normEnergy > 0.001 ? Math.min(1, Math.max(0, halfCorr.corr / normEnergy)) : 0;
          return { frequency: halfFreq, confidence };
        }
      }
    }

    const frequency = fs / best.lag;
    const normEnergy = energy / n;
    const confidence = normEnergy > 0.001 ? Math.min(1, Math.max(0, best.corr / normEnergy)) : 0;

    return { frequency, confidence };
  }

  reset(): void {
    this.greenBuffer = [];
    this.redBuffer = [];
    this.blueBuffer = [];
    this.frameTimestamps = [];
    this.filteredSignal = [];
    this.rawSignal = [];
    this.lastBPM = 0;
    this.lastConfidence = 0;
  }
}
