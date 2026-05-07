/**
 * Main Application v2 — with settings panel, blendshapes blink detection, improved rPPG
 */

import './styles.css';
import { RPPGEngine } from './features/rppg/rppg-engine';
import { PostureEngine } from './features/posture/posture-engine';
import { BlinkEngine } from './features/blink/blink-engine';
import { ScreenTimeTracker } from './features/screentime/screentime-tracker';
import { NudgeSystem } from './features/nudge/nudge-system';
import { SettingsManager } from './settings/settings-manager';
import { SignalChart } from './ui/signal-chart';
import { renderLanding, renderDashboard, renderNudge, formatDuration } from './ui/renderer';
import { renderSettingsPanel, bindSettingsPanel } from './ui/settings-panel';
import { FaceMeshDetector } from './vision/face-detector';

class WellnessApp {
  private settingsManager = new SettingsManager();
  private rppg: RPPGEngine;
  private posture = new PostureEngine();
  private blink: BlinkEngine;
  private screenTime = new ScreenTimeTracker();
  private nudgeSystem = new NudgeSystem();
  private faceDetector: FaceMeshDetector | null = null;
  private signalChart: SignalChart | null = null;
  private video: HTMLVideoElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private stream: MediaStream | null = null;
  private animFrameId = 0;
  private running = false;
  private frameCount = 0;
  private openSettingsFn: (() => void) | null = null;
  private lastRppgResult: { bpm: number; confidence: number; signal: number[]; actualFps?: number } | null = null;
  private lastBlinkResult: { blinksPerMinute: number; debugValue?: number; threshold?: number; method?: string } | null = null;

  constructor(private root: HTMLElement) {
    const s = this.settingsManager.get();
    this.rppg = new RPPGEngine(s.rppg);
    this.blink = new BlinkEngine(s.blink);

    // Hot-swap: listen for settings changes
    this.settingsManager.onChange((newSettings) => {
      this.rppg.updateSettings(newSettings.rppg);
      this.blink.updateSettings(newSettings.blink);
    });

    this.showLanding();
  }

  private showLanding(): void {
    this.root.innerHTML = renderLanding(() => this.start());
    const btn = document.getElementById('btn-start');
    btn?.addEventListener('click', () => this.start());
  }

  private async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      // Build dashboard + settings panel
      this.root.innerHTML = renderDashboard() + renderSettingsPanel();

      // Setup video
      this.video = document.getElementById('webcam-video') as HTMLVideoElement;
      this.video.srcObject = this.stream;
      await this.video.play();

      // Setup overlay
      this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
      this.overlayCanvas.width = this.video.videoWidth || 640;
      this.overlayCanvas.height = this.video.videoHeight || 480;
      this.overlayCtx = this.overlayCanvas.getContext('2d')!;

      // Setup chart
      const signalCanvas = document.getElementById('signal-canvas') as HTMLCanvasElement;
      this.signalChart = new SignalChart(signalCanvas);

      // Initialize MediaPipe
      this.faceDetector = new FaceMeshDetector();
      await this.faceDetector.initialize();

      // Bind settings panel
      this.openSettingsFn = bindSettingsPanel(this.settingsManager);

      // Wire buttons
      document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
      document.getElementById('btn-recalibrate')?.addEventListener('click', () => {
        this.posture.recalibrate();
        this.rppg.reset();
        this.updateStatusText('Recalibrating...');
      });
      document.getElementById('btn-settings')?.addEventListener('click', () => {
        this.openSettingsFn?.();
      });

