# ── Stage 1: Build ────────────────────────────────────────────────────────
FROM rust:1.78-slim as builder

# Install OpenSSL dev libs (needed by reqwest)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first (layer cache — only rebuilds if Cargo.toml changes)
COPY Cargo.toml Cargo.lock ./

# Dummy build to cache dependencies
RUN mkdir src && echo 'fn main(){}' > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Now copy real source and build
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ── Stage 2: Runtime (tiny image) ─────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/backend .

# Render sets PORT env var — our code already reads it
EXPOSE 8000
CMD ["./backend"]