# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.23.4-alpine
FROM node:${NODE_VERSION} AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Stage 1: Install production dependencies only (isolated for runtime)
FROM base AS prod-deps
COPY pnpm-lock.yaml package.json .npmrc* ./
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

# Stage 2: Install full dependencies and build
FROM base AS builder
COPY pnpm-lock.yaml package.json .npmrc* ./
ENV PNPM_CONFIG_STRICT_DEP_BUILDS=false
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm build && \
    find .output -name "*.map" -type f -delete

# Stage 3: Minimal runner image
FROM node:${NODE_VERSION} AS runner

# Patch OS level vulnerabilities on container creation & install dumb-init
RUN apk update && apk upgrade --no-cache && apk add --no-cache dumb-init

WORKDIR /app
# Ensure the application directory belongs explicitly to the unprivileged user
RUN chown node:node /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy runtime node_modules and compiled output with correct group permissions
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.output ./.output
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

# Wrap execution with dumb-init to intercept signals and prevent container hanging
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
