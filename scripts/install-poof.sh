#!/usr/bin/env bash
# Install poof for ephemeral filesystem isolation
# Supports Debian/Ubuntu, Arch Linux, and static binary installation

set -euo pipefail

POOF_VERSION="${POOF_VERSION:-latest}"
POOF_BIN="${POOF_BIN:-/usr/local/bin/poof}"

echo "Installing poof (ephemeral filesystem isolation)..."

# Detect platform
detect_platform() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    echo "$ID"
  elif [[ "$(uname)" == "Linux" ]]; then
    echo "linux"
  else
    echo "unknown"
  fi
}

# Detect architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)
      echo "x86_64"
      ;;
    aarch64|arm64)
      echo "aarch64"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

install_debian() {
  local arch="$1"
  local deb_file="poof_${arch}.deb"
  
  echo "Installing poof via Debian package..."
  
  # Verify sudo access
  if ! sudo -v; then
    echo "Error: sudo access required for poof installation"
    exit 1
  fi
  
  # Download .deb package
  curl -LO "https://github.com/jarred-sumner/poof/releases/${POOF_VERSION}/download/${deb_file}"
  
  # Install
  sudo dpkg -i "$deb_file" || {
    echo "Installing dependencies..."
    sudo apt-get update
    sudo apt-get install -f -y
    sudo dpkg -i "$deb_file"
  }
  
  # Cleanup
  rm -f "$deb_file"
  
  echo "✓ Poof installed via Debian package"
}

install_arch() {
  local arch="$1"
  local pkg_file="poof-${arch}.pkg.tar.xz"
  
  echo "Installing poof via Arch package..."
  
  # Verify sudo access
  if ! sudo -v; then
    echo "Error: sudo access required for poof installation"
    exit 1
  fi
  
  # Download .pkg.tar.xz package
  curl -LO "https://github.com/jarred-sumner/poof/releases/${POOF_VERSION}/download/${pkg_file}"
  
  # Install
  sudo pacman -U --noconfirm "$pkg_file"
  
  # Cleanup
  rm -f "$pkg_file"
  
  echo "✓ Poof installed via Arch package"
}

install_static() {
  local arch="$1"
  local binary_name="poof-linux-${arch}-musl"
  
  echo "Installing poof via static binary..."
  
  # Verify sudo access
  if ! sudo -v; then
    echo "Error: sudo access required for poof installation"
    exit 1
  fi
  
  # Download static binary
  curl -L "https://github.com/jarred-sumner/poof/releases/${POOF_VERSION}/download/${binary_name}" -o poof
  
  # Make executable
  chmod +x poof
  
  # Install to system path
  sudo mv poof "$POOF_BIN"
  
  echo "✓ Poof installed via static binary to ${POOF_BIN}"
}

# Check if poof is already installed
if command -v poof &> /dev/null; then
  INSTALLED_VERSION=$(poof --version 2>/dev/null || echo "unknown")
  echo "Poof is already installed: ${INSTALLED_VERSION}"
  echo "To reinstall, remove it first: sudo rm $(command -v poof)"
  exit 0
fi

# Check if running on Linux
if [[ "$(uname)" != "Linux" ]]; then
  echo "⚠ Warning: Poof only works on Linux. Skipping installation."
  echo "On macOS/Windows, ALFRED will automatically fall back to worktree-based isolation."
  exit 0
fi

# Detect platform and architecture
PLATFORM=$(detect_platform)
ARCH=$(detect_arch)

if [[ "$ARCH" == "unknown" ]]; then
  echo "Error: Unsupported architecture: $(uname -m)"
  exit 1
fi

# Map architecture names
case "$ARCH" in
  x86_64)
    DEB_ARCH="amd64"
    ARCH_ARCH="x86_64"
    STATIC_ARCH="x86_64"
    ;;
  aarch64)
    DEB_ARCH="arm64"
    ARCH_ARCH="aarch64"
    STATIC_ARCH="aarch64"
    ;;
esac

# Install based on platform
case "$PLATFORM" in
  debian|ubuntu)
    install_debian "$DEB_ARCH"
    ;;
  arch|manjaro)
    install_arch "$ARCH_ARCH"
    ;;
  *)
    echo "Unknown platform: ${PLATFORM}"
    echo "Falling back to static binary installation..."
    install_static "$STATIC_ARCH"
    ;;
esac

# Verify installation
if command -v poof &> /dev/null; then
  INSTALLED_VERSION=$(poof --version 2>/dev/null || echo "unknown")
  echo ""
  echo "✓ Poof installed successfully: ${INSTALLED_VERSION}"
  echo ""
  echo "To enable poof isolation in ALFRED, set:"
  echo "  export ORCH_USE_POOF=1"
  echo ""
  echo "For Docker, ensure these flags are set:"
  echo "  --device /dev/fuse --security-opt seccomp=unconfined"
  echo ""
else
  echo "Error: Poof installation failed verification"
  exit 1
fi
