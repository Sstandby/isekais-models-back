FROM oven/bun AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./

RUN bun install --frozen-lockfile

COPY ./src ./src
COPY drizzle.config.ts ./

ENV NODE_ENV=production

RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun-linux-x64 \
    --outfile dist/server \
    src/index.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/dist/server server

ENV NODE_ENV=production

EXPOSE 3001

CMD ["./server"]
