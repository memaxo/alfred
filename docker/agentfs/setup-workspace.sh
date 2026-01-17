#!/bin/bash
set -e

# setup-workspace.sh
# Initializes the AgentFS session and mounts the CoW view at /workspace.

export PATH="$PATH:/root/.cargo/bin:/root/.agentfs/bin"
export HOME=/root

if [ ! -c /dev/fuse ]; then
    echo "[agentfs:setup] Warning: /dev/fuse not found, attempting to create..."
    mknod /dev/fuse c 10 229 || true
fi

# If /agentfs/agentfs.db doesn't exist, we need to init
if [ ! -f "/agentfs/agentfs.db" ]; then
    echo "[agentfs:setup] Initializing AgentFS session..."
    cd /root
    agentfs init --base /workspace.base --force default
    
    # Locate the created database (ID 'default' -> 'default.db')
    if [ -f "/root/.agentfs/default.db" ]; then
        mv /root/.agentfs/default.db /agentfs/agentfs.db
    else
        CREATED=$(find /root/.agentfs -name "*.db" | head -n 1)
        if [ -n "$CREATED" ]; then
            mv "$CREATED" /agentfs/agentfs.db
        else
            echo "[agentfs:setup] Error: Could not find initialized database."
            exit 1
        fi
    fi
fi

# Ensure config directory exists
mkdir -p /root/.agentfs
# Link it back so CLI tools (like fs ls) find it if needed
ln -sf /agentfs/agentfs.db /root/.agentfs/default.db

# Ensure mount point exists
mkdir -p /workspace

echo "[agentfs:setup] Mounting CoW view at /workspace..."
# Mount in background
agentfs mount /agentfs/agentfs.db /workspace --allow-root &

# Wait for mount to become available
sleep 3

# Verify mount is active
if ! mountpoint -q /workspace; then
    echo "[agentfs:setup] Error: Mount failed"
    exit 1
fi

echo "[agentfs:setup] Workspace ready. Keeping container alive..."
# Keep container alive
exec sleep infinity
