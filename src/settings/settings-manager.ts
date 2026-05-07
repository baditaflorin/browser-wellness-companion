/**
 * Settings Manager — persists user-tweakable parameters to localStorage.
 * All engines read from this; UI settings panel writes to it.
 */

export interface RPPGSettings {
  bufferSizeSec: number;     // signal buffer duration in seconds (default 8)
  bandpassLow: number;       // Hz, lower bound (default 0.7 = 42 BPM)
  bandpassHigh: number;      // Hz, upper bound (default 3.0 = 180 BPM)
  smoothingFactor: number;   // BPM EMA smoothing 0-1 (default 0.6, lower = more reactive)
  minConfidence: number;     // min confidence to accept a reading (default 0.2)
  useDetrending: boolean;    // remove slow drift from signal (default true)
  roiForehead: boolean;      // true = forehead ROI, false = full cheek ROI
}

export interface BlinkSettings {
  method: 'ear' | 'blendshapes'; // detection method
  earThreshold: number;          // EAR threshold (default 0.17)
  consecFrames: number;          // consecutive frames below threshold (default 3)
  debounceMs: number;            // minimum ms between blinks (default 200)
  earSmoothing: number;          // EAR smoothing factor (default 0.6)
  blendshapeThreshold: number;   // blendshape score to count as blink (default 0.5)
}

export interface PostureSettings {
  sensitivity: number;      // 1-10, higher = more sensitive (default 5)
  calibrationSeconds: number; // seconds to calibrate (default 2)
}

export interface GeneralSettings {
  processingFps: number;     // target FPS for processing (default 30)
  showDebugOverlay: boolean; // show ROI boxes, landmarks, EAR values
  showSignalValues: boolean; // show raw values on dashboard
}

export interface AllSettings {
  rppg: RPPGSettings;
  blink: BlinkSettings;
  posture: PostureSettings;
  general: GeneralSettings;
}

const STORAGE_KEY = 'wellness-companion-settings';

export const DEFAULT_SETTINGS: AllSettings = {
  rppg: {
    bufferSizeSec: 8,
    bandpassLow: 0.75,
    bandpassHigh: 3.0,
    smoothingFactor: 0.6,
    minConfidence: 0.2,
    useDetrending: true,
    roiForehead: true,
  },
  blink: {
    method: 'blendshapes',
    earThreshold: 0.17,
    consecFrames: 3,
    debounceMs: 200,
    earSmoothing: 0.6,
    blendshapeThreshold: 0.5,
  },
  posture: {
    sensitivity: 5,
    calibrationSeconds: 2,
  },
  general: {
    processingFps: 30,
    showDebugOverlay: false,
    showSignalValues: false,
  },
};

export class SettingsManager {
  private settings: AllSettings;
  private listeners: Array<(s: AllSettings) => void> = [];

  constructor() {
    this.settings = this.load();
  }

  private load(): AllSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Deep merge with defaults to handle new fields added in updates
        return this.deepMerge(DEFAULT_SETTINGS, parsed);
      }
    } catch {
      // ignore corrupt storage
    }
    return structuredClone(DEFAULT_SETTINGS);
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // localStorage might be full or disabled
    }
  }

  private deepMerge(defaults: any, overrides: any): any {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (key in overrides) {
        if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
          result[key] = this.deepMerge(defaults[key], overrides[key]);
        } else {
          result[key] = overrides[key];
        }
      }
    }
    return result;
  }

  get(): AllSettings {
    return this.settings;
  }

  getRPPG(): RPPGSettings {
    return this.settings.rppg;
  }

  getBlink(): BlinkSettings {
    return this.settings.blink;
  }

  getPosture(): PostureSettings {
    return this.settings.posture;
  }

  getGeneral(): GeneralSettings {
    return this.settings.general;
  }

  /** Update a section and notify listeners. Changes take effect immediately (hot-swap). */
  update(section: keyof AllSettings, values: Partial<AllSettings[keyof AllSettings]>): void {
    (this.settings as any)[section] = { ...(this.settings as any)[section], ...values };
    this.save();
    this.listeners.forEach(fn => fn(this.settings));
  }

  /** Reset all settings to defaults */
  resetAll(): void {
    this.settings = structuredClone(DEFAULT_SETTINGS);
    this.save();
    this.listeners.forEach(fn => fn(this.settings));
  }

  /** Subscribe to setting changes */
  onChange(fn: (s: AllSettings) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
}
