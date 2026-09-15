#!/usr/bin/env python3
"""R3/W5 (D5) — mechanical Light/Dark contrast floor guard.

Reads the REAL token files (styles/vf-tokens.css for :root light values,
styles/theme-dark.css for .dark values) and asserts the WCAG floors the
Dark Mode boundary requires:

  - text ink on its surfaces: >= 4.5:1
  - non-text marks (identity, focus, interactive borders, semantic marks
    when used as marks): >= 3:1
  - focus ring visible against canvas in both themes

The approved Light palette is NOT modified by this guard — it is verified
to keep passing. Dark values must pass the same floors. Any failure fails
the build (wired into `pnpm design-guards`).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / "apps/prototype-web/client/src"
LIGHT_CSS = CLIENT / "styles/vf-tokens.css"
DARK_CSS = CLIENT / "styles/theme-dark.css"
INDEX_CSS = CLIENT / "index.css"


def srgb_to_linear(channel: float) -> float:
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return (
        0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)
    )


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def parse_zone(path: Path, selector: str) -> dict[str, str]:
    """Parse `selector { --name: value; }` declarations (first match)."""
    source = path.read_text(encoding="utf-8")
    match = re.search(re.escape(selector) + r"\s*\{", source)
    if not match:
        return {}
    depth = 0
    end = None
    for idx in range(match.end() - 1, len(source)):
        if source[idx] == "{":
            depth += 1
        elif source[idx] == "}":
            depth -= 1
            if depth == 0:
                end = idx
                break
    body = source[match.end() : end]
    out: dict[str, str] = {}
    for decl in re.finditer(r"(--[\w-]+)\s*:\s*([^;]+);", body):
        out[decl.group(1)] = decl.group(2).strip()
    return out


def resolve(tokens: dict[str, str], value: str, seen: set[str] | None = None) -> str:
    """Resolve var() chains and rgba() to a hex or rgba literal."""
    seen = seen or set()
    value = value.strip()
    m = re.fullmatch(r"var\((--[\w-]+)\)", value)
    if m:
        name = m.group(1)
        if name in seen or name not in tokens:
            return value
        return resolve(tokens, tokens[name], seen | {name})
    return value


def hex_or_none(value: str) -> str | None:
    m = re.search(r"#[0-9a-fA-F]{6}\b", value)
    return m.group(0) if m else None


# --- token sources -----------------------------------------------------------
light = parse_zone(LIGHT_CSS, ":root")
dark = parse_zone(DARK_CSS, ":root.dark")
# Micro-owned pairs live in index.css :root (light) and .dark (dark)
index_light = parse_zone(INDEX_CSS, ":root")
index_dark = parse_zone(INDEX_CSS, ":root.dark")


def build(theme: str) -> dict[str, str]:
    tokens: dict[str, str] = {}
    if theme == "light":
        tokens.update(light)
        tokens.update(index_light)
    else:
        # dark = light defaults overlaid with the .dark rebindings
        tokens.update(light)
        tokens.update(index_light)
        tokens.update(dark)
        tokens.update(index_dark)
    return tokens


def color(tokens: dict[str, str], name: str) -> str | None:
    return hex_or_none(resolve(tokens, f"var({name})"))


# --- the pair matrix (role, ink token, surface token, floor) -----------------
TEXT_PAIRS: list[tuple[str, str, str]] = [
    ("primary ink on canvas", "--vf-ink", "--vf-canvas"),
    ("primary ink on surface", "--vf-ink", "--vf-surface"),
    ("primary ink on ground", "--vf-ink", "--vf-ground"),
    ("primary ink on recessed", "--vf-ink", "--vf-recessed"),
    ("primary ink on tint", "--vf-ink", "--vf-tint"),
    ("secondary ink on canvas", "--vf-ink-secondary", "--vf-canvas"),
    ("secondary ink on surface", "--vf-ink-secondary", "--vf-surface"),
    ("secondary ink on tint", "--vf-ink-secondary", "--vf-tint"),
    ("tertiary ink on canvas", "--vf-ink-tertiary", "--vf-canvas"),
    ("tertiary ink on surface", "--vf-ink-tertiary", "--vf-surface"),
    ("success text on success bg", "--color-success-text", "--color-success-bg"),
    ("success text on canvas", "--color-success-text", "--vf-canvas"),
    ("danger text on danger bg", "--color-danger-text", "--color-danger-bg"),
    ("danger text on canvas", "--color-danger-text", "--vf-canvas"),
    ("warning text on warning bg", "--color-warning-text", "--color-warning-bg"),
    ("warning text on canvas", "--color-warning-text", "--vf-canvas"),
    ("error ink on canvas", "--vf-error", "--vf-canvas"),
    ("error ink on surface", "--vf-error", "--vf-surface"),
    ("create ink on create bg", "--vf-action-create-ink", "--vf-action-create"),
    ("save ink on save bg", "--vf-action-save-ink", "--vf-action-save-bg"),
    ("commit ink on commit bg", "--vf-action-commit-ink", "--vf-action-commit-bg"),
    ("secondary btn ink on tint", "--vf-btn-secondary-ink", "--vf-btn-secondary-bg"),
    ("outline btn ink on surface", "--vf-btn-outline-ink", "--vf-btn-outline-bg"),
    ("ink on canvas (Micro alias)", "--color-text-primary", "--color-bg-canvas"),
    ("accent text on canvas", "--color-accent-text", "--color-bg-canvas"),
]

MARK_PAIRS: list[tuple[str, str, str]] = [
    # The icon-only create ink is a non-text mark on the clay fill (the
    # text-bearing create ink is the 4.5 pair above).
    ("create icon ink (non-text) on create bg", "--vf-action-create-icon-ink", "--vf-action-create"),
    # Clay appears ONLY as an elevated filled component (FAB/create buttons —
    # its boundary is elevation + internal ink) or as the interactive edge.
    # The chosen-edge role is what carries the 3:1 duty on flat surfaces:
    ("clay-interactive on canvas", "--vf-clay-interactive", "--vf-canvas"),
    ("clay-interactive on surface", "--vf-clay-interactive", "--vf-surface"),
    ("clay-interactive on tint", "--vf-clay-interactive", "--vf-tint"),
    ("info mark on canvas", "--vf-info", "--vf-canvas"),
    ("info mark on surface", "--vf-info", "--vf-surface"),
    ("status mark on canvas", "--vf-status", "--vf-canvas"),
    ("status mark on surface", "--vf-status", "--vf-surface"),
    ("success mark on canvas", "--vf-success", "--vf-canvas"),
    ("success mark on surface", "--vf-success", "--vf-surface"),
    ("error mark on canvas", "--vf-error", "--vf-canvas"),
    ("focus ring on canvas", "--vf-focus", "--vf-canvas"),
    ("focus ring on surface", "--vf-focus", "--vf-surface"),
    ("interactive border on canvas", "--vf-border-interactive", "--vf-canvas"),
    ("interactive border on surface", "--vf-border-interactive", "--vf-surface"),
    ("pressed edge on save bg", "--vf-action-save-pressed-edge", "--vf-action-save-bg"),
]

FLOOR_TEXT = 4.5
FLOOR_MARK = 3.0


def main() -> int:
    problems: list[str] = []
    checked = 0
    for theme in ("light", "dark"):
        tokens = build(theme)
        for label, ink_name, surface_name in TEXT_PAIRS:
            ink, surface = color(tokens, ink_name), color(tokens, surface_name)
            if ink is None or surface is None:
                problems.append(f"[{theme}] {label}: unresolved token ({ink_name}={ink}, {surface_name}={surface})")
                continue
            checked += 1
            ratio = contrast(ink, surface)
            if ratio < FLOOR_TEXT:
                problems.append(
                    f"[{theme}] {label}: {ratio:.2f}:1 < {FLOOR_TEXT}:1 ({ink} on {surface})"
                )
        for label, ink_name, surface_name in MARK_PAIRS:
            ink, surface = color(tokens, ink_name), color(tokens, surface_name)
            if ink is None or surface is None:
                problems.append(f"[{theme}] {label}: unresolved token")
                continue
            checked += 1
            ratio = contrast(ink, surface)
            if ratio < FLOOR_MARK:
                problems.append(
                    f"[{theme}] {label}: {ratio:.2f}:1 < {FLOOR_MARK}:1 ({ink} on {surface})"
                )
    if problems:
        print("THEME CONTRAST GUARD (D5) — violations:")
        for problem in problems:
            print(f"  {problem}")
        return 1
    print(f"Theme contrast guard (D5): {checked} pairs pass — text >= {FLOOR_TEXT}:1, marks >= {FLOOR_MARK}:1 in both themes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
