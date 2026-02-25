FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ARG VITE_API_URL=/api

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
COPY packages/webapp/package.json packages/webapp/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/
COPY packages/webapp/ packages/webapp/

RUN pnpm --filter @hellenic-bot/shared build && pnpm --filter @hellenic-bot/api build && pnpm --filter @hellenic-bot/webapp build

FROM nginx:alpine

COPY --from=builder /app/packages/webapp/dist /usr/share/nginx/html
COPY packages/webapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
