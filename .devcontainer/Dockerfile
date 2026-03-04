FROM mcr.microsoft.com/devcontainers/base:ubuntu

ENV DEBIAN_FRONTEND=noninteractive \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH="${PNPM_HOME}:$PATH"

# Base CLI utilities required for upcoming installs
RUN apt-get update && apt-get install -y \
    nano \
    unzip \
    zip \
    software-properties-common \
    mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 + pnpm (via corepack)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

# PHP 8.3 toolchain via ondrej/php
RUN add-apt-repository ppa:ondrej/php -y \
    && apt-get update \
    && apt-get install -y \
        php8.3-cli \
        php8.3-common \
        php8.3-mysql \
        php8.3-sqlite3 \
        php8.3-zip \
        php8.3-gd \
        php8.3-mbstring \
        php8.3-curl \
        php8.3-xml \
        php8.3-soap \
        php8.3-bcmath \
        php8.3-intl \
        php8.3-pcov \
        php8.3-xdebug \
    && rm -rf /var/lib/apt/lists/*

# Composer
RUN curl -sS https://getcomposer.org/installer | php -- \
    --install-dir=/usr/local/bin \
    --filename=composer

WORKDIR /workspace
