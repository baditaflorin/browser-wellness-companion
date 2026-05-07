# Contributing

Thank you for your interest in contributing to Browser Wellness Companion!

## Getting Started

```bash
git clone https://github.com/baditaflorin/browser-wellness-companion.git
cd browser-wellness-companion
npm install
npm run dev
```

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Build and verify: `npm run build`
5. Commit with Conventional Commits: `git commit -m "feat: add my feature"`
6. Push and open a Pull Request

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance

## Code Style

- TypeScript strict mode
- Vanilla CSS (no frameworks)
- Small files, single responsibility
- No console errors in production build
