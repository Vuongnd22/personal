# Multi-stage build for the NestJS API. Build context is the repo root (npm workspaces),
# e.g. `docker build -f backend/Dockerfile .`
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend/prisma/schema.prisma backend/prisma/schema.prisma
# ponytail: keeps devDependencies (prisma CLI needed for `migrate deploy` at container start).
# Prune to --omit=dev + a separate prisma-cli layer if image size becomes a real problem.
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY backend ./backend
RUN npm run build --workspace backend

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/prisma ./backend/prisma
COPY backend/assets ./backend/assets
COPY backend/package.json ./backend/package.json
WORKDIR /app/backend
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
