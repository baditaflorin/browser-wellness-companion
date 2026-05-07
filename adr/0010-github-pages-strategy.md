# ADR 0010 — GitHub Pages Publishing

## Status
**Accepted**

## Decision
- Branch: `main`, Path: `/docs`
- Base path: `/browser-wellness-companion/`
- Vite builds into `docs/` with hashed filenames
- `docs/` is committed to git (not gitignored)
- `public/404.html` provides SPA fallback
- ADR docs stored at repo root in `adr/` to avoid Vite's `emptyOutDir` clearing them