      this.running = true;
      this.processFrame();

    } catch (err) {
      console.error('Failed to start:', err);
      alert('Camera access is required. Please allow camera permissions and try again.');
      this.showLanding();
    }
  }

  private async processFrame(): Promise<void> {
    if (!this.running || !this.video || !this.faceDetector) return;

    this.frameCount++;
    const video = this.video;

    if (video.readyState >= 2) {
      const detection = await this.faceDetector.detect(video);

      if (detection && detection.landmarks.length > 0) {
        const landmarks = detection.landmarks[0];
        this.screenTime.onFaceDetected();

        // Draw overlay
        const showDebug = this.settingsManager.getGeneral().showDebugOverlay;
        this.drawFaceOverlay(landmarks, detection.box, showDebug);

        // rPPG
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(video, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

        if (detection.box) {
          const rgb = this.rppg.extractROI(imageData, detection.box);
          if (rgb) this.rppg.addFrame(rgb);
        }

        // Posture
        const postureResult = this.posture.analyze(landmarks);

        // Blink — pass blendshapes for the new method
        const blinkResult = this.blink.analyze(landmarks, detection.blendshapes ?? undefined);
        this.lastBlinkResult = blinkResult;

        // rPPG computation (every 3 frames)
        let rppgResult = null;
        if (this.frameCount % 3 === 0) {
          rppgResult = this.rppg.computeBPM();
          if (rppgResult) this.lastRppgResult = rppgResult;
        }

        // Screen time
        const screenTimeResult = this.screenTime.getStatus();

        // Update UI
        this.updateMetrics(this.lastRppgResult, postureResult, blinkResult, screenTimeResult);

        // Update debug bar
        if (this.settingsManager.getGeneral().showSignalValues) {
          this.updateDebugBar();
        }

        // Check nudges (every 30 frames)
        if (this.frameCount % 30 === 0) {
          const nudge = this.nudgeSystem.evaluate(
            rppgResult as any, postureResult, blinkResult, screenTimeResult
          );
          if (nudge) this.showNudge(nudge);
        }

        // Draw signal chart
        if (this.lastRppgResult) {
          this.signalChart?.draw(this.lastRppgResult.signal);
        }
      } else {
        this.screenTime.onFaceLost();
        this.clearOverlay();
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.processFrame());
  }

  private drawFaceOverlay(
    landmarks: Array<{ x: number; y: number; z: number }>,
    box: { x: number; y: number; width: number; height: number } | null,
    showDebug: boolean
  ): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    const ctx = this.overlayCtx;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (box) {
      ctx.strokeStyle = 'rgba(77, 195, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.setLineDash([]);

      // ROI box
      const rppgSettings = this.settingsManager.getRPPG();
      let roiX: number, roiY: number, roiW: number, roiH: number;
      if (rppgSettings.roiForehead) {
        roiX = box.x + box.width * 0.25;
        roiY = box.y + box.height * 0.05;
        roiW = box.width * 0.5;
        roiH = box.height * 0.18;
      } else {
        roiX = box.x + box.width * 0.2;
        roiY = box.y + box.height * 0.45;
        roiW = box.width * 0.6;
        roiH = box.height * 0.25;
      }
      ctx.strokeStyle = 'rgba(255, 77, 106, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(roiX, roiY, roiW, roiH);
      ctx.fillStyle = 'rgba(255, 77, 106, 0.08)';
      ctx.fillRect(roiX, roiY, roiW, roiH);

      // Label
      ctx.fillStyle = 'rgba(255, 77, 106, 0.7)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(rppgSettings.roiForehead ? 'rPPG: forehead' : 'rPPG: cheeks', roiX, roiY - 3);
    }

    if (showDebug) {
      // Draw all face mesh points
      ctx.fillStyle = 'rgba(77, 255, 145, 0.3)';
      for (const lm of landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eye landmarks highlighted
      const eyeIndices = [33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380];
      ctx.fillStyle = 'rgba(77, 195, 255, 0.8)';
      for (const idx of eyeIndices) {
        if (landmarks[idx]) {
          ctx.beginPath();
          ctx.arc(landmarks[idx].x * w, landmarks[idx].y * h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Debug text
      if (this.lastBlinkResult) {
        ctx.fillStyle = 'rgba(77, 195, 255, 0.9)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillText(
          `${this.lastBlinkResult.method?.toUpperCase()}: ${this.lastBlinkResult.debugValue} (thr: ${this.lastBlinkResult.threshold})`,
          10, h - 10
        );
      }
    } else {
      // Minimal key landmarks
      ctx.fillStyle = 'rgba(77, 255, 145, 0.6)';
      const keyPoints = [1, 33, 263, 61, 291];
      for (const idx of keyPoints) {
        if (landmarks[idx]) {
          ctx.beginPath();
          ctx.arc(landmarks[idx].x * w, landmarks[idx].y * h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private clearOverlay(): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  private updateMetrics(
    rppg: { bpm: number; confidence: number; signal: number[]; actualFps?: number } | null,
    posture: { state: string; score: number } | null,
    blink: { blinksPerMinute: number; method?: string } | null,
    screenTime: { currentSessionMs: number; nudgeNeeded: boolean; lastBreakAgo: number } | null
  ): void {
    // Heart rate
    if (rppg && rppg.bpm > 0) {
      this.setText('mini-hr', `${rppg.bpm}`);
      this.setText('hr-value', `${rppg.bpm}`);
      const conf = Math.round((rppg.confidence || 0) * 100);
      const fpsText = rppg.actualFps ? ` | ${rppg.actualFps}fps` : '';
      this.setText('signal-confidence', `Confidence: ${conf}%${fpsText}`);
      const hrBadge = rppg.bpm > 100 ? 'Elevated' : rppg.bpm < 55 ? 'Low' : 'Normal';
      const hrClass = rppg.bpm > 100 || rppg.bpm < 50 ? 'warn' : 'good';
      this.setBadge('hr-badge', hrBadge, hrClass);
      this.setTrend('mini-hr-trend', hrBadge, hrClass === 'good' ? 'good' : 'warn');
    }

    // Posture
    if (posture && posture.state !== 'unknown') {
      this.setText('mini-posture', `${posture.score}`);
      this.setText('posture-value', `${posture.score}`);
      const pClass = posture.state === 'good' ? 'good' : 'warn';
      const pLabel = posture.state === 'good' ? 'Good' : 'Slouching';
      this.setBadge('posture-badge', pLabel, pClass);
      this.setTrend('mini-posture-trend', pLabel, pClass);
    }

    // Blink
    if (blink) {
      const methodTag = blink.method === 'blendshapes' ? ' (BS)' : ' (EAR)';
      this.setText('mini-blink', `${blink.blinksPerMinute}`);
      this.setText('blink-value', `${blink.blinksPerMinute}`);
      const bClass = blink.blinksPerMinute >= 10 ? 'good' : blink.blinksPerMinute > 0 ? 'warn' : 'neutral';
      const bLabel = blink.blinksPerMinute >= 10 ? 'Healthy' : blink.blinksPerMinute > 0 ? 'Low' : 'Measuring';
      this.setBadge('blink-badge', bLabel + methodTag, bClass);
      this.setTrend('mini-blink-trend', bLabel, bClass);
    }

    // Screen time
    if (screenTime) {
      const dur = formatDuration(screenTime.currentSessionMs);
      this.setText('mini-time', dur);
      this.setText('time-value', dur);
      const tClass = screenTime.lastBreakAgo > 60 * 60 * 1000 ? 'warn' : 'good';
      const tLabel = screenTime.nudgeNeeded ? 'Break Needed' : 'Active';
      this.setBadge('time-badge', tLabel, tClass);
      this.setTrend('mini-time-trend', tLabel, tClass);
    }
  }

  private updateDebugBar(): void {
    let bar = document.getElementById('debug-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'debug-bar';
      bar.className = 'debug-bar';
      document.querySelector('.dashboard')?.appendChild(bar);
    }

    const items: string[] = [];
    if (this.lastRppgResult) {
      items.push(`<span class="debug-bar__item"><span class="debug-bar__label">FPS:</span><span class="debug-bar__value">${this.lastRppgResult.actualFps ?? '?'}</span></span>`);
      items.push(`<span class="debug-bar__item"><span class="debug-bar__label">BPM:</span><span class="debug-bar__value">${this.lastRppgResult.bpm}</span></span>`);
      items.push(`<span class="debug-bar__item"><span class="debug-bar__label">Conf:</span><span class="debug-bar__value">${Math.round(this.lastRppgResult.confidence * 100)}%</span></span>`);
    }
    if (this.lastBlinkResult) {
      items.push(`<span class="debug-bar__item"><span class="debug-bar__label">Blink(${this.lastBlinkResult.method}):</span><span class="debug-bar__value">${this.lastBlinkResult.debugValue}</span></span>`);
      items.push(`<span class="debug-bar__item"><span class="debug-bar__label">Thr:</span><span class="debug-bar__value">${this.lastBlinkResult.threshold}</span></span>`);
    }
    bar.innerHTML = items.join('');
  }

  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  private setBadge(id: string, text: string, type: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = `vital-card__badge vital-card__badge--${type}`;
    }
  }

  private setTrend(id: string, text: string, type: string): void {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
      el.className = `metric-mini__trend metric-mini__trend--${type}`;
    }
  }

  private updateStatusText(text: string): void {
    const el = document.getElementById('status-text');
    if (el) el.textContent = text;
    setTimeout(() => { if (el) el.textContent = 'Processing'; }, 2000);
  }

  private showNudge(nudge: any): void {
    const container = document.getElementById('nudge-container');
    if (!container) return;
    container.innerHTML = renderNudge(nudge);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(nudge.title, { body: nudge.body });
    } else if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    document.getElementById('nudge-close')?.addEventListener('click', () => {
      container.innerHTML = '';
      this.nudgeSystem.dismiss();
    });
    document.getElementById('nudge-dismiss')?.addEventListener('click', () => {
      container.innerHTML = '';
      this.nudgeSystem.dismiss();
    });
    document.getElementById('nudge-break')?.addEventListener('click', () => {
      container.innerHTML = '';
      this.nudgeSystem.dismiss();
      this.screenTime.acknowledgeNudge();
    });
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animFrameId);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.rppg.reset();
    this.blink.reset();
    this.posture.recalibrate();
    this.faceDetector?.close();
    this.faceDetector = null;
    this.lastRppgResult = null;
    this.lastBlinkResult = null;
    this.showLanding();
  }
}

// Boot
const app = document.getElementById('app');
if (app) new WellnessApp(app);
