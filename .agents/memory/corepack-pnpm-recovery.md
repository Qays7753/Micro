---
name: Corepack pnpm recovery
description: Recovery for Replit environments where Corepack cannot run the repository-pinned pnpm version reliably.
---

Prefer the repository-pinned pnpm version over an automatic Corepack upgrade when dependency setup fails inside Replit.

**Why:** Corepack can enter a recursive self-install failure or load a pnpm release incompatible with the active Node runtime, leaving `node_modules` absent and making an otherwise-correct Vite workflow report `vite not found`.

**How to apply:** Preserve the lockfile and package manifests, use the pinned package-manager version, and verify dependency recovery does not create tracked package changes.