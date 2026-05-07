/**
 * UI Renderer — builds and updates the dashboard DOM
 */

import type { NudgeMessage } from '../features/nudge/nudge-system';

export function renderLanding(onStart: () => void): string {
  return `
    <div class="bg-grid"></div>
    <div class="bg-orbs">
      <div class="bg-orb bg-orb--1"></div>
      <div class="bg-orb bg-orb--2"></div>
      <div class="bg-orb bg-orb--3"></div>
    </div>
    <div class="landing fade-in">
      <div class="landing__logo">💓</div>
      <h1 class="landing__title">Wellness Companion</h1>
      <p class="landing__subtitle">
        Your ambient health monitor. Pulse, posture, blink rate — all from your webcam.
        No wearables. No subscriptions. Never leaves your device.
      </p>
      <div class="landing__features">
        <div class="feature-chip">
          <span class="feature-chip__icon">❤️</span>
          <span class="feature-chip__text"><strong>Heart Rate</strong>rPPG pulse detection via facial color changes</span>
        </div>
        <div class="feature-chip">
          <span class="feature-chip__icon">🧘</span>
          <span class="feature-chip__text"><strong>Posture Check</strong>Head position & slouch detection</span>
        </div>
        <div class="feature-chip">
          <span class="feature-chip__icon">👁️</span>
          <span class="feature-chip__text"><strong>Blink Rate</strong>Eye strain monitoring & dry eye prevention</span>
        </div>
        <div class="feature-chip">
          <span class="feature-chip__icon">⏱️</span>
          <span class="feature-chip__text"><strong>Screen Time</strong>Break reminders after 90 min sessions</span>
        </div>
      </div>
      <button id="btn-start" class="btn-start">
        <span>📷</span> Enable Camera & Start
      </button>
      <div class="landing__privacy">
        🔒 100% local processing — zero data leaves your browser
      </div>
    </div>
  `;
}

