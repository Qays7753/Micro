#!/usr/bin/env python3
"""Generate read-only views from Micro Operations Control JSON records."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTROL = ROOT / "docs" / "operations" / "control"
GENERATED = CONTROL / "generated"
XLSX = GENERATED / "MASTER-TRACKER.xlsx"
META = GENERATED / "MASTER-TRACKER.xlsx.meta.json"

STATUS_ORDER = {
    "REOPENED": 0, "BLOCKED": 1, "IN_PROGRESS": 2, "CLAIMED": 3,
    "IN_REVIEW": 4, "MERGED_UNVERIFIED": 5, "READY": 6, "BACKLOG": 7,
    "REVIEW_REQUIRED": 8, "DEFERRED": 9, "VERIFIED": 10, "SUPERSEDED": 11,
}
ACTIVE_WORK_STATUSES = {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "MERGED_UNVERIFIED", "BLOCKED", "REVIEW_REQUIRED", "REOPENED"}
NEXT_STATUSES = {"READY", "REOPENED", "BLOCKED", "DEFERRED", "REVIEW_REQUIRED"}


def load(pattern: str) -> list[dict]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted(CONTROL.glob(pattern))]


def md_cell(value: object) -> str:
    text = "" if value is None else str(value)
    return text.replace("\\", "\\\\").replace("|", "\\|").replace("\r\n", "<br>").replace("\n", "<br>").replace("`", "\\`")


def table(items: list[dict], *, include_action: bool = False) -> str:
    if include_action:
        rows = [
            "| ID | الحالة | الأولوية | المرحلة | العنوان | الخطوة التالية | السبب/البوابة | الاعتماديات |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for item in items:
            reason = item.get("blocked_reason") or item.get("deferred_reason") or item.get("owner_decision", "") or "—"
            rows.append("| " + " | ".join([
                md_cell(item["id"]), md_cell(item["status"]), md_cell(item["priority"]), md_cell(item["stage"]),
                md_cell(item["title"]), md_cell(item.get("next_action", "")), md_cell(reason),
                md_cell(", ".join(item.get("dependencies", [])) or "—"),
            ]) + " |")
    else:
        rows = ["| ID | الحالة | الأولوية | المرحلة | العنوان | الاعتماديات |", "|---|---|---|---|---|---|"]
        for item in items:
            rows.append("| " + " | ".join([
                md_cell(item["id"]), md_cell(item["status"]), md_cell(item["priority"]), md_cell(item["stage"]),
                md_cell(item["title"]), md_cell(", ".join(item.get("dependencies", [])) or "—"),
            ]) + " |")
    return "\n".join(rows)


def source_files() -> list[Path]:
    paths = list(CONTROL.glob("items/*.json")) + list(CONTROL.glob("workstreams/**/*.json"))
    paths += [CONTROL / "reports" / "index.json", CONTROL / "releases" / "pre-pilot.json"]
    return sorted(path for path in paths if path.exists())


def source_digest() -> tuple[str, list[str]]:
    digest = hashlib.sha256()
    relative_paths: list[str] = []
    for path in source_files():
        relative = path.relative_to(ROOT).as_posix()
        relative_paths.append(relative)
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest(), relative_paths


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def metadata() -> dict:
    source_hash, files = source_digest()
    return {
        "schema": "micro-operations-control-excel-provenance-v1",
        "source_digest": source_hash,
        "source_files": files,
        "workbook_path": str(XLSX.relative_to(ROOT)),
        "workbook_sha256": sha256(XLSX) if XLSX.exists() else "",
        "generated_by": "reviewed Excel view update + scripts/operations-control/generate_tracker.py --refresh-excel-meta",
        "generated_at": date.today().isoformat(),
        "read_only_view": True,
        "json_is_source_of_truth": True,
    }


def check_metadata() -> list[str]:
    errors: list[str] = []
    if not META.exists():
        return [str(META.relative_to(ROOT))]
    try:
        stored = json.loads(META.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"{META.relative_to(ROOT)}: invalid JSON: {exc}"]
    expected_hash, expected_files = source_digest()
    if stored.get("source_digest") != expected_hash:
        errors.append(f"{META.relative_to(ROOT)}: source digest is stale")
    if stored.get("source_files") != expected_files:
        errors.append(f"{META.relative_to(ROOT)}: source file list is stale")
    if not XLSX.exists():
        errors.append(f"{XLSX.relative_to(ROOT)}: workbook missing")
    elif stored.get("workbook_sha256") != sha256(XLSX):
        errors.append(f"{META.relative_to(ROOT)}: workbook SHA-256 is stale")
    if stored.get("json_is_source_of_truth") is not True or stored.get("read_only_view") is not True:
        errors.append(f"{META.relative_to(ROOT)}: provenance flags are invalid")
    return errors


def outputs() -> dict[Path, str]:
    items = sorted(load("items/*.json"), key=lambda x: (STATUS_ORDER[x["status"]], x["priority"], x["id"]))
    workstreams = load("workstreams/**/*.json")
    active = [w for w in workstreams if w["status"] in ACTIVE_WORK_STATUSES]
    next_items = [i for i in items if i["status"] in NEXT_STATUSES]

    counts: dict[str, int] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    summary = " · ".join(f"{k}: {counts[k]}" for k in sorted(counts, key=lambda k: STATUS_ORDER[k]))

    tracker = "# Master Tracker\n\n> مولّد آليًا من JSON. عدّل ملفات `items/*.json` و`workstreams/**/*.json` فقط.\n\n" + summary + "\n\n" + table(items) + "\n"
    active_md = "# Active Work\n\n> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.\n\n"
    if active:
        active_md += "| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |\n|---|---|---|---|---|---|\n"
        for work in sorted(active, key=lambda x: x["id"]):
            active_md += "| " + " | ".join([
                md_cell(work["id"]), md_cell(work["status"]), md_cell(f"`{work['branch']}`"),
                md_cell(work.get("pr") or "—"), md_cell(", ".join(work["items"])), md_cell(work["next_action"]),
            ]) + " |\n"
    else:
        active_md += "لا يوجد Workstream نشط أو يحتاج مراجعة.\n"

    next_md = "# Next Actions\n\n> مولّد آليًا من JSON. هذا ترتيب تشغيلي، وليس إذنًا بتجاوز قرار المالك أو الاعتماديات.\n\n" + table(next_items, include_action=True) + "\n"
    brief = f"""# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

