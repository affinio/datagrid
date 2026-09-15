FROM mcr.microsoft.com/devcontainers/base:noble

# Base utilities for datagrid development
RUN apt-get update && apt-get install -y \
    curl \
    nano \
    unzip \
    zip \
    git \
    ca-certificates \
    libnspr4 \
    libnss3 \
    libatk1.0-0t64 \
    libatspi2.0-0t64 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxcb1 \
    libxkbcommon0 \
    libasound2t64 \
    libpq-dev \
    build-essential \
    iputils-ping \
    netcat-openbsd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Node.js 24 + pnpm (via corepack)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

# Open AI Codex 
RUN npm i -g @openai/codex

# Install uv for Python
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && mv /root/.local/bin/uv /usr/local/bin/uv

# Python virtual environment inside container
ENV UV_SYSTEM_PYTHON=1

WORKDIR /workspace
