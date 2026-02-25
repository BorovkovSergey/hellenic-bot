FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/bot/package.json packages/bot/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/
COPY packages/bot/ packages/bot/

RUN pnpm --filter @hellenic-bot/shared build && pnpm --filter @hellenic-bot/api build && pnpm --filter @hellenic-bot/bot build

FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/api/package.json packages/api/
COPY --from=builder /app/packages/api/dist packages/api/dist/
COPY --from=builder /app/packages/bot/package.json packages/bot/
COPY --from=builder /app/packages/bot/dist packages/bot/dist/

RUN pnpm install --frozen-lockfile --prod

USER appuser

CMD ["node", "packages/bot/dist/index.js"]