هذه اللقطة لا تثبت رأس `main`. ثبّت الرأس الحالي قبل الاعتماد عليها:

```bash
git fetch origin --prune
git rev-parse origin/main
python3 scripts/operations-control/validate.py
```

الحصيلة: {summary}

## قبل أي تعديل

1. `git fetch origin && git switch main && git pull --ff-only origin main`.
2. شغّل `python3 scripts/operations-control/validate.py`؛ يفشل إذا تعذر إثبات Git أو كانت Views/Excel قديمة.
3. افحص PRs المفتوحة و`generated/ACTIVE-WORK.md`.
4. ابحث عن ID والسبب الجذري في JSON والكود والاختبارات والـcommits.
5. أنشئ Claim منفصلًا، ولا تتداخل مع `areas` أو `contracts` النشطة، بما في ذلك تداخل الأب/الابن.

## بوابة البرنامج

الـPilot `BLOCKED` حتى تصبح متطلبات `releases/pre-pilot.json` كلها `VERIFIED` ثم يصدر قرار مالك. UI/UX الجذري والتوسعات المستقبلية مؤجلة ولا تصبح `READY` تلقائيًا.

## العمل النشط أو المحتاج مراجعة

{active_md.split(chr(10), 2)[-1]}
"""

    csv_buffer = io.StringIO(newline="")
    writer = csv.writer(csv_buffer, lineterminator="\n")
    writer.writerow(["ID", "Title", "Type", "Status", "Priority", "Stage", "Dependencies", "Owner decision", "Next action", "Blocked/Deferred reason", "Source", "Updated"])
    for item in items:
        writer.writerow([
            item["id"], item["title"], item["type"], item["status"], item["priority"], item["stage"],
            "; ".join(item.get("dependencies", [])), item.get("owner_decision", ""), item.get("next_action", ""),
            item.get("blocked_reason") or item.get("deferred_reason", ""), item.get("source", {}).get("report", ""), item["updated_at"],
        ])

    return {
        GENERATED / "MASTER-TRACKER.md": tracker,
        GENERATED / "MASTER-TRACKER.csv": csv_buffer.getvalue(),
        GENERATED / "AGENT-BRIEF.md": brief,
        GENERATED / "ACTIVE-WORK.md": active_md,
        GENERATED / "NEXT-ACTIONS.md": next_md,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--refresh-excel-meta", action="store_true")
    args = parser.parse_args()
    expected = outputs()
    stale: list[str] = []
    for path, content in expected.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path.relative_to(ROOT)))
        elif not args.refresh_excel_meta:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="")
    if args.refresh_excel_meta:
        if not XLSX.exists():
            print(f"Missing workbook: {XLSX.relative_to(ROOT)}")
            return 1
        META.write_text(json.dumps(metadata(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Excel provenance refreshed: {META.relative_to(ROOT)}")
        return 0
    if args.check:
        stale.extend(check_metadata())
    if stale:
        print("Stale generated control files:")
        print("\n".join(f"- {path}" for path in stale))
        return 1
    print("Operations Control views are current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
