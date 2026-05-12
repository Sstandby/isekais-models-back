FROM oven/bun AS build

WORKDIR /app

COPY package.json package.json
COPY bun.lock bun.lock
COPY tsconfig.json tsconfig.json

RUN bun install --frozen-lockfile

COPY ./src ./src
COPY drizzle.config.ts drizzle.config.ts

ENV NODE_ENV=production

RUN bun run build:linux

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/dist/server server

ENV NODE_ENV=production

EXPOSE 3001

CMD ["./server"]
