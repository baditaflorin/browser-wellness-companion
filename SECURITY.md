# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | ✅ Yes             |

## Architecture Security

This application runs **entirely in the browser**. No data is transmitted to any server. All webcam processing happens locally via WASM and JavaScript.

- **No backend** — there is no server to attack
- **No data collection** — no analytics, no telemetry, no cookies
- **No authentication** — no credentials to steal
- **No external API calls** — the only network requests are for static assets and the MediaPipe WASM model (from Google's CDN)

## Reporting a Vulnerability

If you discover a security vulnerability (e.g., in the client-side code, dependency chain, or build pipeline), please report it responsibly:

**Email:** baditaflorin@gmail.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 48 hours.
