# aie (`v1`)

**Desktop Vocal Booth & Turnkey OpenUtau / vLabeler Voicebank Builder** for macOS (Apple Silicon), Windows, and Linux.

- **Product Vision & Anti-Drift Charter**: [`docs/VISION.md`](./docs/VISION.md)
- **Architecture & User Journey Blueprint**: [`docs/BLUEPRINT.md`](./docs/BLUEPRINT.md)
- **Parallel Swarm Execution Plan**: [`docs/SWARM_PLAN.md`](./docs/SWARM_PLAN.md)
- **Agent Engineering Rules**: [`AGENTS.md`](./AGENTS.md)

## Quick Start

```sh
npm install
npm run dev        # Start Electron + React HMR studio
npm run typecheck  # Strict TypeScript check (Main + Preload + Renderer)
npm test           # Run Vitest unit & component suite
npm run build      # Production bundle + OSS license generation
npm run test:e2e   # Run Playwright Electron fake-mic E2E suite
```

## License

MIT © `team-aie`. Built-in voicebank recording lists under `resources/reclists/` remain under the terms arranged with their respective creators (see each reclist's `manifest.json`).
