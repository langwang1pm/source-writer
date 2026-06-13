
#!/bin/bash
set -euo pipefail

if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    echo "Detected ARM64, using linux/arm64 platform"
    export DOCKER_DEFAULT_PLATFORM=linux/arm64
fi

sudo mkdir -p /data/source-writer/uploads

if [ "${1:-}" = "--build" ]; then
    docker compose build
fi

docker compose up -d
echo "Deployed. Frontend at http://localhost"
