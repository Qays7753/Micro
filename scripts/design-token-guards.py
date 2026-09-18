#!/usr/bin/env python3
"""§9 design-token guards — the build fails over a raw hex or an off-scale value.

Per design-system-v1 §9 (W1 amendment — Micro Standard v2 integration):
1. No raw hex, rgb, or hsl literal in .tsx or component CSS outside the frozen
   token definitions — enforced here by scanning TSX sources and CSS outside
   the :root / .dark / @theme token blocks. W1 removed the former §3.3 scrim
   exception: the overlay scrim is now the token --vf-scrim defined in
   styles/vf-tokens.css (Micro Standard v2 runtime mapping).
2. No spacing, radius, font-size, or z-index value outside §1 — enforced at the
   part level (each whitespace-separated component of the declaration value).

Colors: the palette is frozen; Standard --vf-* contracts live in
styles/vf-tokens.css; Micro runtime names mirror them in :root/.dark.

R3/W5 amendments (permanent Dark Mode, D1):
3. Retired values are banned from the ENTIRE runtime CSS (token zones
   included, comments stripped): the v0 identity palette (#CC785C, #964E33,
   #5F3120, #079FA0 teal) and the retired v0 dark set. They may never return.
4. Single source for dark: raw hex inside a .dark block is allowed ONLY in
   styles/theme-dark.css. index.css .dark blocks fail (the runtime layer binds
   through tokens, never raw values).
5. color-scheme is declared for native controls: :root (light) in index.css
   and .dark (dark) in theme-dark.css.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT_SRC = ROOT / "apps/prototype-web/client/src"
DARK_OWNER = "theme-dark.css"

HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB_HSL = re.compile(r"\b(?:rgb|rgba|hsl|hsla)\(")
COLOR_FUNC = re.compile(r"\b(?:rgb|rgba|hsl|hsla|color|oklch|oklab|lab|lch)\(")

# R3/W5: the retired palettes — banned everywhere in runtime CSS (lowercase).
RETIRED_VALUES = {
    # v0 identity (never again)
    "#cc785c", "#964e33", "#5f3120", "#079fa0",
    # retired v0 dark set
    "#1c1917", "#332d27", "#27231f", "#51473c", "#62564b", "#fff7ed",
    "#d6c9ba", "#d59172", "#8fd5d6", "#5ec0c1", "#7fc49e", "#e47975",
    "#e2c268",
}


# §1.3 scale + the four derivations of §1.1 are calc() forms and pass as calc.
SPACE_PX = {"2px", "4px", "8px", "12px", "16px", "20px", "24px", "32px", "0"}
SPACE_RE = re.compile(r"^var\(--space-[1-7]\)$|^calc\(|^env\(|^clamp\(")
RADIUS_PX = {"0", "12px", "16px", "20px", "999px", "50%"}
RADIUS_RE = re.compile(r"^var\(--radius-(control|card|sheet)\)$")
# Wave 4.4 — P-4.4-5 (2026-09-18): عائلة الخطوط تحولت إلى rem كي يتكبر نص
# المتصفح (WCAG 1.4.4 resize text) — نفس السلم بالضبط (NN/16) فالهوية البصرية
# عند الجذر الافتراضي 16px لا تتغير؛ الأهداف اللمسية والمسافات تبقى px عمدًا.
FONT_SIZES = {
    "0.6875rem", "0.75rem", "0.8125rem", "0.875rem",
    "0.9375rem", "1rem", "1.0625rem", "1.125rem",
    "1.25rem", "1.5rem", "1.625rem", "1.75rem", "1.9375rem",
}
FONT_RE = re.compile(r"^var\(--")
Z_LADDER = {"0", "1", "20", "30", "40", "50", "60", "70"}

# W1: no sanctioned raw-color exceptions remain — the scrim is tokenized
# (--vf-scrim in styles/vf-tokens.css).

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
    """Char ranges of :root{}, :root.dark{}, .dark{}, and @theme blocks (token
    definitions). :root.dark is the dark owner's specificity-robust selector."""
    zones: list[tuple[int, int]] = []
    for match in re.finditer(r"(?m)^(:root\.dark|:root|\.dark|@theme[^\{]*)\s*\{", source):
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
        # R3/W5 (3): retired values are banned everywhere, zones included.
        if match.group(0).lower() in RETIRED_VALUES:
            line = source.count("\n", 0, match.start()) + 1
            problems.append(f"{path.name}:{line}: retired value {match.group(0)} — banned from the runtime path")
            continue
        if any(start <= match.start() < end for start, end in zones):
            # R3/W5 (4): raw hex inside a dark zone only in the dark owner file;
            # inside a light :root zone only in vf-tokens.css/index.css.
            zone_src = next(
                (source[s:e] for s, e in zones if s <= match.start() < e), ""
            )
            zone_head = zone_src.lstrip()
            if zone_head.startswith((".dark", ":root.dark")):
                if path.name != DARK_OWNER:
                    line = source.count("\n", 0, match.start()) + 1
                    problems.append(
                        f"{path.name}:{line}: raw hex {match.group(0)} inside .dark outside {DARK_OWNER} — dark values have a single owner"
                    )
                continue
            if zone_head.startswith(":root") and path.name not in (
                "vf-tokens.css", "index.css"
            ):
                line = source.count("\n", 0, match.start()) + 1
                problems.append(
                    f"{path.name}:{line}: raw hex {match.group(0)} inside :root outside vf-tokens.css/index.css — light values have a single owner"
                )
            continue
        line = source.count("\n", 0, match.start()) + 1
        context = source[max(0, match.start() - 40) : match.end() + 10].replace("\n", " ")
        problems.append(f"{path.name}:{line}: raw hex {match.group(0)} — {context.strip()[:70]}")
    # W2 (completion — Agent 3, F6): literal color functions (rgb/hsl) are
    # checked in CSS as in TSX — outside token-definition zones only.

    for match in RGB_HSL.finditer(source):
        if any(start <= match.start() < end for start, end in zones):
            continue
        line = source.count("\n", 0, match.start()) + 1
        context = source[max(0, match.start() - 40) : match.end() + 10].replace("\n", " ")
        problems.append(f"{path.name}:{line}: rgb/hsl — {context.strip()[:70]}")
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


def scan_color_scheme() -> list[str]:
    """R3/W5 (5): color-scheme must be declared for native controls."""
    problems: list[str] = []
    index = (CLIENT_SRC / "index.css").read_text(encoding="utf-8")
    root_zone = parse_zone_body(index, ":root")
    if "color-scheme: light" not in root_zone:
        problems.append("index.css :root: missing `color-scheme: light` for native controls")
    dark = (CLIENT_SRC / "styles" / DARK_OWNER).read_text(encoding="utf-8")
    dark_zone = parse_zone_body(dark, ":root.dark")
    if "color-scheme: dark" not in dark_zone:
        problems.append(f"{DARK_OWNER} .dark: missing `color-scheme: dark` for native controls")
    return problems


def parse_zone_body(source: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{", source)
    if not match:
        return ""
    depth = 0
    for idx in range(match.end() - 1, len(source)):
        if source[idx] == "{":
            depth += 1
        elif source[idx] == "}":
            depth -= 1
            if depth == 0:
                return source[match.end() : idx]
    return ""


def main() -> int:
    problems: list[str] = []
    for css_file in CLIENT_SRC.rglob("*.css"):
        problems += scan_css_colors(css_file)
        problems += scan_css_values(css_file)
    problems += scan_color_scheme()
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
