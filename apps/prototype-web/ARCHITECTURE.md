# Micro Prototype Web App — Architecture

## Scope of this package

This package contains the Web UI for **Micro Prototype**. It is intentionally a client-only application shell in Slice 0. It does not create orders, calculate money, or persist business records yet.

## Required flow of responsibility

```text
React UI
  -> application use cases and view models
  -> ../../src/domain/craft-order public entrypoint
  -> LocalStore port
  -> IndexedDB adapter and local export/import
```

React components must never calculate a financial result or access IndexedDB directly. Future application code belongs in `client/src/application/`; persistence belongs in `client/src/storage/`; the existing Micro Domain Core remains in the repository root under `src/domain/`.

## Slice 0 boundary

Slice 0 establishes the Android-like RTL shell, routes, semantic design tokens, Light/Dark preference, Bottom Sheet behavior, and truthful empty states. Theme preference is the only browser preference stored at this point; it is not a financial record.

## Current limitations

There is no onboarding profile, order draft, LocalStore, financial calculation, export/import, PWA service worker, Auth, Sync, or Cloud data in this slice. Interactions that lead to a future slice state this explicitly through a local UI notice.
