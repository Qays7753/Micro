#!/usr/bin/env python3
"""Validate Micro Operations Control records and coordination invariants."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTROL = ROOT / "docs" / "operations" / "control"
ITEM_STATUSES = {"BACKLOG", "READY", "CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "VERIFIED", "BLOCKED", "REVIEW_REQUIRED", "DEFERRED", "SUPERSEDED", "REOPENED"}
WORK_STATUSES = {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "REVIEW_REQUIRED", "VERIFIED", "SUPERSEDED"}
ACTIVE = {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "BLOCKED"}


def read_all(pattern: str) -> list[tuple[Path, dict]]:
    result = []
    for path in sorted(CONTROL.glob(pattern)):
        try:
            result.append((path, json.loads(path.read_text(encoding="utf-8"))))
        except Exception as exc:
            raise ValueError(f"{path.relative_to(ROOT)}: invalid JSON: {exc}") from exc
    return result


def nonempty_list(value: object) -> bool:
    return isinstance(value, list) and bool(value) and all(isinstance(x, str) and x.strip() for x in value)


def main() -> int:
    errors: list[str] = []
    items_raw = read_all("items/*.json")
    works_raw = read_all("workstreams/**/*.json")
    items: dict[str, dict] = {}

    for path, item in items_raw:
        required = {"id", "title", "type", "status", "priority", "stage", "summary", "acceptance", "areas", "contracts", "evidence", "updated_at"}
        missing = required - item.keys()
        if missing:
            errors.append(f"{path.name}: missing {sorted(missing)}")
            continue
        iid = item["id"]
        if path.stem != iid or not re.fullmatch(r"[A-Z]+-[0-9]{3}", iid):
            errors.append(f"{path.name}: filename/id mismatch or invalid ID")
        if iid in items:
            errors.append(f"duplicate item ID: {iid}")
        items[iid] = item
        if item["status"] not in ITEM_STATUSES:
            errors.append(f"{iid}: invalid status {item['status']}")
        if item["priority"] not in {"P0", "P1", "P2", "P3", "P4"}:
            errors.append(f"{iid}: invalid priority")
        if not nonempty_list(item["acceptance"]):
            errors.append(f"{iid}: acceptance must be non-empty")
        if not isinstance(item["areas"], list) or not isinstance(item["contracts"], list):
            errors.append(f"{iid}: areas/contracts must be arrays")
        if item["status"] == "VERIFIED":
            if len(item.get("merge_sha", "")) < 7 or len(item.get("verified_on_main_sha", "")) < 7 or not item.get("evidence"):
                errors.append(f"{iid}: VERIFIED requires merge SHA, verified-on-main SHA, and evidence")

    for iid, item in items.items():
        for dep in item.get("dependencies", []):
            if dep not in items:
                errors.append(f"{iid}: unknown dependency {dep}")

    active: list[tuple[str, dict]] = []
    seen_work: set[str] = set()
    for path, work in works_raw:
        required = {"id", "title", "status", "items", "branch", "base_sha", "areas", "contracts", "started_at", "updated_at", "next_action"}
        missing = required - work.keys()
        if missing:
            errors.append(f"{path.name}: missing {sorted(missing)}")
            continue
        wid = work["id"]
        if path.stem != wid or not re.fullmatch(r"WS-[0-9]{3}", wid):
            errors.append(f"{path.name}: filename/id mismatch or invalid workstream ID")
        if wid in seen_work:
            errors.append(f"duplicate workstream ID: {wid}")
        seen_work.add(wid)
        if work["status"] not in WORK_STATUSES:
            errors.append(f"{wid}: invalid status")
        if not nonempty_list(work["items"]):
            errors.append(f"{wid}: items must be non-empty")
        for iid in work.get("items", []):
            if iid not in items:
                errors.append(f"{wid}: unknown item {iid}")
        if work["status"] in ACTIVE:
            if len(work["base_sha"]) < 7 or not work["branch"].strip():
                errors.append(f"{wid}: active claim requires branch and base SHA")
            active.append((wid, work))

    for pos, (left_id, left) in enumerate(active):
        for right_id, right in active[pos + 1:]:
            area_overlap = set(left["areas"]) & set(right["areas"])
            contract_overlap = set(left["contracts"]) & set(right["contracts"])
            if area_overlap or contract_overlap:
                errors.append(f"active overlap {left_id}/{right_id}: areas={sorted(area_overlap)}, contracts={sorted(contract_overlap)}")

    release_path = CONTROL / "releases" / "pre-pilot.json"
    release = json.loads(release_path.read_text(encoding="utf-8"))
    for iid in release["required_items"] + [release["final_gate"]]:
        if iid not in items:
            errors.append(f"pre-pilot: unknown item {iid}")

    # Repository-local references must resolve when validation runs inside a full checkout.
    if (ROOT / "AGENTS.md").exists():
        for iid, item in items.items():
            for reference in item.get("contracts", []) + item.get("evidence", []):
                if reference and not reference.startswith(("http://", "https://")) and not (ROOT / reference).exists():
                    errors.append(f"{iid}: missing local reference {reference}")
        reports = json.loads((CONTROL / "reports" / "index.json").read_text(encoding="utf-8"))
        for report in reports.get("reports", []):
            if not report["path"].startswith(("http://", "https://")) and not (ROOT / report["path"]).exists():
                errors.append(f"report index: missing {report['path']}")

        secret_patterns = [re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"), re.compile(r"github_pat_[A-Za-z0-9_]{20,}"), re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")]
        for path in list(CONTROL.rglob("*.json")) + list(CONTROL.rglob("*.md")) + list(CONTROL.rglob("*.csv")):
            text = path.read_text(encoding="utf-8", errors="ignore")
            if any(pattern.search(text) for pattern in secret_patterns):
                errors.append(f"possible secret in {path.relative_to(ROOT)}")

    generated = subprocess.run([sys.executable, str(Path(__file__).with_name("generate_tracker.py")), "--check"], cwd=ROOT, capture_output=True, text=True)
    if generated.returncode:
        errors.append(generated.stdout.strip() or generated.stderr.strip())

    if errors:
        print("Operations Control validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print(f"Operations Control valid: {len(items)} items, {len(works_raw)} workstreams, {len(active)} active claims.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
