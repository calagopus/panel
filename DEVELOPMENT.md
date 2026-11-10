# Developing for Calagopus

Calagopus is a game server management panel rebuilt from the ground up in Rust, compatible with Pterodactyl/Pelican eggs and migration paths.

## Tech Stack

| Layer              | Technology                                   |
|--------------------|----------------------------------------------|
| Backend            | Rust, Axum, Tokio, SQLx                      |
| Frontend           | React 19, Mantine 9, Tailwind 4, Vite 8      |
| Database           | PostgreSQL (migrations via Drizzle)          |

## Prerequisites

- Rust (stable, ≥ 1.95.0)
- Node.js ≥ 24 and pnpm ≥ 11
- PostgreSQL
- Valkey or Redis

## Environment

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/panel
REDIS_URL=redis://localhost
APP_ENCRYPTION_KEY=<random secret>
DATABASE_MIGRATE=true
PORT=8000
```

## Important Commands

### Backend

> [!NOTE]
> The frontend should be built at least once before compiling the backend. See [frontend](#frontend) for more info.

```bash
# Run the backend
cargo run

# When running the backend for the first time prepend SQLX_OFFLINE
# This will migrate the database, and bypass any schema checks during the build process
SQLX_OFFLINE=true cargo run

# Run the all-in-one binary
OCI_CONTAINER=official-aio cargo run -p panel-rs-aio

# Database migrator
cargo run -p database-migrator -- migrate
```

### Frontend

```bash
cd frontend

# Start dev server
pnpm dev

# Production build
pnpm build

# Lint & format check
pnpm lint
pnpm fmt:check

# Lint & format fix
pnpm lint:fix
pnpm fmt
```
