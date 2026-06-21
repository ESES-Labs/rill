FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tsconfig.json* ./

ENV PORT=3002
EXPOSE 3002

CMD ["bun", "run", "src/index.ts"]
