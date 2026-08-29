#!/usr/bin/env bash
set -euo pipefail

export CI=1

corepack pnpm install --frozen-lockfile --prefer-offline
corepack pnpm run typecheck
corepack pnpm run prototype:build