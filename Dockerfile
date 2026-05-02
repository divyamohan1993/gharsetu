# syntax=docker/dockerfile:1.7

# ---------- Stage 1: builder ----------
FROM node:22-bookworm-slim AS builder

ENV NODE_ENV=development \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      pkg-config \
      libvips-dev \
      libsqlite3-dev \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
 && npm prune --omit=dev \
 && rm -rf /root/.npm

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libvips42 \
      libsqlite3-0 \
      ca-certificates \
      tini \
      curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

RUN mkdir -p /tmp/uploads && chown -R node:node /tmp/uploads

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8080/healthz || exit 1

LABEL org.opencontainers.image.title="GharSetu" \
      org.opencontainers.image.description="Localized PG/room rental for university students. ONDC-connected." \
      org.opencontainers.image.source="https://github.com/akshit-thakur/gharsetu" \
      org.opencontainers.image.vendor="dmj.one" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.authors="Akshit Thakur"

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","dist/server.js"]
