# Rill

Grounded execution layer for Sui — agents transact without hallucinating on-chain calls.

## Packages

| Path | Description |
|---|---|
| `rill-backend/` | Keyless Hono API — compile, simulate, MCP skills |
| `rill-frontend/` | Rill Studio — node-flow builder (TanStack Start) |
| `packages/rill-sdk/` | Typed HTTP client for the backend |

## Quick start

```bash
# Backend (port 3002)
cd rill-backend && cp .env.example .env && bun install && bun run dev

# Frontend (separate terminal)
cd rill-frontend && cp .env.example .env && bun install && bun run dev
```

Live API: https://api.rill.rifuki.dev
