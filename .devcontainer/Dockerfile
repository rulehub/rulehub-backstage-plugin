# Optional Dockerfile if you want to tweak the base image further
FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bullseye

# Install additional OS packages required for native Node builds (node-gyp) and tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    build-essential python3 python-is-python3 pkg-config \
  && rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /workspaces
