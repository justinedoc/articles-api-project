# Article API

Backend API for a multi-user publishing platform. It provides authentication, author profiles, account management, article publishing workflows, threaded discussions, tagging, health checks, rate limiting, and HTTP caching.

Built with [Hono](https://hono.dev/), [Better Auth](https://www.better-auth.com/), [Drizzle ORM](https://orm.drizzle.team/), PostgreSQL, and Redis.

## Features

- Email/password authentication via Better Auth (Bearer token and session cookie)
- Public author profiles and authenticated profile management
- Account lookup and permanent account deletion with cascading cleanups
- Article lifecycle: drafts, publishing, archiving, and permanent deletion
- Tag normalization, full-text search, and trending article rankings
- Paginated article feeds returning `{ articles: [...], nextCursor }`
- Threaded article comments with nested replies and soft deletion
- PostgreSQL persistence with Drizzle schema and migrations
- Redis-backed rate limiting and health monitoring
- OpenAPI 3.2.1 specification and interactive Scalar documentation
- Cache headers (`Cache-Control`, `ETag`, conditional `304 Not Modified`)
- Unit, service, route integration, and end-to-end test suites

## Requirements

- Node.js 20+
- pnpm
- Docker and Docker Compose (recommended for local PostgreSQL and Redis)

## Getting Started

```bash
git clone https://github.com/justinedoc/articles-api-project.git
cd article-api
pnpm install
cp .env.example .env
```

Start local dependencies:

```bash
pnpm services:up
```

For the default Docker Compose configuration in `docker-compose.dev.yml`, set the following in `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/article-api
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=replace-this-with-a-long-random-secret
```

Apply database migrations and start the server:

```bash
pnpm db:migrate
pnpm dev
```

The server listens on `http://localhost:3000` by default.

## Configuration

Environment variables are validated on startup via Zod.

| Variable             | Required | Description                                                                                        |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `PORT`               | No       | HTTP port. Defaults to `3000`.                                                                     |
| `HOST`               | No       | Bind address. Defaults to `0.0.0.0`.                                                               |
| `NODE_ENV`           | No       | `development`, `test`, or `production`. Defaults to `development`.                                 |
| `LOG_LEVEL`          | No       | Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`). Defaults to `info`. |
| `SERVER_URL`         | No       | Public API origin. Defaults to `http://localhost:3000`.                                            |
| `APP_URL`            | No       | Frontend origin allowed by CORS and Better Auth. Defaults to `http://localhost:4321`.              |
| `TRUST_PROXY`        | No       | Set to `true` when behind a reverse proxy. Defaults to `false`.                                    |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string.                                                                      |
| `REDIS_URL`          | No       | Redis connection string. Defaults to `redis://localhost:6379`.                                     |
| `BETTER_AUTH_URL`    | Yes      | Better Auth base URL (usually same as `SERVER_URL`).                                               |
| `BETTER_AUTH_SECRET` | Yes      | Secret key used to sign session cookies and tokens.                                                |

## API Documentation

When the server is running, interactive and machine-readable documentation is available at:

- Scalar API Reference: `http://localhost:3000/api/v1/reference`
- OpenAPI JSON Spec: `http://localhost:3000/api/v1/doc`
- Better Auth OpenAPI Schema: `http://localhost:3000/api/v1/auth/open-api/generate-schema`

All application endpoints are prefixed with `/api/v1`.

## Endpoints

### System

| Method | Path                    | Auth | Description                                         |
| ------ | ----------------------- | ---- | --------------------------------------------------- |
| `GET`  | `/api/v1/system/health` | No   | Health check returning PostgreSQL and Redis status. |

### Authentication

| Method        | Path             | Auth   | Description                                                   |
| ------------- | ---------------- | ------ | ------------------------------------------------------------- |
| `GET`, `POST` | `/api/v1/auth/*` | Varies | Handled by Better Auth (sign-up, sign-in, session, sign-out). |

### Account

| Method   | Path                 | Auth | Description                                                         |
| -------- | -------------------- | ---- | ------------------------------------------------------------------- |
| `GET`    | `/api/v1/account/me` | Yes  | Get current user's account details.                                 |
| `DELETE` | `/api/v1/account/me` | Yes  | Permanently delete account, profile, sessions, articles, and likes. |

### Profiles

| Method  | Path                         | Auth | Description                                                                          |
| ------- | ---------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `GET`   | `/api/v1/profiles/me`        | Yes  | Get authenticated user's profile.                                                    |
| `PATCH` | `/api/v1/profiles/me`        | Yes  | Update profile (`displayName`, `username`, `bio`, `avatarUrl`, `socialLinks`, etc.). |
| `GET`   | `/api/v1/profiles/:username` | No   | Get public author profile by handle.                                                 |

### Articles

Paginated article endpoints return data inside `{ success: true, message: string, data: { articles: [...], nextCursor: string | null } }`.

| Method   | Path                           | Auth     | Description                                                             |
| -------- | ------------------------------ | -------- | ----------------------------------------------------------------------- |
| `GET`    | `/api/v1/articles`             | Optional | List published articles (`cursor`, `limit`, `tag`, `search`, `author`). |
| `GET`    | `/api/v1/articles/trending`    | Optional | List trending articles ranked by engagement score (`limit`).            |
| `GET`    | `/api/v1/articles/mine`        | Yes      | List owned articles (`cursor`, `limit`, `status`, `tag`, `search`).     |
| `GET`    | `/api/v1/articles/:id`         | Optional | Get published article by ID.                                            |
| `GET`    | `/api/v1/articles/:id/mine`    | Yes      | Get owned article by ID (includes drafts and archived).                 |
| `POST`   | `/api/v1/articles`             | Yes      | Create draft article with optional tags.                                |
| `PATCH`  | `/api/v1/articles/:id`         | Yes      | Update owned article details and tags.                                  |
| `POST`   | `/api/v1/articles/:id/publish` | Yes      | Publish a draft or unarchive an article.                                |
| `POST`   | `/api/v1/articles/:id/archive` | Yes      | Archive a published article.                                            |
| `DELETE` | `/api/v1/articles/:id`         | Yes      | Delete an owned article and its associations.                           |
| `POST`   | `/api/v1/articles/:id/like`    | Yes      | Idempotently like a published article.                                  |
| `DELETE` | `/api/v1/articles/:id/like`    | Yes      | Idempotently remove a like from an article.                             |

### Comments

Paginated comment endpoints return data inside `{ success: true, message: string, data: { data: [...], nextCursor: string | null } }`.

| Method   | Path                                   | Auth | Description                                                                     |
| -------- | -------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/articles/:articleId/comments` | No   | List top-level root comments for a published article (`cursor`, `limit`).       |
| `POST`   | `/api/v1/articles/:articleId/comments` | Yes  | Create a comment or reply (optional `parentId`).                                |
| `GET`    | `/api/v1/comments/:commentId/replies`  | No   | List replies for a comment (`cursor`, `limit`, or `tree=true` for nested tree). |
| `PATCH`  | `/api/v1/comments/:commentId`          | Yes  | Update body of an owned comment.                                                |
| `DELETE` | `/api/v1/comments/:commentId`          | Yes  | Soft-delete an owned comment (preserves reply tree).                            |

### Tags

| Method | Path                   | Auth | Description                                       |
| ------ | ---------------------- | ---- | ------------------------------------------------- |
| `GET`  | `/api/v1/tags`         | No   | List all tags with usage counts.                  |
| `GET`  | `/api/v1/tags/popular` | No   | List top tags ordered by article count (`limit`). |

## Project Structure

```text
src/
├── core/                 # Shared infrastructure
│   ├── auth/             # Better Auth configuration and middleware
│   ├── cache/            # In-memory and Redis cache adapters
│   ├── db/               # Drizzle client, schemas, relations, migrations
│   ├── errors/           # Centralized AppError and exception handlers
│   ├── openapi/          # OpenAPI configuration and schema helpers
│   ├── pagination/       # Cursor pagination utilities
│   ├── redis/            # Redis client connection management
│   └── server/           # Hono instance, middlewares, rate limiting
├── modules/              # Domain feature modules
│   ├── account/          # Account management and deletion cascades
│   ├── articles/         # Articles, likes, search, and trending algorithms
│   ├── auth/             # Better Auth route adapter
│   ├── comments/         # Root comments and threaded replies
│   ├── health/           # System health checks
│   ├── profiles/         # Author profile management
│   └── tags/             # Tag definitions and popularity queries
├── versions/             # API versioning (v1 route registry)
├── env.ts                # Environment variable schema validation
└── index.ts              # HTTP server entrypoint
```

## Development Commands

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `pnpm dev`           | Start development server with file watch mode.          |
| `pnpm build`         | Compile TypeScript and resolve path aliases to `dist/`. |
| `pnpm start`         | Run compiled production build from `dist/index.js`.     |
| `pnpm check`         | Run Biome lint and format checks.                       |
| `pnpm lint`          | Run Biome lint with auto-fix.                           |
| `pnpm format`        | Run Biome formatter with write.                         |
| `pnpm test`          | Run all test suites with Vitest.                        |
| `pnpm test:watch`    | Run Vitest in watch mode.                               |
| `pnpm test:core`     | Run core module tests.                                  |
| `pnpm test:service`  | Run service layer integration tests.                    |
| `pnpm test:routes`   | Run route integration tests.                            |
| `pnpm test:e2e`      | Run end-to-end integration tests.                       |
| `pnpm test:coverage` | Run test suite with code coverage.                      |
| `pnpm db:generate`   | Generate Drizzle migration files from schema changes.   |
| `pnpm db:migrate`    | Apply pending migrations to PostgreSQL database.        |
| `pnpm db:studio`     | Launch Drizzle Studio web interface.                    |
| `pnpm db:push:test`  | Sync test database schema directly.                     |
| `pnpm services:up`   | Start PostgreSQL and Redis Docker containers.           |
| `pnpm services:down` | Stop PostgreSQL and Redis Docker containers.            |

## Database Workflow

1. Update the schema files in `src/core/db/schema/`.
2. Generate migration SQL:

   ```bash
   pnpm db:generate
   ```
3. Inspect the generated migration in `src/core/db/migrations/`.
4. Run migrations locally:

   ```bash
   pnpm db:migrate
   ```

## Production Notes

- Set `NODE_ENV=production` and use a strong, cryptographically secure `BETTER_AUTH_SECRET`.
- Point `DATABASE_URL` and `REDIS_URL` to managed instances.
- Configure `SERVER_URL` and `APP_URL` to matching production origins.
- Set `TRUST_PROXY=true` only when the app runs behind an ingress reverse proxy (e.g. Nginx, Cloudflare, AWS ALB).
- Build the app with `pnpm build` and start it with `pnpm start`.
