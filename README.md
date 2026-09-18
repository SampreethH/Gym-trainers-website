# Elevate OS

Luxury multi-tenant fitness operating system: 3D landing, four role-based workspaces, mandatory Complete Set logging, trainer subscription gating, and persisted workout data.

## Run

Requires Node 20+. If `node` is not on your PATH, this project can use a local install at `~/.local/node`.

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo accounts

Password for all: `elevate-demo`

| Role | Email | Lands on |
|---|---|---|
| Group training client | `gt@elevate.demo` | `/gt` |
| Personal training client | `pt@elevate.demo` | `/pt` |
| Trainer (active subscription) | `trainer@elevate.demo` | `/trainer` |
| Trainer (lapsed) | `lapsed@elevate.demo` | `/billing/blocked` |
| Platform admin | `admin@elevate.demo` | `/admin` |

## What is enforced

- Each GT muscle group publishes **exactly 5** exercise variations.
- A set is counted only after **Complete Set** (`completedAt` required).
- Trainer APIs return **402** when the tenant subscription is not `active` or `trialing`.
- PT no-shows (start + 15 minutes, no check-in) auto-reschedule to the next day and notify both parties.
- Role layouts authorize on the server. The 3D scene is code-split and never loaded in dashboards.

## Layout

- `web/` — Next.js App Router application (UI + API)
- `docs/elevate-os-production-specification.md` — architecture source of truth
- `backend/` — reserved for a later extracted NestJS service; v1 lives in `web/app/api`

The previous static HTML prototype has been retired.
