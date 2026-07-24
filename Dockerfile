FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/package.json
COPY frontend/package.json frontend/package.json
RUN corepack pnpm install --frozen-lockfile

FROM deps AS builder
COPY server/tsconfig.json server/tsconfig.json
COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/vite.config.ts frontend/vite.config.ts
COPY frontend/index.html frontend/index.html
COPY frontend/tailwind.config.js frontend/tailwind.config.js
COPY frontend/postcss.config.js frontend/postcss.config.js
COPY frontend/mockDevServer.ts frontend/mockDevServer.ts
COPY server/prisma server/prisma
RUN corepack pnpm prisma:generate
COPY server/src server/src
COPY frontend/src frontend/src
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
