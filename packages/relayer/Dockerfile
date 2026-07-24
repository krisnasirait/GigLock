# syntax=docker/dockerfile:1.7
# Multi-stage build for @giglock/relayer.
# Stage 1: build the workspace + relayer tsc.
# Stage 2: minimal runtime image with just the relayer dist + prod deps.

# ---------- Stage 1: builder ----------
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /repo

# Copy workspace manifest first so dependency install is cacheable.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy each package's manifest + sources.
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY packages/relayer/package.json packages/relayer/
COPY packages/relayer/tsconfig.json packages/relayer/
COPY packages/relayer/src packages/relayer/src
COPY packages/relayer/test packages/relayer/test

# Install all workspace deps (only the relayer's production deps are kept).
RUN pnpm install --frozen-lockfile --prod=false

# Build shared (must precede relayer build).
RUN pnpm --filter @giglock/shared build

# Build relayer (tsc emits dist/).
RUN pnpm --filter @giglock/relayer build

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Copy the small subset needed at runtime.
COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml /repo/tsconfig.base.json ./
COPY --from=builder /repo/packages/shared/package.json /repo/packages/shared/
COPY --from=builder /repo/packages/shared/dist /repo/packages/shared/dist
COPY --from=builder /repo/packages/relayer/package.json /repo/packages/relayer/
COPY --from=builder /repo/packages/relayer/dist /repo/packages/relayer/dist

# Install only production deps (no devDependencies, no build tools).
RUN pnpm install --frozen-lockfile --prod

# Drop unnecessary files from node_modules to reduce image size.
RUN find /repo/node_modules -type f \( -name '*.md' -o -name '*.map' \) -delete 2>/dev/null || true

# Run as the node user for least-privilege.
USER node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

# Healthcheck for Render / Fly / Kubernetes.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# Start the relayer from the dist/ output.
WORKDIR /repo/packages/relayer
CMD ["node", "dist/index.js"]
