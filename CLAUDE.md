# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CLUTCHZONE's frontend and backend live in **separate repositories**. This repo (`Cluchzone`) is the frontend only, with two distinct code areas that must not be confused:

- **Root (`*.html`, `*.css`, `*.js`)** — legacy static frontend, served by the plain Node `server.js` (no framework, no bundler). Publishable as-is to GitHub Pages.
- **`clutchzone-app/`** — a newer Vite + TypeScript evolution of the frontend. Not yet the canonical runtime target; see the routing rules below.

The backend (Express 5 + TypeScript, PostgreSQL via Prisma) lives in the sibling repository `clutchzone-backend` (expected at `../clutchzone-backend` locally). It is the **only** place identity, auth, roles, and sensitive mutations may live — this repo contains no backend code and should never grow any. The frontend talks to it exclusively over HTTP, cross-origin, using cookie-based sessions (`credentials: 'include'`) and a CORS allowlist configured on the backend side.

## Critical security rules (non-negotiable)

These come from `AGENTS.md` and `SECURITY.md` and apply to every change in this repo:

- Authentication, Steam API access, session handling, roles, and status belong **exclusively** to `clutchzone-backend`. Never re-implement any of this here.
- Never add simulated/mock login, a Steam password field, identity stored in `localStorage`, or any fallback that trusts a header/nickname from the client.
- Never trust an ID passed from the browser (e.g. `teamId`, sender, SteamID) as authorization — that validation happens server-side, in the other repo.
- The browser must never receive the Steam API key, process the OpenID return directly, or persist auth in `localStorage`. Sessions are `HttpOnly` cookies owned by the backend.
- Don't run destructive Git resets — preserve user data and changes.

## Commands

### Root (legacy static frontend)
```bash
npm run dev              # node server.js — serves the static frontend on :3000
```

### `clutchzone-app/` (Vite frontend)
```bash
npm run dev          # vite dev server (proxies /api, /auth, /health to http://localhost:3001)
npm run build         # tsc && vite build
npm run type-check     # tsc --noEmit
npm run lint            # eslint src --ext .ts --report-unused-disable-directives --max-warnings 0
```
After any Vite change, run `npm run type-check` and `npm run build`.

Node.js >= 20.19 is required everywhere (`engines` field).

## Local development

The backend is a separate checkout. In one terminal:
```bash
cd ../clutchzone-backend
cp .env.example .env    # fill in all required values; startup fails if any are missing/invalid
npm install
npm run dev              # starts Postgres/RabbitMQ, applies migrations, starts the API on :3001
```

In a second terminal, from this repo's root: `npm run dev` (serves the static frontend on `:3000`).

`http://localhost:3000` is the **only** canonical frontend origin in development. `server.js` actively redirects `127.0.0.1`/`[::1]` requests and duplicate `/clutchzone-app/` paths back to `localhost:3000` to avoid `SameSite` cookie loss and version drift — do not "fix" these redirects without understanding this constraint. Steam login begins at `http://localhost:3001/auth/steam`, callback is `http://localhost:3001/auth/steam/callback`.

The backend base URL is resolved client-side: `config.js` sets `window.CLUCHZONE_BACKEND_URL` (empty on localhost, so `api.js`/`auth.js`/`inventory.js` fall back to `http://localhost:3001`; hardcoded to the production Render URL otherwise). The Vite app uses `VITE_BACKEND_URL` (see `clutchzone-app/.env.example`), with the same `localhost:3001` fallback in dev.

## Deploy

- The static frontend is published to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`. It copies the root `*.html`/`*.css`/`*.js` files and cache-busts them with the commit SHA.
- Before publishing, make sure `config.js` points at the correct deployed backend URL (production Render URL is hardcoded there today).
- The backend deploys entirely from its own repo (`clutchzone-backend`'s `render.yaml`) — this repo has no backend deploy config and should not reintroduce any.
- Cross-domain deploys (GitHub Pages frontend + separate backend domain) rely on `SameSite=None; Secure` cookies set by the backend — some browsers block third-party cookies regardless, so same-registrable-domain subdomains are preferred when possible.

## Known scope limitations

Teams, private team chat, and marketplace already use transactional models with resource-level authorization on the backend. Legacy tournament flows, old invites, general chat, and payments are not yet implemented on secure per-resource authorization (some still use the aggregated `/api/store/*` compatibility route) — see `SECURITY.md`'s "Escopo ainda não endurecido" section before extending those areas or before any financial/competitive production use.
