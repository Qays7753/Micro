# Initial Z AI Task — Independent A-to-Z Analysis, Control, and Documentation

Repository: `https://github.com/Qays7753/Micro`  
Branch: `zai/micro-market-delivery-handoff-20261111`  
Expected base SHA: `16c90e48bdc018939f97f41d05e969c900bc30e0` (verify live)  
Credential: secure GitHub credential field only; never paste a token into chat, commits, logs, or files.

You are the sole accountable analyst and repository executor for this handoff. Read `MASTER-PROMPT-EN.md` and follow its limits. Use only the repository/GitHub state and the committed handoff files. Never connect to, search, request credentials for, or include links to any external file service or provider account. Keep all work on the existing branch; do not touch `main`, merge, deploy, or open a PR.

Before changing anything, independently inspect the actual Micro codebase and the six approved Market/Delivery specifications. Build an evidence-based A-to-Z understanding of how the two features fit into the existing single Micro app: current stack and entry points; navigation/UI; identity, roles and permissions; modules/layers; APIs and data flows; persistence; files/images and privacy; notifications; offline/failure behavior; tests/CI; deployment/configuration; and operational risks. Do not treat prior Manus reports, the old plan, or previous Z AI prompts as findings to implement. Form your own findings from repository paths, symbols, and tests first; only then cross-check the supplied scan report and document disagreements.

Assess Cloudflare and every other relevant integration from repository evidence only. For each, distinguish what is configured in source, what is merely documented/proposed, what is absent, and what remains unknown. Recommend what is truly needed for (a) a standalone prototype, (b) a limited connected pilot, and (c) production. Consider the owner's preference for local/mock data and manual role management in an early prototype before automated third-party APIs; compare it with the approved feature decisions and identify any conflict instead of silently assuming a provider or automation.

Then, in order and as separate commits on this same branch:

1. Complete the read-only analysis and record it in the unified `EXECUTION-REPORT.md`.
2. Reconcile Operations Control for PR #384 / `WS-248` / `DOC-032` using verified live evidence.
3. Synchronize every approved Market OD-01…OD-21 decision into canonical GitHub docs.
4. Synchronize every approved Delivery OD01…OD31 decision and cross-cutting role/access/privacy/notification rules into canonical GitHub docs.
5. Update the unified report with a full implementation roadmap and integration/action matrix, then stop for owner review before any feature-code implementation.

The report must explain gaps, contradictions, risks, dependencies, what Z AI can implement later, what requires owner/Manus work in provider accounts, and the exact acceptance evidence and rollback boundary for each future stage. Do not re-ask decisions already explicit in the committed specifications. Do not mark features implemented or production-ready.

Keep analysis agents (if available) read-only and non-overlapping; the parent Z AI is the only writer. No code changes or structural refactoring are authorized now. Run only checks mandatory and directly relevant to Control/document edits; do not run a broad application test suite when code is unchanged. After the report and documentation commits are pushed, stop and wait for the owner's next instruction.

Return the branch URL, separate commit SHAs, changed paths, evidence, actual checks run, and the final Arabic report. End with `ANALYSIS_AND_DOCUMENT_SYNC_COMPLETE — OWNER_REVIEW_REQUIRED_BEFORE_CODE` or `BLOCKED — <specific cause>`.