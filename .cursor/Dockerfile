FROM oven/bun:1.2.18

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  curl \
  git \
  jq \
  fd-find \
  openssh-client \
  python3 \
  python3-pip \
  python3-venv \
  ripgrep \
  sudo \
  build-essential \
  pkg-config \
  docker.io \
  docker-compose \
  fuse-overlayfs \
  && rm -rf /var/lib/apt/lists/*

# Install poof for ephemeral filesystem isolation
RUN curl -L https://github.com/jarred-sumner/poof/releases/latest/download/poof-linux-x86_64-musl -o /usr/local/bin/poof \
  && chmod +x /usr/local/bin/poof

# `fd` is packaged as `fd-find` on Debian.
RUN if command -v fdfind >/dev/null 2>&1 && ! command -v fd >/dev/null 2>&1; then ln -s "$(command -v fdfind)" /usr/local/bin/fd; fi

RUN if ! id -u agent >/dev/null 2>&1; then useradd -m -s /bin/bash agent; fi \
  && echo "agent ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/agent \
  && chmod 0440 /etc/sudoers.d/agent \
  && if getent group docker >/dev/null 2>&1; then usermod -aG docker agent; fi

USER agent
WORKDIR /home/agent
