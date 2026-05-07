/**
 * Main Application — Orchestrates all engines and UI
 */

import './styles.css';
import { RPPGEngine } from './features/rppg/rppg-engine';
import { PostureEngine } from './features/posture/posture-engine';
import { BlinkEngine } from './features/blink/blink-engine';
import { ScreenTimeTracker } from './features/screentime/screentime-tracker';
import { NudgeSystem } from './features/nudge/nudge-system';
import { SignalChart } from './ui/signal-chart';
import { renderLanding, renderDashboard, renderNudge, formatDuration } from './ui/renderer';
import { FaceMeshDetector } from './vision/face-detector';

class WellnessApp {
  private rppg = new RPPGEngine();
  private posture = new PostureEngine();
  private blink = new BlinkEngine();
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

  constructor(private root: HTMLElement) {
    this.showLanding();
  }

  private showLanding(): void {
    this.root.innerHTML = renderLanding(() => this.start());
    const btn = document.getElementById('btn-start');
    btn?.addEventListener('click', () => this.start());
  }

  private async start(): Promise<void> {
    try {
      // Request camera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      // Switch to dashboard
      this.root.innerHTML = renderDashboard();

      // Setup video
      this.video = document.getElementById('webcam-video') as HTMLVideoElement;
      this.video.srcObject = this.stream;
      await this.video.play();

      // Setup overlay canvas
      this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
      this.overlayCanvas.width = this.video.videoWidth || 640;
      this.overlayCanvas.height = this.video.videoHeight || 480;
      this.overlayCtx = this.overlayCanvas.getContext('2d')!;

      // Setup signal chart
      const signalCanvas = document.getElementById('signal-canvas') as HTMLCanvasElement;
      this.signalChart = new SignalChart(signalCanvas);

      // Initialize face detector
      this.faceDetector = new FaceMeshDetector();
      await this.faceDetector.initialize();

      // Wire buttons
      document.getElementById('btn-stop')?.addEventListener('click', () => this.stop());
      document.getElementById('btn-recalibrate')?.addEventListener('click', () => {
        this.posture.recalibrate();
        this.updateStatusText('Recalibrating...');
      });

      // Start processing loop
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
      // Detect face
      const detection = await this.faceDetector.detect(video);

      if (detection && detection.landmarks.length > 0) {
        const landmarks = detection.landmarks[0];

        // Screen time — face visible
        this.screenTime.onFaceDetected();

        // Draw face overlay
        this.drawFaceOverlay(landmarks, detection.box);

        // rPPG — extract ROI from video frame
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

        // Posture analysis
        const postureResult = this.posture.analyze(landmarks);

        // Blink detection
        const blinkResult = this.blink.analyze(landmarks);

        // rPPG computation (every 3 frames to save CPU)
        let rppgResult = null;
        if (this.frameCount % 3 === 0) {
          rppgResult = this.rppg.computeBPM();
        }

        // Screen time status
        const screenTimeResult = this.screenTime.getStatus();

        // Update UI
        this.updateMetrics(rppgResult, postureResult, blinkResult, screenTimeResult);

        // Check nudges (every 30 frames ~ 1s)
        if (this.frameCount % 30 === 0) {
          const nudge = this.nudgeSystem.evaluate(
            rppgResult, postureResult, blinkResult, screenTimeResult
          );
          if (nudge) this.showNudge(nudge);
        }

        // Draw signal chart
        if (rppgResult) {
          this.signalChart?.draw(rppgResult.signal);
        }
      } else {
        // No face detected
        this.screenTime.onFaceLost();
        this.clearOverlay();
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.processFrame());
  }

  private drawFaceOverlay(landmarks: Array<{ x: number; y: number; z: number }>, box: { x: number; y: number; width: number; height: number } | null): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    const ctx = this.overlayCtx;
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw face bounding box
    if (box) {
      ctx.strokeStyle = 'rgba(77, 195, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.setLineDash([]);
    }

    // Draw key landmarks (eyes, nose, mouth outline)
    ctx.fillStyle = 'rgba(77, 255, 145, 0.6)';
    const keyPoints = [1, 33, 263, 61, 291, 199]; // nose, eyes, mouth corners
    for (const idx of keyPoints) {
      if (landmarks[idx]) {
        ctx.beginPath();
        ctx.arc(landmarks[idx].x * w, landmarks[idx].y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw forehead ROI box (where rPPG samples)
    if (box) {
      ctx.strokeStyle = 'rgba(255, 77, 106, 0.5)';
      ctx.lineWidth = 1;
      const roiX = box.x + box.width * 0.3;
      const roiY = box.y + box.height * 0.08;
      const roiW = box.width * 0.4;
      const roiH = box.height * 0.15;
      ctx.strokeRect(roiX, roiY, roiW, roiH);
      ctx.fillStyle = 'rgba(255, 77, 106, 0.08)';
      ctx.fillRect(roiX, roiY, roiW, roiH);
    }
  }

  private clearOverlay(): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  private lastRppgResult: { bpm: number; confidence: number; signal: number[] } | null = null;

  private updateMetrics(
    rppg: { bpm: number; confidence: number; signal: number[] } | null,
    posture: { state: string; score: number } | null,
    blink: { blinksPerMinute: number } | null,
    screenTime: { currentSessionMs: number; nudgeNeeded: boolean; lastBreakAgo: number } | null
  ): void {
    // Cache rPPG result
    if (rppg) this.lastRppgResult = rppg;
    const hr = this.lastRppgResult;

    // Heart rate
    if (hr && hr.bpm > 0) {
      this.setText('mini-hr', `${hr.bpm}`);
      this.setText('hr-value', `${hr.bpm}`);
      this.setText('signal-confidence', `Confidence: ${Math.round((hr.confidence || 0) * 100)}%`);
      const hrBadge = hr.bpm > 100 ? 'Elevated' : hr.bpm < 60 ? 'Low' : 'Normal';
      const hrClass = hr.bpm > 100 ? 'warn' : 'good';
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

    // Blink rate
    if (blink) {
      this.setText('mini-blink', `${blink.blinksPerMinute}`);
      this.setText('blink-value', `${blink.blinksPerMinute}`);
      const bClass = blink.blinksPerMinute >= 10 ? 'good' : blink.blinksPerMinute > 0 ? 'warn' : 'neutral';
      const bLabel = blink.blinksPerMinute >= 10 ? 'Healthy' : blink.blinksPerMinute > 0 ? 'Low' : 'Measuring';
      this.setBadge('blink-badge', bLabel, bClass);
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
    setTimeout(() => {
      if (el) el.textContent = 'Processing';
    }, 2000);
  }

  private showNudge(nudge: { id: string; type: string; severity: string; title: string; body: string; suggestion: string; icon: string }): void {
    const container = document.getElementById('nudge-container');
    if (!container) return;
    container.innerHTML = renderNudge(nudge as any);

    // Request browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(nudge.title, { body: nudge.body, icon: '💓' });
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
    this.showLanding();
  }
}

// Boot
const app = document.getElementById('app');
if (app) new WellnessApp(app);
