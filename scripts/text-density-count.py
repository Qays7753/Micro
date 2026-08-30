#!/usr/bin/env python3
"""§10.1 text-density counter — distinct user-visible string literals rendered at rest.

MEASURES THE WHOLE SCREEN, not the file (2026-08-30 correction):

  screen = page unit
         + every in-project component it imports (and what those import, transitively)
         + presentation modules in that tree
         + the application-layer services that feed the screen
           (imported by the page or its components, or mapped explicitly
            when fed through the app context — e.g. Home)

Extraction therefore cannot change the number: moving a string from the page
into components/<screen>/ keeps it inside the same measured set. Extraction
remains allowed for code organization; it is never a density gain.

"At rest" per the design system: the screen as it loads and idles —
- strings inside collapsed <details> layers render only via their <summary>,
  so non-summary content inside <details> is NOT at rest;
- moment-of-action strings (validation errors, action feedback, loading labels)
  are NOT at rest;
- static JSX text nodes are not string literals and are not counted.

Counted per §10.1: distinct user-visible string literals rendered at rest,
in the page module and in the services that feed it.

Excluded from traversal (shared foundations, not part of any single screen):
app/ root context (instantiates every service for all screens), storage/
schemas, @micro-domain (shared domain package). Services under application/
contribute their strings but are not traversed further — a service importing
another service would otherwise pull the entire app into every screen.
"""
from __future__ import annotations

import re
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT_SRC = ROOT / "apps/prototype-web/client/src"
ARABIC = re.compile(r"[\u0600-\u06FF]")

MOMENT_LINE = re.compile(
    r"throw new Error|setMessage\(|setError\(|setNotice\(|setReversalError\(|message:|message =|aria-invalid"
    r"|failure\(|\bfail\(|\berr\(|invalid_input"
)
# Loading/progress labels on action buttons appear only while acting.
LOADING_LINE = re.compile(r"جارٍ|…")

STRING_LIT = re.compile(r'"([^"\\\n]*)"|' + r"'([^'\\\n]*)'")
TEMPLATE_LIT = re.compile(r"`([^`\\]*)`")

# import ... from "spec" / export ... from "spec" / import "spec"
IMPORT_SPEC = re.compile(r'(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["\']([^"\']+)["\']', re.S)
BARE_IMPORT = re.compile(r'(?:^|\n)\s*import\s*["\']([^"\']+)["\']')

# Screens fed through the app context rather than direct imports.
EXPLICIT_SERVICES: dict[str, list[str]] = {
    "Home": ["application/home/homeControlCenterService.ts"],
}

# §10.1 hard caps: Home 15, any single screen 30.
CAPS: dict[str, int] = {"Home": 15}

PAGES = [
    "Home",
    "Finance",
    "OrderDetail",
    "Orders",
    "DirectSaleEditor",
    "DraftEditor",
    "CostEditor",
    "AgreementEditor",
    "Catalog",
    "InventoryMaterials",
    "Suppliers",
    "Foundation",
    "Setup",
    "CashWallets",
    "OwnerEntitlement",
    "Schedule",
    "ScheduleEditor",
    "OwnerWithdrawalEditor",
    "G5DeclarationEditor",
    "Settings",
    "NotFound",
]


def strip_comments(source: str) -> str:
    """Remove // and /* */ comments while respecting string literals.

    Quoted strings inside comments ("لا نستخدم \"1 طلبات\"") are not rendered.
    """
    out: list[str] = []
    mode = "code"  # code | line | block | single | double | template
    i, n = 0, len(source)
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if mode == "code":
            if ch == "/" and nxt == "/":
                mode = "line"
                i += 2
                continue
            if ch == "/" and nxt == "*":
                mode = "block"
                i += 2
                continue
            if ch == '"':
                mode = "double"
            elif ch == "'":
                mode = "single"
            elif ch == "`":
                mode = "template"
            out.append(ch)
            i += 1
        elif mode == "line":
            if ch == "\n":
                mode = "code"
                out.append(ch)
            i += 1
        elif mode == "block":
            if ch == "*" and nxt == "/":
                mode = "code"
                i += 2
                continue
            i += 1
        elif mode in ("single", "double", "template"):
            if ch == "\\":
                out.append(ch)
                if i + 1 < n:
                    out.append(source[i + 1])
                i += 2
                continue
            if (mode == "single" and ch == "'") or (mode == "double" and ch == '"') or (
                mode == "template" and ch == "`"
            ):
                mode = "code"
            elif mode == "template" and ch == "$" and nxt == "{":
                # interpolation: hand off raw until matching brace
                out.append("${")
                i += 2
                depth = 1
                while i < n and depth:
                    c = source[i]
                    if c == "{":
                        depth += 1
                    elif c == "}":
                        depth -= 1
                    out.append(c)
                    i += 1
                continue
            out.append(ch)
            i += 1
    return "".join(out)


