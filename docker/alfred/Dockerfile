# syntax=docker/dockerfile:1

FROM oven/bun:1.3.5-slim AS base

WORKDIR /app

# Native deps occasionally require a build toolchain during `bun install`.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

FROM base AS prune

COPY . .
RUN bunx turbo prune --scope=web --docker

FROM base AS build

COPY --from=prune /app/out/json/ ./
COPY --from=prune /app/bun.lock ./bun.lock
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY --from=prune /app/out/full/ ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN bun --cwd apps/web run build

FROM oven/bun:1.3.5-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app /app

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["bun", "dist/server/server.js"]
