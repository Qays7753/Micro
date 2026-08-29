---
name: Workflow port forwarding
description: Replit preview detection can fail even when Vite reports ready if port mappings disagree.
---

Keep a webview workflow's wait port, the server's explicit bind port, and the `.replit` local port aligned.

**Why:** A server that reported ready on `0.0.0.0:5000` was still marked failed while the project mapped a different local port.

**How to apply:** When logs show a healthy listener but preview detection times out, compare all three port declarations before retrying or changing application code.