def strip_details_bodies(source: str) -> str:
    """Remove the non-summary content of <details> blocks (collapsed at rest)."""
    lines = source.splitlines(keepends=True)
    out: list[str] = []
    depth = 0  # details nesting depth
    for line in lines:
        if depth == 0:
            out.append(line)
            if "<details" in line:
                depth = 1
            continue
        # inside a details body: keep only summary lines and closing tags
        if "</details>" in line:
            depth -= 1
            if depth == 0:
                out.append(line)
            continue
        if "<details" in line:
            depth += 1
            continue
        if "<summary" in line or "</summary>" in line or "Summary" in line:
            out.append(line)
            continue
        # drop the body line entirely
    return "".join(out)


def strings_of(source: str) -> set[str]:
    found: set[str] = set()
    for line in source.splitlines():
        if MOMENT_LINE.search(line) or LOADING_LINE.search(line):
            continue
        for match in STRING_LIT.finditer(line):
            value = match.group(1) if match.group(1) is not None else match.group(2)
            if value is not None and ARABIC.search(value):
                found.add(value.strip())
    for match in TEMPLATE_LIT.finditer(source):
        value = match.group(1)
        if value and "${" not in value and ARABIC.search(value):
            found.add(value.strip())
    return found


def resolve_spec(spec: str, importer: Path) -> Path | None:
    """Resolve an import spec to a repo file, or None when external/skipped."""
    if spec.startswith("@micro-domain/"):
        return None  # shared domain package — not part of a single screen
    if spec.startswith("@/"):
        base = CLIENT_SRC / spec[2:]
    elif spec.startswith("."):
        base = (importer.parent / spec).resolve()
    else:
        return None  # external package (react, lucide-react, wouter, …)
    candidates = [base]
    if base.suffix not in (".ts", ".tsx"):
        candidates += [base.with_suffix(".ts"), base.with_suffix(".tsx")]
        candidates += [base / "index.ts", base / "index.tsx"]
    for candidate in candidates:
        if candidate.is_file() and ".test." not in candidate.name:
            return candidate
    return None


def import_specs(source: str) -> list[str]:
    return IMPORT_SPEC.findall(source) + BARE_IMPORT.findall(source)


def screen_files(page: Path) -> list[Path]:
    """Page + component/presentation closure + feeding application services."""
    files: dict[Path, str] = {page: "ui"}
    queue: deque[Path] = deque([page])
    while queue:
        module = queue.popleft()
        source = module.read_text(encoding="utf-8")
        for spec in import_specs(source):
            resolved = resolve_spec(spec, module)
            if resolved is None:
                continue
            rel = resolved.relative_to(CLIENT_SRC)
            parts = rel.parts
            if parts[0] in ("pages", "components", "presentation"):
                if resolved not in files:
                    files[resolved] = "ui"
                    queue.append(resolved)
            elif parts[0] == "application":
                # feeding service: counted, but not traversed further
                files.setdefault(resolved, "service")
            else:
                # app/ root, storage/ schemas — shared, not this screen
                continue
    return list(files)


def count_screen(name: str) -> set[str]:
    page = CLIENT_SRC / f"pages/{name}.tsx"
    strings: set[str] = set()
    if not page.is_file():
        return strings
    for module in screen_files(page):
        strings |= strings_of(strip_details_bodies(strip_comments(module.read_text(encoding="utf-8"))))
    for rel in EXPLICIT_SERVICES.get(name, []):
        service = CLIENT_SRC / rel
        if service.is_file():
            strings |= strings_of(strip_details_bodies(strip_comments(service.read_text(encoding="utf-8"))))
    return strings


def main(argv: list[str]) -> int:
    list_target = None
    breakdown = False
    args = [a for a in argv if a != "--breakdown"]
    if len(args) == 2 and args[0] == "--list":
        list_target = args[1]
    breakdown = "--breakdown" in argv

    failures = []
    for name in PAGES:
        page = CLIENT_SRC / f"pages/{name}.tsx"
        if not page.is_file():
            continue
        strings = count_screen(name)
        cap = CAPS.get(name, 30)
        status = "OK " if len(strings) <= cap else "OVER"
        print(f"{status} {name:24s} {len(strings):4d} distinct at-rest strings (cap {cap})")
        if list_target == name or (breakdown and len(strings) > cap):
            for value in sorted(strings):
                print(f"    - {value}")
        if len(strings) > cap:
            failures.append((name, len(strings), cap))
    if failures:
        print("\nOVER CAP (§10.1):")
        for name, count, cap in failures:
            print(f"  {name}: {count} > {cap}")
        return 1
    print("\nAll surfaces within §10 caps.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
