FROM node:22-bookworm-slim AS web
WORKDIR /src
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:client

FROM rust:bookworm AS native
WORKDIR /src
COPY . .
RUN cargo build --release --locked -p echo-server

FROM debian:bookworm-slim
RUN useradd --create-home --uid 10001 echo
WORKDIR /app
COPY --from=native /src/target/release/echo-server /app/echo-server
COPY --from=web /src/dist/client /app/dist/client
USER echo
ENV HOST=0.0.0.0 PORT=3000 ECHO_WT_HOST=0.0.0.0 ECHO_WT_PORT=4433
EXPOSE 3000
EXPOSE 4433/udp
ENTRYPOINT ["/app/echo-server"]
