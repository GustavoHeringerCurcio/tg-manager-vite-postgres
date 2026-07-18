FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/package.json
COPY frontend/package.json frontend/package.json
RUN corepack pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN corepack pnpm prisma:generate
RUN corepack pnpm typecheck
RUN corepack pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app /app
RUN chown -R appuser:appgroup /app
USER appuser
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "dist/server.js"]
