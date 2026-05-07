# ADR 0001 — Deployment Mode: Pure GitHub Pages (Mode A)

## Status
**Accepted**

## Context
The browser wellness companion needs to access the user's webcam, run MediaPipe Face Landmarker (WASM), process rPPG signals in JS, track screen time, and store preferences locally. None of these require a server.

## Decision
**Mode A: Pure GitHub Pages** — fully client-side, no backend at runtime.

## Consequences
- No backend, Docker, compose, or nginx needed
- The only build artifact is the Vite output in `docs/`
- GitHub Pages serves static files
- MediaPipe WASM files loaded from CDN
