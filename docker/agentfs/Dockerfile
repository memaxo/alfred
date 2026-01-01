# syntax=docker/dockerfile:1

FROM rust:1.85-bookworm AS codex

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    clang \
    libssl-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Only copy the Rust workspace to keep the build context smaller.
COPY vendor/codex/codex-rs ./codex-rs

WORKDIR /src/codex-rs
RUN cargo build --release -p codex-cli

# Build ast-grep (sg)
RUN cargo install ast-grep --locked --root /opt/ast-grep


FROM oven/bun:1.3.5-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fd-find \
    lsd \
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/fdfind /usr/local/bin/fd || true

COPY --from=codex /src/codex-rs/target/release/codex /usr/local/bin/codex
COPY --from=codex /opt/ast-grep/bin/sg /usr/local/bin/sg
RUN ln -s /usr/local/bin/sg /usr/local/bin/ast-grep || true

ENV CODEX_UNSAFE_ALLOW_NO_SANDBOX=1

CMD ["sleep", "infinity"]
