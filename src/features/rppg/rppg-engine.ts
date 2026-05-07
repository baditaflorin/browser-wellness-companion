/**
 * rPPG (Remote Photoplethysmography) Engine
 * Extracts pulse signal from facial skin color variations captured by webcam.
 * Uses the green channel chrominance method (CHROM) for robust BVP extraction.
 */

export interface RPPGResult {
  bpm: number;
  confidence: number;
  signal: number[];
  timestamp: number;
}

export class RPPGEngine {
  private readonly bufferSize = 256; // ~8.5s at 30fps
  private readonly fps = 30;
  private greenBuffer: number[] = [];
  private redBuffer: number[] = [];
  private blueBuffer: number[] = [];
  private lastBPM = 0;
  private lastConfidence = 0;
  private filteredSignal: number[] = [];

  /** Extract mean RGB from a facial ROI */
  extractROI(
    imageData: ImageData,
    faceBox: { x: number; y: number; width: number; height: number }
  ): { r: number; g: number; b: number } | null {
    const { data, width } = imageData;
    const forehead = {
      x: Math.floor(faceBox.x + faceBox.width * 0.3),
      y: Math.floor(faceBox.y + faceBox.height * 0.08),
      w: Math.floor(faceBox.width * 0.4),
      h: Math.floor(faceBox.height * 0.15),
    };

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let dy = 0; dy < forehead.h; dy++) {
      for (let dx = 0; dx < forehead.w; dx++) {
        const px = forehead.x + dx;
        const py = forehead.y + dy;
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
    this.redBuffer.push(rgb.r);
    this.greenBuffer.push(rgb.g);
    this.blueBuffer.push(rgb.b);

    if (this.redBuffer.length > this.bufferSize) {
      this.redBuffer.shift();
      this.greenBuffer.shift();
      this.blueBuffer.shift();
    }
  }

  /** Compute BPM using CHROM method */
  computeBPM(): RPPGResult {
    const now = Date.now();
    if (this.greenBuffer.length < 90) { // need ~3s min
      return { bpm: this.lastBPM, confidence: 0, signal: this.filteredSignal, timestamp: now };
    }

    const n = this.greenBuffer.length;

    // Normalize channels
    const rNorm = this.normalize(this.redBuffer);
    const gNorm = this.normalize(this.greenBuffer);
    const bNorm = this.normalize(this.blueBuffer);

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

    // Bandpass filter 0.7-3.5 Hz (42-210 BPM)
    const filtered = this.bandpassFilter(bvp, this.fps, 0.7, 3.5);
    this.filteredSignal = filtered.slice(-128);

    // FFT for peak frequency
    const { frequency, confidence } = this.findDominantFrequency(filtered, this.fps);
    const bpm = Math.round(frequency * 60);

    // Sanity check
    if (bpm >= 40 && bpm <= 200 && confidence > 0.3) {
      this.lastBPM = this.lastBPM > 0 ? Math.round(this.lastBPM * 0.7 + bpm * 0.3) : bpm;
      this.lastConfidence = confidence;
    }

    return { bpm: this.lastBPM, confidence: this.lastConfidence, signal: this.filteredSignal, timestamp: now };
  }

  private normalize(arr: number[]): number[] {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = this.std(arr);
    if (std < 0.001) return arr.map(() => 0);
    return arr.map(v => (v - mean) / std);
  }

  private std(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  /** Simple IIR bandpass via cascaded high-pass + low-pass */
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

  /** Find dominant frequency via autocorrelation (faster than FFT for our use case) */
  private findDominantFrequency(signal: number[], fs: number): { frequency: number; confidence: number } {
    const n = signal.length;
    const minLag = Math.floor(fs / 3.5); // 3.5 Hz = 210 BPM
    const maxLag = Math.floor(fs / 0.7); // 0.7 Hz = 42 BPM
    const safeLag = Math.min(maxLag, Math.floor(n / 2));

    let bestLag = minLag;
    let bestCorr = -Infinity;
    let energy = 0;

    // Compute energy for normalization
    for (let i = 0; i < n; i++) energy += signal[i] * signal[i];
    if (energy < 0.001) return { frequency: 0, confidence: 0 };

    for (let lag = minLag; lag <= safeLag; lag++) {
      let corr = 0;
      for (let i = 0; i < n - lag; i++) {
        corr += signal[i] * signal[i + lag];
      }
      corr /= (n - lag);
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    const frequency = fs / bestLag;
    const normEnergy = energy / n;
    const confidence = normEnergy > 0.001 ? Math.min(1, Math.max(0, bestCorr / normEnergy)) : 0;

    return { frequency, confidence };
  }

  reset(): void {
    this.greenBuffer = [];
    this.redBuffer = [];
    this.blueBuffer = [];
    this.filteredSignal = [];
    this.lastBPM = 0;
    this.lastConfidence = 0;
  }
}
