FROM node:22-bookworm-slim AS web
WORKDIR /src
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build:client

FROM rust:bookworm AS native
WORKDIR /src
COPY . .
RUN cargo build --release -p echo-server

FROM debian:bookworm-slim
RUN useradd --create-home --uid 10001 echo
WORKDIR /app
COPY --from=native /src/target/release/echo-server /app/echo-server
COPY --from=web /src/dist/client /app/dist/client
USER echo
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
ENTRYPOINT ["/app/echo-server"]