export function renderDashboard(): string {
  return `
    <div class="bg-grid"></div>
    <div class="dashboard fade-in">
      <header class="dashboard__header">
        <div class="dashboard__brand">
          <div class="dashboard__brand-icon">💓</div>
          <span>Wellness Companion</span>
        </div>
        <div class="dashboard__actions">
          <button id="btn-settings" class="btn-icon" title="Detection Settings">⚙️</button>
          <button id="btn-recalibrate" class="btn-icon" title="Recalibrate Posture">🔄</button>
          <button id="btn-stop" class="btn-icon" title="Stop Camera">⏹️</button>
        </div>
      </header>
      <main class="dashboard__body">
        <aside class="camera-panel">
          <div class="camera-panel__header">
            <span class="camera-panel__title">Live Feed</span>
            <span class="camera-panel__status">
              <span class="status-dot status-dot--active" id="status-dot"></span>
              <span id="status-text">Processing</span>
            </span>
          </div>
          <div class="camera-panel__video-wrap">
            <video id="webcam-video" class="camera-panel__video" autoplay playsinline muted></video>
            <canvas id="overlay-canvas" class="camera-panel__canvas"></canvas>
          </div>
          <div class="camera-panel__metrics">
            <div class="metric-mini">
              <div class="metric-mini__icon metric-mini__icon--pulse">❤️</div>
              <div class="metric-mini__info">
                <div class="metric-mini__label">Heart Rate</div>
                <div class="metric-mini__value metric-mini__value--pulse" id="mini-hr">--</div>
              </div>
              <span class="metric-mini__trend metric-mini__trend--neutral" id="mini-hr-trend">—</span>
            </div>
            <div class="metric-mini">
              <div class="metric-mini__icon metric-mini__icon--posture">🧘</div>
              <div class="metric-mini__info">
                <div class="metric-mini__label">Posture</div>
                <div class="metric-mini__value metric-mini__value--posture" id="mini-posture">--</div>
              </div>
              <span class="metric-mini__trend metric-mini__trend--neutral" id="mini-posture-trend">—</span>
            </div>
            <div class="metric-mini">
              <div class="metric-mini__icon metric-mini__icon--blink">👁️</div>
              <div class="metric-mini__info">
                <div class="metric-mini__label">Blink Rate</div>
                <div class="metric-mini__value metric-mini__value--blink" id="mini-blink">--</div>
              </div>
              <span class="metric-mini__trend metric-mini__trend--neutral" id="mini-blink-trend">—</span>
            </div>
            <div class="metric-mini">
              <div class="metric-mini__icon metric-mini__icon--time">⏱️</div>
              <div class="metric-mini__info">
                <div class="metric-mini__label">Session</div>
                <div class="metric-mini__value metric-mini__value--time" id="mini-time">0:00</div>
              </div>
              <span class="metric-mini__trend metric-mini__trend--neutral" id="mini-time-trend">—</span>
            </div>
          </div>
        </aside>
        <section class="card">
          <div class="card__header">
            <span class="card__title">📈 Pulse Signal (rPPG)</span>
            <span id="signal-confidence" style="font-size:0.75rem;color:var(--text-muted)">Confidence: --</span>
          </div>
          <div class="card__body">
            <div class="signal-chart">
              <canvas id="signal-canvas"></canvas>
            </div>
          </div>
        </section>
        <section class="card">
          <div class="card__header">
            <span class="card__title">📊 Wellness Overview</span>
          </div>
          <div class="card__body">
            <div class="vitals-grid">
              <div class="vital-card">
                <div class="vital-card__glow" style="background:var(--accent-pulse)"></div>
                <div class="vital-card__header">
                  <span class="vital-card__icon">❤️</span>
                  <span class="vital-card__badge vital-card__badge--neutral" id="hr-badge">Measuring</span>
                </div>
                <div class="vital-card__value" id="hr-value" style="color:var(--accent-pulse)">--</div>
                <div class="vital-card__unit">BPM <span class="vital-card__label" id="hr-label">Heart rate via rPPG</span></div>
              </div>
              <div class="vital-card">
                <div class="vital-card__glow" style="background:var(--accent-posture)"></div>
                <div class="vital-card__header">
                  <span class="vital-card__icon">🧘</span>
                  <span class="vital-card__badge vital-card__badge--neutral" id="posture-badge">Calibrating</span>
                </div>
                <div class="vital-card__value" id="posture-value" style="color:var(--accent-posture)">--</div>
                <div class="vital-card__unit">/ 100 <span class="vital-card__label" id="posture-label">Posture score</span></div>
              </div>
              <div class="vital-card">
                <div class="vital-card__glow" style="background:var(--accent-blink)"></div>
                <div class="vital-card__header">
                  <span class="vital-card__icon">👁️</span>
                  <span class="vital-card__badge vital-card__badge--neutral" id="blink-badge">Measuring</span>
                </div>
                <div class="vital-card__value" id="blink-value" style="color:var(--accent-blink)">--</div>
                <div class="vital-card__unit">blinks/min <span class="vital-card__label" id="blink-label">Eye strain indicator</span></div>
              </div>
              <div class="vital-card">
                <div class="vital-card__glow" style="background:var(--accent-time)"></div>
                <div class="vital-card__header">
                  <span class="vital-card__icon">⏱️</span>
                  <span class="vital-card__badge vital-card__badge--neutral" id="time-badge">Active</span>
                </div>
                <div class="vital-card__value" id="time-value" style="color:var(--accent-time)">0:00</div>
                <div class="vital-card__unit">session <span class="vital-card__label" id="time-label">Current screen time</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
    <div id="nudge-container"></div>
  `;
}

export function renderNudge(nudge: NudgeMessage): string {
  return `
    <div class="nudge-overlay fade-in" id="nudge-${nudge.id}">
      <div class="nudge">
        <div class="nudge__header">
          <span class="nudge__title">${nudge.icon} ${nudge.title}</span>
          <button class="nudge__close" id="nudge-close">✕</button>
        </div>
        <div class="nudge__body">
          <p>${nudge.body}</p>
          <p style="margin-top:0.5rem;color:var(--text-primary);font-weight:500">${nudge.suggestion}</p>
        </div>
        <div class="nudge__actions">
          <button class="nudge__btn nudge__btn--primary" id="nudge-break">Take a Break</button>
          <button class="nudge__btn nudge__btn--secondary" id="nudge-dismiss">Dismiss</button>
        </div>
      </div>
    </div>
  `;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
