# Multi-stage build for the Next.js app (standalone output). Build context is the repo root
# (npm workspaces), e.g. `docker build -f frontend/Dockerfile .`
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY frontend ./frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace frontend

# next.config.ts sets outputFileTracingRoot to the repo root, so the standalone tree mirrors
# the monorepo layout: the server entry lands at .next/standalone/frontend/server.js.
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
# Add `COPY --from=build /app/frontend/public ./frontend/public` if a public/ folder is ever added.
EXPOSE 3000
CMD ["node", "frontend/server.js"]
