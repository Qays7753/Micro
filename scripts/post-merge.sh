#!/usr/bin/env bash
set -euo pipefail

export CI=1

pnpm install --frozen-lockfile --prefer-offline
pnpm run typecheck
pnpm run prototype:build