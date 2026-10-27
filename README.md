# Article API

Backend API for a multi-user publishing platform. It provides authentication, author profiles, account management, health checks, request validation, rate limiting, and the foundations for publishing workflows.

The API is built with [Hono](https://hono.dev/), [Better Auth](https://www.better-auth.com/), [Drizzle ORM](https://orm.drizzle.team/), PostgreSQL, and Redis.

## Features

- Email/password authentication with Better Auth
- Bearer-token and session-cookie authentication
- Public author profiles and authenticated profile management
- Account lookup and permanent account deletion
- PostgreSQL persistence with Drizzle migrations
- Redis-backed services and health monitoring
- OpenAPI 3.2.1 specification and interactive Scalar reference
- Article drafts, publishing, archiving, threaded comments, tags, search, and likes
- Request validation, secure headers, CORS, payload limits, structured logging, and rate limiting
- Unit, integration, and end-to-end test scripts

## Requirements

- Node.js 20+
- pnpm
- Docker and Docker Compose (recommended for local PostgreSQL and Redis)

## Getting started

```bash
git clone https://github.com/justinedoc/articles-api-project.git
cd article-api
pnpm install
cp .env.example .env
```

Start the local dependencies:

```bash
pnpm services:up
```

For the Docker Compose services in `docker-compose.dev.yml`, use this database URL in `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/article-api
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=replace-this-with-a-long-random-secret
```

Apply the database migrations and start the API:

```bash
pnpm db:migrate
pnpm dev
```

The server listens on `http://localhost:3000` by default.

## Configuration

Environment variables are validated when the application starts.

| Variable             | Required | Description                                                                           |
| -------------------- | -------- | ------------------------------------------------------------------------------------- |
| `PORT`               | No       | HTTP port. Defaults to `3000`.                                                        |
| `HOST`               | No       | Bind address. Defaults to `0.0.0.0`.                                                  |
| `NODE_ENV`           | No       | `development`, `test`, or `production`.                                               |
| `LOG_LEVEL`          | No       | Pino log level. Defaults to `info`.                                                   |
| `SERVER_URL`         | No       | Public API origin. Defaults to `http://localhost:3000`.                               |
| `APP_URL`            | No       | Frontend origin trusted by CORS and Better Auth. Defaults to `http://localhost:4321`. |
| `TRUST_PROXY`        | No       | Set to `true` when running behind a trusted reverse proxy.                            |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string.                                                         |
| `REDIS_URL`          | No       | Redis connection string. Defaults to `redis://localhost:6379`.                        |
| `BETTER_AUTH_URL`    | Yes      | Better Auth URL, normally the API origin.                                             |
| `BETTER_AUTH_SECRET` | Yes      | Long, private secret used to sign authentication data.                                |

Never commit `.env` or production secrets. Use a different database and secret for tests and production.

## API documentation

With the server running, open:

- Scalar API reference: [`http://localhost:3000/api/v1/reference`](http://localhost:3000/api/v1/reference)
- OpenAPI document: [`http://localhost:3000/api/v1/doc`](http://localhost:3000/api/v1/doc)
- Better Auth OpenAPI schema: [`http://localhost:3000/api/v1/auth/open-api/generate-schema`](http://localhost:3000/api/v1/auth/open-api/generate-schema)

All application routes are prefixed with `/api/v1`.

## Current endpoints

### System

| Method | Path                    | Auth | Purpose                                    |
| ------ | ----------------------- | ---- | ------------------------------------------ |
| `GET`  | `/api/v1/system/health` | No   | Reports PostgreSQL and Redis availability. |

### Authentication

| Method        | Path             | Auth                 | Purpose                                                                                           |
| ------------- | ---------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `GET`, `POST` | `/api/v1/auth/*` | Depends on operation | Better Auth endpoints for registration, sign-in, sessions, sign-out, and authentication metadata. |

Use the generated authentication schema or Scalar reference for the exact Better Auth operation paths and request bodies.

### Accounts

| Method   | Path                 | Auth | Purpose                                                                     |
| -------- | -------------------- | ---- | --------------------------------------------------------------------------- |
| `GET`    | `/api/v1/account/me` | Yes  | Read the authenticated account.                                             |
| `DELETE` | `/api/v1/account/me` | Yes  | Permanently delete the account, profile, sessions, and associated articles. |

### Profiles

| Method  | Path                         | Auth | Purpose                                                                                            |
| ------- | ---------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/profiles/me`        | Yes  | Read the current author's profile.                                                                 |
| `PATCH` | `/api/v1/profiles/me`        | Yes  | Update `displayName`, `username`, `bio`, `avatarUrl`, `bannerUrl`, `websiteUrl`, or `socialLinks`. |
| `GET`   | `/api/v1/profiles/:username` | No   | Read a public author profile.                                                                      |

Authenticated requests may use the `Authorization: Bearer <token>` header or the Better Auth session cookie. Browser clients should send credentials when using cookies:

```js
fetch("http://localhost:3000/api/v1/profiles/me", {
	credentials: "include",
	headers: { Accept: "application/json" },
});
```

### Articles and comments

Articles support drafts, publishing, archiving, ownership checks, normalized tags, full-text search, cursor pagination, and idempotent likes. Public discovery is available at `GET /api/v1/articles` with optional `cursor`, `limit`, `tag`, and `search` query parameters. Article ordering is `publishedAt DESC, id DESC`.

Comments are available under `/api/v1/articles/:articleId/comments` and support arbitrary nested replies, cursor pagination, ownership checks, and soft deletion so replies remain intact.

| Method             | Path                                   | Auth     | Purpose                                                   |
| ------------------ | -------------------------------------- | -------- | --------------------------------------------------------- |
| `GET`              | `/api/v1/articles`                     | No       | List published articles with optional tag/search filters. |
| `GET`              | `/api/v1/articles/:id`                 | No       | Read a published article.                                 |
| `POST`             | `/api/v1/articles`                     | Yes      | Create a draft.                                           |
| `PATCH`            | `/api/v1/articles/:id`                 | Yes      | Update an owned article and its tags.                     |
| `POST`             | `/api/v1/articles/:id/publish`         | Yes      | Publish or restore an article.                            |
| `POST`             | `/api/v1/articles/:id/archive`         | Yes      | Archive an article.                                       |
| `DELETE`           | `/api/v1/articles/:id`                 | Yes      | Delete an article and dependent records.                  |
| `POST` / `DELETE`  | `/api/v1/articles/:id/like`            | Yes      | Like or unlike a published article.                       |
| `GET` / `POST`     | `/api/v1/articles/:articleId/comments` | No / Yes | List or create comments and replies.                      |
| `PATCH` / `DELETE` | `/api/v1/comments/:commentId`          | Yes      | Edit or soft-delete an owned comment.                     |

## Development commands

| Command              | Description                               |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | Start the API with watch mode.            |
| `pnpm build`         | Type-check and build to `dist/`.          |
| `pnpm start`         | Run the compiled API.                     |
| `pnpm check`         | Run Biome checks.                         |
| `pnpm lint`          | Apply Biome lint fixes.                   |
| `pnpm format`        | Apply Biome formatting.                   |
| `pnpm test`          | Run the complete test suite.              |
| `pnpm test:core`     | Run core unit and infrastructure tests.   |
| `pnpm test:service`  | Run module service layer tests.           |
| `pnpm test:routes`   | Run route integration tests.              |
| `pnpm test:e2e`      | Run end-to-end tests.                     |
| `pnpm test:coverage` | Run tests with coverage.                  |
| `pnpm db:generate`   | Generate a migration from schema changes. |
| `pnpm db:migrate`    | Apply committed migrations.               |
| `pnpm db:studio`     | Open Drizzle Studio.                      |
| `pnpm services:down` | Stop local PostgreSQL and Redis.          |

Before opening a pull request, run:

```bash
pnpm check
pnpm build
pnpm test
```

## Project structure

```text
src/
├── core/                 # Shared infrastructure and cross-cutting concerns
│   ├── auth/             # Better Auth configuration and middleware
│   ├── db/               # Drizzle client, schema, relations, migrations
│   ├── cache/            # Cache helpers
│   ├── redis/            # Redis client
│   ├── openapi/          # OpenAPI and Scalar configuration
│   └── server/           # Hono app, middleware, rate limiting, shutdown
├── modules/
│   ├── account/          # Account endpoints and services
│   ├── auth/             # Better Auth route adapter
│   ├── health/           # Dependency health check
│   └── profiles/         # Author profile endpoints and services
├── versions/             # Versioned route compositions (v1, ...)
├── env.ts                # Environment schema and validation
└── index.ts              # Application entry point
```

## Database workflow

1. Update the relevant schema in `src/core/db/schema`.
2. Generate a migration:

   ```bash
   pnpm db:generate
   ```

3. Review the generated SQL.
4. Apply it locally:

   ```bash
   pnpm db:migrate
   ```

Do not edit an already-applied migration. Create a new migration for subsequent changes.

## Production notes

- Set `NODE_ENV=production` and provide a strong, unique `BETTER_AUTH_SECRET`.
- Use managed PostgreSQL and Redis or production-grade equivalents.
- Set `SERVER_URL` and `APP_URL` to the deployed origins.
- Set `TRUST_PROXY=true` only when requests arrive through a proxy you control.
- Run `pnpm build` during deployment, then start with `pnpm start`.
- Terminate TLS at the application gateway or reverse proxy and keep credentials enabled only for trusted frontend origins.

## License

No license has been declared yet.
