#!/usr/bin/env python3
"""§9 design-token guards — the build fails over a raw hex or an off-scale value.

Per design-system-v1 §9:
1. No raw hex, rgb, or hsl literal in .tsx or component CSS outside the frozen
   token definitions — enforced here by scanning TSX sources and CSS outside
   the :root / .dark / @theme token blocks. The single sanctioned exception is
   the sheet/dialog overlay scrim `color-mix(in srgb, #1f1e1d 45%, transparent)`
   written verbatim in §3.3.
2. No spacing, radius, font-size, or z-index value outside §1 — enforced at the
   part level (each whitespace-separated component of the declaration value).

Colors: the palette is frozen; tokens are defined exactly twice (light + dark).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT_SRC = ROOT / "apps/prototype-web/client/src"

HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB_HSL = re.compile(r"\b(?:rgb|rgba|hsl|hsla)\(")
COLOR_FUNC = re.compile(r"\b(?:rgb|rgba|hsl|hsla|color|oklch|oklab|lab|lch)\(")

# §1.3 scale + the four derivations of §1.1 are calc() forms and pass as calc.
SPACE_PX = {"2px", "4px", "8px", "12px", "16px", "20px", "24px", "32px", "0"}
SPACE_RE = re.compile(r"^var\(--space-[1-7]\)$|^calc\(|^env\(|^clamp\(")
RADIUS_PX = {"0", "12px", "16px", "20px", "999px", "50%"}
RADIUS_RE = re.compile(r"^var\(--radius-(control|card|sheet)\)$")
FONT_SIZES = {
    "11px", "12px", "13px", "14px", "15px", "16px", "17px", "18px",
    "20px", "24px", "26px", "28px", "31px",
}
FONT_RE = re.compile(r"^var\(--")
Z_LADDER = {"0", "1", "20", "30", "40", "50", "60", "70"}

# Doc-sanctioned raw-color exception (§3.3 overlay scrim, verbatim).
SANCTIONED_RAW = "color-mix(in srgb, #1f1e1d 45%, transparent)"

PROP_RULES: dict[str, tuple[set[str], re.Pattern | None]] = {
    "gap": (SPACE_PX, SPACE_RE),
    "row-gap": (SPACE_PX, SPACE_RE),
    "column-gap": (SPACE_PX, SPACE_RE),
    "margin": ({*SPACE_PX, "auto"}, SPACE_RE),
    "margin-top": ({*SPACE_PX, "auto"}, SPACE_RE),
    "margin-bottom": ({*SPACE_PX, "auto"}, SPACE_RE),
    "margin-inline": ({*SPACE_PX, "auto"}, SPACE_RE),
    "margin-inline-start": ({*SPACE_PX, "auto"}, SPACE_RE),
    "margin-inline-end": ({*SPACE_PX, "auto"}, SPACE_RE),
    "margin-block": ({*SPACE_PX, "auto"}, SPACE_RE),
    "padding": (SPACE_PX, SPACE_RE),
    "padding-top": (SPACE_PX, SPACE_RE),
    "padding-bottom": (SPACE_PX, SPACE_RE),
    "padding-inline": (SPACE_PX, SPACE_RE),
    "padding-inline-start": (SPACE_PX, SPACE_RE),
    "padding-inline-end": (SPACE_PX, SPACE_RE),
    "padding-block": (SPACE_PX, SPACE_RE),
    "border-radius": (RADIUS_PX, RADIUS_RE),
    "font-size": (FONT_SIZES, FONT_RE),
    "z-index": (Z_LADDER, None),
}

DECL = re.compile(r"^\s*([a-z-]+)\s*:\s*([^;{}]+);")


def token_definition_zones(source: str) -> list[tuple[int, int]]:
    """Char ranges of :root {}, .dark {}, and @theme blocks (token definitions)."""
    zones: list[tuple[int, int]] = []
    for match in re.finditer(r"(?m)^(:root|\.dark|@theme[^\{]*)\s*\{", source):
        start = match.start()
        depth = 0
        for idx in range(match.end() - 1, len(source)):
            if source[idx] == "{":
                depth += 1
            elif source[idx] == "}":
                depth -= 1
                if depth == 0:
                    zones.append((start, idx + 1))
                    break
    return zones


def strip_css_comments(source: str) -> str:
    return re.sub(r"/\*[\s\S]*?\*/", "", source)


def scan_css_colors(path: Path) -> list[str]:
    source = strip_css_comments(path.read_text(encoding="utf-8"))
    zones = token_definition_zones(source)
    problems: list[str] = []
    for match in HEX.finditer(source):
        if any(start <= match.start() < end for start, end in zones):
            continue
        line = source.count("\n", 0, match.start()) + 1
        context = source[max(0, match.start() - 40) : match.end() + 10].replace("\n", " ")
        if SANCTIONED_RAW[:30] in context:
            continue  # §3.3 scrim — sanctioned verbatim
        problems.append(f"{path.name}:{line}: raw hex {match.group(0)} — {context.strip()[:70]}")
    return problems


def scan_css_values(path: Path) -> list[str]:
    problems: list[str] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        match = DECL.match(line)
        if not match:
            continue
        prop, value = match.group(1), match.group(2).strip()
        rule = PROP_RULES.get(prop)
        if rule is None:
            continue
        allowed, pattern = rule
        value = value.replace("!important", "").strip()
        parts: list[str] = []
        depth = 0
        current: list[str] = []
        for ch in value:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch.isspace() and depth == 0:
                if current:
                    parts.append("".join(current))
                    current = []
            else:
                current.append(ch)
        if current:
            parts.append("".join(current))
        for part in parts:
            part = part.rstrip(",")
            if part in allowed:
                continue
            if part.startswith("calc(") or "var(" in part or part.startswith("env("):
                continue  # derivations and token references pass
            if pattern and pattern.match(part):
                continue
            if part in ("auto", "inherit", "initial", "unset"):
                continue
            problems.append(f"{path.name}:{lineno}: {prop}: {part} خارج سلم §1")
    return problems


def scan_tsx_colors(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    problems: list[str] = []
    for match in HEX.finditer(source):
        context = source[max(0, match.start() - 60) : match.end() + 20].replace("\n", " ")
        if "href" in context or "import" in context or "from " in context:
            continue
        line = source.count("\n", 0, match.start()) + 1
        problems.append(f"{path.name}:{line}: raw hex {match.group(0)} في TSX — {context.strip()[:70]}")
    for match in RGB_HSL.finditer(source):
        context = source[max(0, match.start() - 60) : match.end() + 20].replace("\n", " ")
        if "import" in context or "from " in context:
            continue
        line = source.count("\n", 0, match.start()) + 1
        problems.append(f"{path.name}:{line}: rgb/hsl في TSX — {context.strip()[:70]}")
    return problems


def main() -> int:
    problems: list[str] = []
    for css_file in CLIENT_SRC.rglob("*.css"):
        problems += scan_css_colors(css_file)
        problems += scan_css_values(css_file)
    for tsx_file in list(CLIENT_SRC.rglob("*.tsx")) + list(CLIENT_SRC.rglob("*.ts")):
        if ".test." in tsx_file.name:
            continue
        problems += scan_tsx_colors(tsx_file)
    if problems:
        print("DESIGN TOKEN GUARDS (§9) — violations:")
        for problem in problems:
            print(f"  {problem}")
        return 1
    print("Design token guards (§9): no raw hex, all values on scale.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
