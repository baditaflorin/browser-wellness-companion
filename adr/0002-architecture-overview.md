# ADR 0002 — Architecture Overview

## Status
**Accepted**

## Decision
Five feature modules (rppg, posture, blink, screentime, nudge), one vision module (MediaPipe wrapper), two UI modules (renderer, signal-chart), orchestrated by main.ts.

## Data Flow
Webcam → MediaPipe Face Mesh → landmarks → rPPG + Posture + Blink engines → Nudge System → UI
