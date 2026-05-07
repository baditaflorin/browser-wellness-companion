/**
 * Signal Chart — renders the rPPG waveform on a canvas
 */

export class SignalChart {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private dpr: number;

  constructor(private canvas: HTMLCanvasElement) {
    this.dpr = window.devicePixelRatio || 1;
    this.ctx = canvas.getContext('2d')!;
    this.width = 0;
    this.height = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  draw(signal: number[], color = '#ff4d6a', glowColor = 'rgba(255, 77, 106, 0.3)'): void {
    const { ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    if (signal.length < 2) {
      this.drawPlaceholder();
      return;
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Normalize signal to fit canvas
    const max = Math.max(...signal.map(Math.abs)) || 1;
    const mid = height / 2;
    const scale = (height * 0.35) / max;

    // Glow effect
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < signal.length; i++) {
      const x = (i / (signal.length - 1)) * width;
      const y = mid - signal[i] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill underneath
    ctx.shadowBlur = 0;
    ctx.lineTo(width, mid);
    ctx.lineTo(0, mid);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 77, 106, 0.08)');
    gradient.addColorStop(0.5, 'rgba(255, 77, 106, 0.02)');
    gradient.addColorStop(1, 'rgba(255, 77, 106, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Current value indicator dot
    const lastX = width;
    const lastY = mid - signal[signal.length - 1] * scale;
    ctx.beginPath();
    ctx.arc(lastX - 2, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private drawPlaceholder(): void {
    const { ctx, width, height } = this;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for signal...', width / 2, height / 2);
  }
}
