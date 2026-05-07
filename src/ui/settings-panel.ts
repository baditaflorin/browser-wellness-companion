/**
 * Settings Panel UI — slide-out panel for tweaking all detection parameters
 */

import type { SettingsManager, AllSettings } from '../settings/settings-manager';

export function renderSettingsPanel(): string {
  return `
    <div class="settings-overlay" id="settings-overlay">
      <div class="settings-panel" id="settings-panel">
        <div class="settings-panel__header">
          <h2 class="settings-panel__title">⚙️ Detection Settings</h2>
          <button class="settings-panel__close" id="settings-close">✕</button>
        </div>
        <div class="settings-panel__body" id="settings-body">
          <!-- Heart Rate (rPPG) -->
          <div class="settings-section">
            <h3 class="settings-section__title">❤️ Heart Rate (rPPG)</h3>
            <div class="settings-group">
              <label class="setting-row">
                <span class="setting-row__label">Buffer Duration</span>
                <span class="setting-row__value" id="val-bufferSizeSec">8s</span>
                <input type="range" min="4" max="15" step="1" id="set-bufferSizeSec" class="setting-slider" />
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Min BPM (bandpass low)</span>
                <span class="setting-row__value" id="val-bandpassLow">45</span>
                <input type="range" min="0.5" max="1.2" step="0.05" id="set-bandpassLow" class="setting-slider" />
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Max BPM (bandpass high)</span>
                <span class="setting-row__value" id="val-bandpassHigh">180</span>
                <input type="range" min="2.0" max="4.0" step="0.1" id="set-bandpassHigh" class="setting-slider" />
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Smoothing</span>
                <span class="setting-row__value" id="val-smoothingFactor">0.6</span>
                <input type="range" min="0.1" max="0.95" step="0.05" id="set-smoothingFactor" class="setting-slider" />
                <span class="setting-row__hint">Lower = more reactive, higher = more stable</span>
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Min Confidence</span>
                <span class="setting-row__value" id="val-minConfidence">0.2</span>
                <input type="range" min="0.05" max="0.8" step="0.05" id="set-minConfidence" class="setting-slider" />
              </label>
              <label class="setting-row setting-row--toggle">
                <span class="setting-row__label">Detrending (fixes mobile drift)</span>
                <input type="checkbox" id="set-useDetrending" class="setting-toggle" />
              </label>
              <label class="setting-row setting-row--toggle">
                <span class="setting-row__label">ROI: Forehead</span>
                <input type="checkbox" id="set-roiForehead" class="setting-toggle" />
                <span class="setting-row__hint">Off = cheeks (stronger signal, more noise)</span>
              </label>
            </div>
          </div>

          <!-- Blink Detection -->
          <div class="settings-section">
            <h3 class="settings-section__title">👁️ Blink Detection</h3>
            <div class="settings-group">
              <label class="setting-row">
                <span class="setting-row__label">Detection Method</span>
                <select id="set-blinkMethod" class="setting-select">
                  <option value="blendshapes">Blendshapes (recommended)</option>
                  <option value="ear">Eye Aspect Ratio (EAR)</option>
                </select>
              </label>
              <label class="setting-row" id="row-earThreshold">
                <span class="setting-row__label">EAR Threshold</span>
                <span class="setting-row__value" id="val-earThreshold">0.17</span>
                <input type="range" min="0.10" max="0.30" step="0.01" id="set-earThreshold" class="setting-slider" />
              </label>
              <label class="setting-row" id="row-blendshapeThreshold">
                <span class="setting-row__label">Blendshape Threshold</span>
                <span class="setting-row__value" id="val-blendshapeThreshold">0.5</span>
                <input type="range" min="0.2" max="0.8" step="0.05" id="set-blendshapeThreshold" class="setting-slider" />
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Consecutive Frames</span>
                <span class="setting-row__value" id="val-consecFrames">3</span>
                <input type="range" min="1" max="6" step="1" id="set-consecFrames" class="setting-slider" />
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Debounce (ms)</span>
                <span class="setting-row__value" id="val-debounceMs">200</span>
                <input type="range" min="50" max="500" step="25" id="set-debounceMs" class="setting-slider" />
              </label>
              <label class="setting-row">
                <span class="setting-row__label">Signal Smoothing</span>
                <span class="setting-row__value" id="val-earSmoothing">0.6</span>
                <input type="range" min="0.1" max="0.9" step="0.05" id="set-earSmoothing" class="setting-slider" />
              </label>
            </div>
          </div>

          <!-- Posture -->
          <div class="settings-section">
            <h3 class="settings-section__title">🧘 Posture</h3>
            <div class="settings-group">
              <label class="setting-row">
                <span class="setting-row__label">Sensitivity</span>
                <span class="setting-row__value" id="val-sensitivity">5</span>
                <input type="range" min="1" max="10" step="1" id="set-sensitivity" class="setting-slider" />
                <span class="setting-row__hint">Higher = triggers sooner on slight slouch</span>
              </label>
            </div>
          </div>

          <!-- Debug -->
          <div class="settings-section">
            <h3 class="settings-section__title">🔧 Debug</h3>
            <div class="settings-group">
              <label class="setting-row setting-row--toggle">
                <span class="setting-row__label">Show Debug Overlay</span>
                <input type="checkbox" id="set-showDebugOverlay" class="setting-toggle" />
              </label>
              <label class="setting-row setting-row--toggle">
                <span class="setting-row__label">Show Raw Values</span>
                <input type="checkbox" id="set-showSignalValues" class="setting-toggle" />
              </label>
            </div>
          </div>

          <div class="settings-actions">
            <button class="settings-btn settings-btn--reset" id="settings-reset">Reset All to Defaults</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindSettingsPanel(manager: SettingsManager): () => void {
  const s = manager.get();

  // Initialize values
  setSlider('set-bufferSizeSec', s.rppg.bufferSizeSec, 'val-bufferSizeSec', v => `${v}s`);
  setSlider('set-bandpassLow', s.rppg.bandpassLow, 'val-bandpassLow', v => `${Math.round(v * 60)}`);
  setSlider('set-bandpassHigh', s.rppg.bandpassHigh, 'val-bandpassHigh', v => `${Math.round(v * 60)}`);
  setSlider('set-smoothingFactor', s.rppg.smoothingFactor, 'val-smoothingFactor', v => `${v}`);
  setSlider('set-minConfidence', s.rppg.minConfidence, 'val-minConfidence', v => `${v}`);
  setCheckbox('set-useDetrending', s.rppg.useDetrending);
  setCheckbox('set-roiForehead', s.rppg.roiForehead);

  setSelect('set-blinkMethod', s.blink.method);
  setSlider('set-earThreshold', s.blink.earThreshold, 'val-earThreshold', v => `${v}`);
  setSlider('set-blendshapeThreshold', s.blink.blendshapeThreshold, 'val-blendshapeThreshold', v => `${v}`);
  setSlider('set-consecFrames', s.blink.consecFrames, 'val-consecFrames', v => `${v}`);
  setSlider('set-debounceMs', s.blink.debounceMs, 'val-debounceMs', v => `${v}`);
  setSlider('set-earSmoothing', s.blink.earSmoothing, 'val-earSmoothing', v => `${v}`);

  setSlider('set-sensitivity', s.posture.sensitivity, 'val-sensitivity', v => `${v}`);
  setCheckbox('set-showDebugOverlay', s.general.showDebugOverlay);
  setCheckbox('set-showSignalValues', s.general.showSignalValues);

  updateBlinkMethodVisibility(s.blink.method);

  // Bind rPPG sliders
  bindSlider('set-bufferSizeSec', 'val-bufferSizeSec', v => `${v}s`, v =>
    manager.update('rppg', { bufferSizeSec: Number(v) }));
  bindSlider('set-bandpassLow', 'val-bandpassLow', v => `${Math.round(Number(v) * 60)}`, v =>
    manager.update('rppg', { bandpassLow: Number(v) }));
  bindSlider('set-bandpassHigh', 'val-bandpassHigh', v => `${Math.round(Number(v) * 60)}`, v =>
    manager.update('rppg', { bandpassHigh: Number(v) }));
  bindSlider('set-smoothingFactor', 'val-smoothingFactor', v => `${v}`, v =>
    manager.update('rppg', { smoothingFactor: Number(v) }));
  bindSlider('set-minConfidence', 'val-minConfidence', v => `${v}`, v =>
    manager.update('rppg', { minConfidence: Number(v) }));
  bindCheckbox('set-useDetrending', v => manager.update('rppg', { useDetrending: v }));
  bindCheckbox('set-roiForehead', v => manager.update('rppg', { roiForehead: v }));

  // Bind blink controls
  const methodSelect = document.getElementById('set-blinkMethod') as HTMLSelectElement | null;
  methodSelect?.addEventListener('change', () => {
    const method = methodSelect.value as 'ear' | 'blendshapes';
    manager.update('blink', { method });
    updateBlinkMethodVisibility(method);
  });

  bindSlider('set-earThreshold', 'val-earThreshold', v => `${v}`, v =>
    manager.update('blink', { earThreshold: Number(v) }));
  bindSlider('set-blendshapeThreshold', 'val-blendshapeThreshold', v => `${v}`, v =>
    manager.update('blink', { blendshapeThreshold: Number(v) }));
  bindSlider('set-consecFrames', 'val-consecFrames', v => `${v}`, v =>
    manager.update('blink', { consecFrames: Number(v) }));
  bindSlider('set-debounceMs', 'val-debounceMs', v => `${v}`, v =>
    manager.update('blink', { debounceMs: Number(v) }));
  bindSlider('set-earSmoothing', 'val-earSmoothing', v => `${v}`, v =>
    manager.update('blink', { earSmoothing: Number(v) }));

  // Posture
  bindSlider('set-sensitivity', 'val-sensitivity', v => `${v}`, v =>
    manager.update('posture', { sensitivity: Number(v) }));

  // Debug
  bindCheckbox('set-showDebugOverlay', v => manager.update('general', { showDebugOverlay: v }));
  bindCheckbox('set-showSignalValues', v => manager.update('general', { showSignalValues: v }));

  // Reset button
  document.getElementById('settings-reset')?.addEventListener('click', () => {
    manager.resetAll();
    // Re-populate all fields
    const d = manager.get();
    setSlider('set-bufferSizeSec', d.rppg.bufferSizeSec, 'val-bufferSizeSec', v => `${v}s`);
    setSlider('set-bandpassLow', d.rppg.bandpassLow, 'val-bandpassLow', v => `${Math.round(v * 60)}`);
    setSlider('set-bandpassHigh', d.rppg.bandpassHigh, 'val-bandpassHigh', v => `${Math.round(v * 60)}`);
    setSlider('set-smoothingFactor', d.rppg.smoothingFactor, 'val-smoothingFactor', v => `${v}`);
    setSlider('set-minConfidence', d.rppg.minConfidence, 'val-minConfidence', v => `${v}`);
    setCheckbox('set-useDetrending', d.rppg.useDetrending);
    setCheckbox('set-roiForehead', d.rppg.roiForehead);
    setSelect('set-blinkMethod', d.blink.method);
    setSlider('set-earThreshold', d.blink.earThreshold, 'val-earThreshold', v => `${v}`);
    setSlider('set-blendshapeThreshold', d.blink.blendshapeThreshold, 'val-blendshapeThreshold', v => `${v}`);
    setSlider('set-consecFrames', d.blink.consecFrames, 'val-consecFrames', v => `${v}`);
    setSlider('set-debounceMs', d.blink.debounceMs, 'val-debounceMs', v => `${v}`);
    setSlider('set-earSmoothing', d.blink.earSmoothing, 'val-earSmoothing', v => `${v}`);
    setSlider('set-sensitivity', d.posture.sensitivity, 'val-sensitivity', v => `${v}`);
    setCheckbox('set-showDebugOverlay', d.general.showDebugOverlay);
    setCheckbox('set-showSignalValues', d.general.showSignalValues);
    updateBlinkMethodVisibility(d.blink.method);
  });

  // Open/close
  const overlay = document.getElementById('settings-overlay');
  const closeBtn = document.getElementById('settings-close');
  closeBtn?.addEventListener('click', () => overlay?.classList.remove('open'));
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  return () => overlay?.classList.add('open');
}

function updateBlinkMethodVisibility(method: string): void {
  const earRow = document.getElementById('row-earThreshold');
  const bsRow = document.getElementById('row-blendshapeThreshold');
  if (earRow) earRow.style.display = method === 'ear' ? '' : 'none';
  if (bsRow) bsRow.style.display = method === 'blendshapes' ? '' : 'none';
}

function setSlider(id: string, value: number, labelId: string, fmt: (v: number) => string): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const label = document.getElementById(labelId);
  if (el) el.value = String(value);
  if (label) label.textContent = fmt(value);
}

function setCheckbox(id: string, checked: boolean): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.checked = checked;
}

function setSelect(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el) el.value = value;
}

function bindSlider(id: string, labelId: string, fmt: (v: string) => string, onChange: (v: string) => void): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const label = document.getElementById(labelId);
  el?.addEventListener('input', () => {
    if (label) label.textContent = fmt(el.value);
    onChange(el.value);
  });
}

function bindCheckbox(id: string, onChange: (v: boolean) => void): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  el?.addEventListener('change', () => onChange(el.checked));
}
