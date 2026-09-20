#!/usr/bin/env python3
"""Validate Micro Operations Control records and coordination invariants."""

from __future__ import annotations

import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CONTROL = ROOT / "docs" / "operations" / "control"
ITEMS_DIR = CONTROL / "items"
WORKSTREAMS_DIR = CONTROL / "workstreams"
ITEM_SCHEMA_PATH = CONTROL / "schemas" / "item.schema.json"
WORK_SCHEMA_PATH = CONTROL / "schemas" / "workstream.schema.json"
ITEM_STATUSES = {"BACKLOG", "READY", "CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "VERIFIED", "BLOCKED", "REVIEW_REQUIRED", "DEFERRED", "SUPERSEDED", "REOPENED"}
WORK_STATUSES = {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "BLOCKED", "REVIEW_REQUIRED", "VERIFIED", "SUPERSEDED", "REOPENED", "DEFERRED"}
ACTIVE_WORK_STATUSES = {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "BLOCKED"}
NON_TERMINAL_ITEM_STATUSES = {"BACKLOG", "READY", "CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "BLOCKED", "REVIEW_REQUIRED", "DEFERRED", "REOPENED"}
ITEM_TRANSITIONS = {
    "BACKLOG": {"READY", "DEFERRED", "REVIEW_REQUIRED", "SUPERSEDED"},
    "READY": {"CLAIMED", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED", "SUPERSEDED"},
    "CLAIMED": {"IN_PROGRESS", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED", "SUPERSEDED"},
    "IN_PROGRESS": {"IN_REVIEW", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED", "REOPENED"},
    "IN_REVIEW": {"MERGED_UNVERIFIED", "BLOCKED", "REVIEW_REQUIRED", "REOPENED", "SUPERSEDED"},
    "MERGED_UNVERIFIED": {"VERIFIED", "REOPENED", "REVIEW_REQUIRED"},
    "VERIFIED": {"REOPENED", "SUPERSEDED"},
    "BLOCKED": {"READY", "IN_PROGRESS", "DEFERRED", "REVIEW_REQUIRED", "SUPERSEDED"},
    "REVIEW_REQUIRED": {"READY", "IN_PROGRESS", "MERGED_UNVERIFIED", "DEFERRED", "REOPENED", "SUPERSEDED"},
    "DEFERRED": {"READY", "REOPENED", "SUPERSEDED"},
    "REOPENED": {"READY", "CLAIMED", "IN_PROGRESS", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED"},
    "SUPERSEDED": set(),
}
WORK_TRANSITIONS = {
    "CLAIMED": {"IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DEFERRED", "REVIEW_REQUIRED", "SUPERSEDED"},
    "IN_PROGRESS": {"IN_REVIEW", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED", "REOPENED"},
    "IN_REVIEW": {"MERGED_UNVERIFIED", "BLOCKED", "REVIEW_REQUIRED", "REOPENED", "SUPERSEDED"},
    "MERGED_UNVERIFIED": {"VERIFIED", "REOPENED", "REVIEW_REQUIRED"},
    "BLOCKED": {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "DEFERRED", "REVIEW_REQUIRED", "SUPERSEDED"},
    "REVIEW_REQUIRED": {"CLAIMED", "IN_PROGRESS", "VERIFIED", "DEFERRED", "REOPENED", "SUPERSEDED"},
    "VERIFIED": {"REOPENED", "SUPERSEDED"},
    "DEFERRED": {"CLAIMED", "IN_PROGRESS", "REOPENED", "SUPERSEDED"},
    "REOPENED": {"CLAIMED", "IN_PROGRESS", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED"},
    "SUPERSEDED": set(),
}


class SchemaError(ValueError):
    pass


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - message is the useful output
        raise SchemaError(f"{path.relative_to(ROOT)}: invalid JSON: {exc}") from exc


def type_matches(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    return False


def validate_schema(value: Any, schema: dict[str, Any], path: str) -> list[str]:
    errors: list[str] = []
    expected = schema.get("type")
    expected_types = expected if isinstance(expected, list) else [expected] if expected else []
    if expected_types and not any(type_matches(value, candidate) for candidate in expected_types):
        return [f"{path}: expected {expected_types}, got {type(value).__name__}"]
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value {value!r} is not in enum")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{path}: minLength {schema['minLength']} violated")
        if "pattern" in schema and re.fullmatch(schema["pattern"], value) is None:
            errors.append(f"{path}: pattern {schema['pattern']!r} violated")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{path}: minItems {schema['minItems']} violated")
        if "items" in schema:
            for index, child in enumerate(value):
                errors.extend(validate_schema(child, schema["items"], f"{path}[{index}]"))
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for required in schema.get("required", []):
            if required not in value:
                errors.append(f"{path}: missing required property {required}")
        if schema.get("additionalProperties") is False:
            unknown = sorted(set(value) - set(properties))
            errors.extend(f"{path}: unknown property {key}" for key in unknown)
        for key, child_schema in properties.items():
            if key in value:
                errors.extend(validate_schema(value[key], child_schema, f"{path}.{key}"))
    return errors


def read_all(pattern: str) -> list[tuple[Path, dict[str, Any]]]:
    result: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(CONTROL.glob(pattern)):
        value = read_json(path)
        if not isinstance(value, dict):
            raise SchemaError(f"{path.relative_to(ROOT)}: top-level value must be object")
        result.append((path, value))
    return result


def git(*args: str, check: bool = True) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def commit_exists(sha: str) -> bool:
    return bool(sha) and subprocess.run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=ROOT, capture_output=True).returncode == 0


def commit_reachable_from_main(sha: str, main_ref: str) -> bool:
    return commit_exists(sha) and subprocess.run(["git", "merge-base", "--is-ancestor", sha, main_ref], cwd=ROOT, capture_output=True).returncode == 0


def normalize_scope(value: str) -> str:
    value = value.strip().replace("\\", "/")
    if value.startswith("./"):
        value = value[2:]
    value = posixpath.normpath(value).rstrip("/")
    return value.lower()


def scopes_overlap(left: str, right: str) -> bool:
    left_norm, right_norm = normalize_scope(left), normalize_scope(right)
    return left_norm == right_norm or left_norm.startswith(right_norm + "/") or right_norm.startswith(left_norm + "/")


def validate_history(record: dict[str, Any], allowed_statuses: set[str], transitions: dict[str, set[str]], label: str, errors: list[str]) -> None:
    history = record.get("status_history")
    if not isinstance(history, list) or not history:
        return
    statuses = [entry.get("status") for entry in history if isinstance(entry, dict)]
    if statuses[-1] != record.get("status"):
        errors.append(f"{label}: last status_history entry must match current status")
    if len(history) == 1 and not record.get("migration_baseline") and record.get("status") not in {"BACKLOG", "CLAIMED"}:
        errors.append(f"{label}: one-entry imported history requires migration_baseline=true")
    for previous, current in zip(statuses, statuses[1:]):
        if previous not in allowed_statuses or current not in allowed_statuses or current not in transitions.get(previous, set()):
            errors.append(f"{label}: illegal status transition {previous!r} -> {current!r}")


def validate_record_rules(record: dict[str, Any], label: str, errors: list[str], main_ref: str, non_terminal: set[str] | None = None) -> None:
    status = record["status"]
    if status in (non_terminal or NON_TERMINAL_ITEM_STATUSES) and not record.get("next_action", "").strip():
        errors.append(f"{label}: non-terminal status requires next_action")
    if status == "BLOCKED" and not record.get("blocked_reason", "").strip():
        errors.append(f"{label}: BLOCKED requires blocked_reason")
    if status == "DEFERRED" and not record.get("deferred_reason", "").strip():
        errors.append(f"{label}: DEFERRED requires deferred_reason")
    if status == "MERGED_UNVERIFIED" and not record.get("merge_sha", "").strip():
        errors.append(f"{label}: MERGED_UNVERIFIED requires merge_sha")
    if status == "VERIFIED":
        for field in ("merge_sha", "verified_on_main_sha"):
            if not record.get(field, "").strip():
                errors.append(f"{label}: VERIFIED requires {field}")
            elif not commit_exists(record[field]):
                errors.append(f"{label}: {field} is not a local commit")
            elif not commit_reachable_from_main(record[field], main_ref):
                errors.append(f"{label}: {field} is not reachable from {main_ref}")
        if not record.get("evidence"):
            errors.append(f"{label}: VERIFIED requires evidence")


def check_local_references(value: str, label: str, errors: list[str]) -> None:
    if value and not value.startswith(("http://", "https://")) and not (ROOT / value).exists():
        errors.append(f"{label}: missing local reference {value}")


def github_repo() -> str | None:
    remote = subprocess.run(["git", "remote", "get-url", "origin"], cwd=ROOT, capture_output=True, text=True)
    if remote.returncode:
        return None
    match = re.search(r"github\.com[/:]([^/]+/[^/]+?)(?:\.git)?$", remote.stdout.strip())
    return match.group(1) if match else None


def check_github_workstream(work: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    if not work.get("pr") or shutil.which("gh") is None:
        return
    repo = github_repo()
    if not repo:
        warnings.append(f"{work['id']}: could not resolve GitHub repository for PR cross-check")
        return
    result = subprocess.run(
        [
            "gh", "api", f"repos/{repo}/pulls/{work['pr']}",
            "--jq", "{state:.state,merged_at:.merged_at,head:.head.ref,base:.base.ref}",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        env={**os.environ, "NO_COLOR": "1", "TERM": "dumb", "GH_FORCE_TTY": "0", "CLICOLOR": "0"},
    )
    if result.returncode:
        warnings.append(f"{work['id']}: GitHub PR #{work['pr']} could not be read; local checks still ran")
        return
    try:
        remote = json.loads(result.stdout)
    except json.JSONDecodeError:
        warnings.append(f"{work['id']}: GitHub PR #{work['pr']} returned invalid JSON")
        return
    if work.get("status") in ACTIVE_WORK_STATUSES and remote.get("merged_at"):
        errors.append(f"{work['id']}: PR #{work['pr']} is merged while Workstream status is {work['status']}")
    if work.get("status") in ACTIVE_WORK_STATUSES and remote.get("head") != work.get("branch"):
        errors.append(f"{work['id']}: claimed branch {work.get('branch')} differs from PR #{work['pr']} head {remote.get('head')}")
    if work.get("status") == "VERIFIED" and not remote.get("merged_at"):
        errors.append(f"{work['id']}: VERIFIED Workstream requires a merged GitHub PR")


def validate_migration_map(items: dict[str, dict[str, Any]], errors: list[str]) -> None:
    path = CONTROL / "migration-map.md"
    if not path.exists():
        errors.append("migration-map.md: missing")
        return
    text = path.read_text(encoding="utf-8")
    expected = {
        "47": ["CTRL-001"], "75": ["DEVICE-001"], "92": ["UAT-001", "AUDIT-001", "PILOT-001"],
        "93": ["SCOPE-002"], "94": ["SCOPE-001"], "95": ["SCOPE-001"], "96": ["CTRL-001"],
        "97": ["SCOPE-001"], "101": ["GOV-001"], "122": ["HARD-009", "HARD-010", "HARD-011"], "131": ["UX-002"],
    }
    for line_no, ids in expected.items():
        if not re.search(rf"^\| {re.escape(line_no)} \|", text, flags=re.MULTILINE):
            errors.append(f"migration-map.md: legacy todo line {line_no} is not mapped")
        for iid in ids:
            if iid not in items:
                errors.append(f"migration-map.md: mapped item {iid} is missing")
            if iid not in text:
                errors.append(f"migration-map.md: mapping for {iid} is missing")


def validate_pre_pilot_gate(items: dict[str, dict[str, Any]], release: dict[str, Any], errors: list[str]) -> None:
    required = release.get("required_items", [])
    required_set = set(required)
    safety_items = {f"G-{number:03d}" for number in range(1, 7)}
    missing_safety = sorted(safety_items - required_set)
    if missing_safety:
        errors.append(f"pre-pilot: mandatory safety items missing from gate: {', '.join(missing_safety)}")
    fix_before_pilot = {iid for iid, item in items.items() if item.get("classification") == "FIX_BEFORE_PILOT"}
    missing_fix = sorted(fix_before_pilot - required_set)
    if missing_fix:
        errors.append(f"pre-pilot: FIX_BEFORE_PILOT items missing from gate: {', '.join(missing_fix)}")
    for iid, item in sorted(items.items()):
        gate_classification = item.get("gate_classification")
        if item.get("status") == "DEFERRED" and gate_classification == "NOT_APPLICABLE":
            errors.append(f"{iid}: DEFERRED requires an explicit gate_classification")
        if gate_classification == "DEPENDENCY_GATE_REQUIRED_BEFORE_PILOT" and iid not in required_set:
            errors.append(f"{iid}: dependency-gated pre-pilot item is missing from PRE-PILOT")
        if gate_classification == "MAIN_VERIFIED" and item.get("status") != "VERIFIED":
            errors.append(f"{iid}: MAIN_VERIFIED requires status VERIFIED")
    final_gate = release.get("final_gate")
    final = items.get(final_gate)
    if final and final.get("status") in {"READY", "CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "VERIFIED"}:
        not_verified = [iid for iid in required if items.get(iid, {}).get("status") != "VERIFIED"]
        if not_verified:
            errors.append(f"pre-pilot: {final_gate} is actionable before required items are VERIFIED: {', '.join(not_verified)}")
    roots: dict[str, list[str]] = {}
    for iid, item in items.items():
        root = item.get("root_cause", "").strip()
        if root:
            roots.setdefault(root, []).append(iid)
    for root, ids in sorted(roots.items()):
        if len(ids) > 1:
            errors.append(f"duplicate root cause {root}: {', '.join(sorted(ids))}")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        item_schema = read_json(ITEM_SCHEMA_PATH)
        work_schema = read_json(WORK_SCHEMA_PATH)
        main_ref = git("rev-parse", "--verify", "origin/main^{commit}")
    except (SchemaError, RuntimeError, FileNotFoundError) as exc:
        print(f"Operations Control validation failed: cannot establish Git/schema baseline: {exc}")
        return 1

    try:
        items_raw = read_all("items/*.json")
        works_raw = read_all("workstreams/**/*.json")
    except SchemaError as exc:
        print(f"Operations Control validation failed: {exc}")
        return 1

    items: dict[str, dict[str, Any]] = {}
    for path, item in items_raw:
        label = str(path.relative_to(ROOT))
        errors.extend(f"{label}: {error}" for error in validate_schema(item, item_schema, label))
        iid = item.get("id")
        if isinstance(iid, str):
            if path.stem != iid:
                errors.append(f"{label}: filename/id mismatch")
            if iid in items:
                errors.append(f"duplicate item ID: {iid}")
            items[iid] = item
            validate_history(item, ITEM_STATUSES, ITEM_TRANSITIONS, iid, errors)
            validate_record_rules(item, iid, errors, main_ref)
            for reference in item.get("contracts", []) + item.get("evidence", []) + item.get("source", {}).get("evidence", []):
                check_local_references(reference, iid, errors)

    for iid, item in items.items():
        for relation in item.get("dependencies", []) + item.get("related_items", []):
            if relation not in items:
                errors.append(f"{iid}: unknown item reference {relation}")

    active: list[tuple[str, dict[str, Any]]] = []
    seen_work: set[str] = set()
    item_owners: dict[str, list[str]] = {}
    for path, work in works_raw:
        label = str(path.relative_to(ROOT))
        errors.extend(f"{label}: {error}" for error in validate_schema(work, work_schema, label))
        wid = work.get("id")
        if isinstance(wid, str):
            if path.stem != wid:
                errors.append(f"{label}: filename/id mismatch")
            if wid in seen_work:
                errors.append(f"duplicate workstream ID: {wid}")
            seen_work.add(wid)
            validate_history(work, WORK_STATUSES, WORK_TRANSITIONS, wid, errors)
            validate_record_rules(work, wid, errors, main_ref, ACTIVE_WORK_STATUSES | {"REVIEW_REQUIRED", "DEFERRED", "REOPENED"})
            if work.get("status") in ACTIVE_WORK_STATUSES:
                if not work.get("branch", "").strip() or len(work.get("base_sha", "")) < 7:
                    errors.append(f"{wid}: active claim requires branch and full base SHA")
                if not commit_exists(work.get("base_sha", "")):
                    errors.append(f"{wid}: base_sha is not a local commit")
                elif work.get("base_sha") != main_ref:
                    warnings.append(f"{wid}: base_sha {work['base_sha']} differs from origin/main {main_ref}")
                active.append((wid, work))
            elif work.get("status") in {"REVIEW_REQUIRED", "DEFERRED", "REOPENED"} and work.get("base_sha") and work.get("base_sha") != main_ref:
                warnings.append(f"{wid}: historical base_sha differs from current origin/main")
            for iid in work.get("items", []):
                if iid not in items:
                    errors.append(f"{wid}: unknown item {iid}")
                item_owners.setdefault(iid, []).append(wid)
            check_github_workstream(work, errors, warnings)
            updated = str(work.get("updated_at", ""))[:10]
            try:
                if (date.today() - date.fromisoformat(updated)).days > 30:
                    warnings.append(f"{wid}: claim has not been updated for more than 30 days")
            except ValueError:
                pass

    for iid, owners in item_owners.items():
        active_owners = [wid for wid, work in active if iid in work.get("items", [])]
        if len(active_owners) > 1:
            errors.append(f"item {iid}: active Workstream ownership overlaps {sorted(active_owners)}")

    for position, (left_id, left) in enumerate(active):
        for right_id, right in active[position + 1:]:
            area_overlap = sorted({a for a in left["areas"] for b in right["areas"] if scopes_overlap(a, b)})
            contract_overlap = sorted({a for a in left["contracts"] for b in right["contracts"] if scopes_overlap(a, b)})
            if area_overlap or contract_overlap:
                errors.append(f"active overlap {left_id}/{right_id}: areas={area_overlap}, contracts={contract_overlap}")

    release_path = CONTROL / "releases" / "pre-pilot.json"
    release = read_json(release_path)
    for iid in release.get("required_items", []) + [release.get("final_gate")]:
        if iid not in items:
            errors.append(f"pre-pilot: unknown item {iid}")
    validate_pre_pilot_gate(items, release, errors)

    reports = read_json(CONTROL / "reports" / "index.json")
    for report in reports.get("reports", []):
        check_local_references(report.get("path", ""), "report index", errors)

    secret_patterns = [re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"), re.compile(r"github_pat_[A-Za-z0-9_]{20,}"), re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")]
    for path in list(CONTROL.rglob("*.json")) + list(CONTROL.rglob("*.md")) + list(CONTROL.rglob("*.csv")):
        text = path.read_text(encoding="utf-8", errors="ignore")
        if any(pattern.search(text) for pattern in secret_patterns):
            errors.append(f"possible secret in {path.relative_to(ROOT)}")

    validate_migration_map(items, errors)

    generated = subprocess.run([sys.executable, str(Path(__file__).with_name("generate_tracker.py")), "--check"], cwd=ROOT, capture_output=True, text=True)
    if generated.returncode:
        errors.append(generated.stdout.strip() or generated.stderr.strip())

    if shutil.which("gh") is None:
        warnings.append("gh CLI unavailable: GitHub PR/workstream merge-state cross-check skipped")

    if errors:
        print("Operations Control validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        if warnings:
            print("Warnings:")
            print("\n".join(f"- {warning}" for warning in warnings))
        return 1
    print(f"Operations Control valid: {len(items)} items, {len(works_raw)} workstreams, {len(active)} active claims, origin/main={main_ref}.")
    if warnings:
        print("Warnings:")
        print("\n".join(f"- {warning}" for warning in warnings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
