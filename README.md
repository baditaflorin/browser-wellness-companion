# 💓 Browser Wellness Companion

[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-blue?style=for-the-badge)](https://baditaflorin.github.io/browser-wellness-companion/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Browser-based ambient wellness monitor — webcam rPPG pulse, posture, blink-rate tracking, and screen-time nudges, fully client-side via WASM.**

🔗 **Live site:** https://baditaflorin.github.io/browser-wellness-companion/

## What It Does

Open a tab, grant camera access, and the app reads your:

- **❤️ Heart Rate** — Remote photoplethysmography (rPPG) detects your pulse from subtle facial color changes
- **🧘 Posture** — Tracks head position and forward lean via facial landmarks
- **👁️ Blink Rate** — Monitors eye aspect ratio to detect blinks and warn about eye strain
- **⏱️ Screen Time** — Tracks session duration and nudges you after 90 minutes

When stress markers spike and you've been still too long, it nudges you to take a break.

## Privacy First

- **100% client-side** — all processing happens in your browser
- **Zero data transmission** — nothing leaves your device, ever
- **No accounts** — no sign-up, no subscription, no tracking
- **Verifiable** — check the Network tab yourself

## Tech Stack

- **MediaPipe Face Landmarker** (WASM) — 468 facial landmarks at GPU speed
- **rPPG CHROM method** — peer-reviewed remote pulse extraction algorithm
- **Vite + TypeScript** — fast builds, type safety
- **Vanilla CSS** — custom glassmorphism dark theme

## Quickstart

```bash
git clone https://github.com/baditaflorin/browser-wellness-companion.git
cd browser-wellness-companion
npm install
npm run dev
```

Open http://localhost:5173/browser-wellness-companion/ and grant camera access.

## Build for GitHub Pages

```bash
npm run build
# Output goes to docs/ — push to main and enable Pages from docs/
```

## Architecture

```
Mode A: Pure GitHub Pages — fully client-side, no backend
┌──────────────────────────────────────────────┐
│              Browser (Client)                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ MediaPipe│  │  rPPG    │  │ Screen Time│ │
│  │ WASM     │──│ Engine   │  │ Tracker    │ │
│  │ Face Mesh│  │ (CHROM)  │  │            │ │
│  └──────────┘  └──────────┘  └────────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Posture  │  │ Blink    │  │ Nudge      │ │
│  │ Engine   │  │ Engine   │  │ System     │ │
│  └──────────┘  └──────────┘  └────────────┘ │
│  ┌──────────────────────────────────────────┐│
│  │        IndexedDB / localStorage          ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
         │ Static assets only
    ┌────┴────┐
    │ GitHub  │
    │ Pages   │
    └─────────┘
```

## License

MIT — see [LICENSE](LICENSE).
