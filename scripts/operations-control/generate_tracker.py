#!/usr/bin/env python3
"""Generate read-only views from Micro Operations Control JSON records."""

from __future__ import annotations

import argparse
import csv
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTROL = ROOT / "docs" / "operations" / "control"
GENERATED = CONTROL / "generated"

STATUS_ORDER = {
    "REOPENED": 0, "BLOCKED": 1, "IN_PROGRESS": 2, "CLAIMED": 3,
    "IN_REVIEW": 4, "MERGED_UNVERIFIED": 5, "READY": 6, "BACKLOG": 7,
    "REVIEW_REQUIRED": 8, "DEFERRED": 9, "VERIFIED": 10, "SUPERSEDED": 11,
}


def load(pattern: str) -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(CONTROL.glob(pattern))]


def table(items: list[dict]) -> str:
    rows = ["| ID | الحالة | الأولوية | المرحلة | العنوان | الاعتماديات |", "|---|---|---|---|---|---|"]
    for item in items:
        deps = ", ".join(item.get("dependencies", [])) or "—"
        rows.append(f"| {item['id']} | {item['status']} | {item['priority']} | {item['stage']} | {item['title']} | {deps} |")
    return "\n".join(rows)


def outputs() -> dict[Path, str]:
    items = sorted(load("items/*.json"), key=lambda x: (STATUS_ORDER[x["status"]], x["priority"], x["id"]))
    workstreams = load("workstreams/**/*.json")
    active = [w for w in workstreams if w["status"] in {"CLAIMED", "IN_PROGRESS", "IN_REVIEW", "BLOCKED"}]
    next_items = [i for i in items if i["status"] in {"READY", "REOPENED", "BLOCKED"}]

    counts: dict[str, int] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    summary = " · ".join(f"{k}: {counts[k]}" for k in sorted(counts, key=lambda k: STATUS_ORDER[k]))

    tracker = "# Master Tracker\n\n> مولّد آليًا. عدّل ملفات `items/*.json` فقط.\n\n" + summary + "\n\n" + table(items) + "\n"
    active_md = "# Active Work\n\n> مولّد آليًا من Workstream claims.\n\n"
    if active:
        active_md += "| ID | الحالة | الفرع | البنود | الخطوة التالية |\n|---|---|---|---|---|\n"
        for w in active:
            active_md += f"| {w['id']} | {w['status']} | `{w['branch']}` | {', '.join(w['items'])} | {w['next_action']} |\n"
    else:
        active_md += "لا يوجد Workstream نشط.\n"

    next_md = "# Next Actions\n\n> هذا ترتيب تشغيلي، وليس إذنًا بتجاوز قرار المالك أو الاعتماديات.\n\n" + table(next_items) + "\n"
    brief = f"""# Agent Brief

> مولّد آليًا. اقرأ `AGENTS.md` و`docs/operations/current-state.md` قبل استخدامه.

## الحالة

رأس `main` عند تأسيس السجل: `87ebcf2ffa74752bf385eff3a10962454b45d33e`  
الحصيلة: {summary}

## قبل أي تعديل

1. `git fetch origin && git switch main && git pull --ff-only origin main`.
2. شغّل `python3 scripts/operations-control/validate.py`.
3. افحص PRs المفتوحة و`generated/ACTIVE-WORK.md`.
4. ابحث عن ID والسبب الجذري في JSON والكود والاختبارات والـcommits.
5. أنشئ Claim منفصلًا، ولا تتداخل مع `areas` أو `contracts` النشطة.

## بوابة البرنامج

الـPilot `BLOCKED` حتى تصبح متطلبات `releases/pre-pilot.json` كلها `VERIFIED` ثم يصدر قرار مالك. UI/UX الجذري مؤجل حتى استقرار الوظائف والحدود.

## العمل النشط

{active_md.split(chr(10), 2)[-1]}
"""

    csv_buffer = io.StringIO(newline="")
    writer = csv.writer(csv_buffer, lineterminator="\n")
    writer.writerow(["ID", "Title", "Type", "Status", "Priority", "Stage", "Dependencies", "Owner decision", "Updated"])
    for i in items:
        writer.writerow([i["id"], i["title"], i["type"], i["status"], i["priority"], i["stage"], "; ".join(i.get("dependencies", [])), i.get("owner_decision", ""), i["updated_at"]])

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
    args = parser.parse_args()
    expected = outputs()
    stale = []
    for path, content in expected.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="")
    if stale:
        print("Stale generated control files:")
        print("\n".join(f"- {p}" for p in stale))
        return 1
    print("Operations Control views are current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
