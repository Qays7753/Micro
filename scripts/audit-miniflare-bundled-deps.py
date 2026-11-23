#!/usr/bin/env python3
"""Manual evidence tool (2026-11-12, zod/miniflare-4 owner verification):
extract every package@version pair bundled INSIDE the installed miniflare dist
(from its source maps) and check each against the npm bulk advisory endpoint —
the same data source pnpm audit uses. Bundled copies are invisible to pnpm
audit BY CONSTRUCTION (no dependency edge), so this is the only way to answer
"is the advisory genuinely resolved, or merely hidden by bundling?" for the
miniflare upgrade.

NOT a CI gate: network-dependent, manual, documented in
docs/quality/security-exceptions.md §4. Re-run it whenever miniflare is
bumped or a new advisory lands on its bundled set.

Usage: python3 scripts/audit-miniflare-bundled-deps.py [--miniflare <version>]
Exit: 0 = no advisory affects any bundled copy; 1 = at least one does
      (print the list); 2 = usage/IO error.
"""
import glob
import json
import re
import sys
import urllib.request

PKG_RE = re.compile(r"node_modules/\.pnpm/([A-Za-z0-9@._+-]+)@(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)")
BULK_URL = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk"


def main() -> int:
    wanted = None
    if "--miniflare" in sys.argv:
        wanted = sys.argv[sys.argv.index("--miniflare") + 1]
    roots = sorted(glob.glob("node_modules/.pnpm/miniflare@*/node_modules/miniflare"))
    if not roots:
        print("audit-miniflare-bundled-deps: no installed miniflare found under node_modules/.pnpm", file=sys.stderr)
        return 2
    pairs = {}
    for root in roots:
        version = re.search(r"miniflare@([^/]+)/", root).group(1)
        if wanted is not None and version != wanted:
            continue
        for mapfile in glob.glob(f"{root}/dist/**/*.map", recursive=True):
            try:
                with open(mapfile, "r", encoding="utf-8", errors="replace") as handle:
                    data = json.load(handle)
            except (OSError, ValueError):
                continue
            for src in data.get("sources", []):
                for match in PKG_RE.finditer(src):
                    pairs.setdefault((match.group(1), match.group(2)), set()).add(version)
    if not pairs:
        print("audit-miniflare-bundled-deps: no sourcemap-bundled packages found", file=sys.stderr)
        return 2
    print(f"unique bundled package@version pairs: {len(pairs)}")
    by_pkg = {}
    for (name, version) in pairs:
        by_pkg.setdefault(name, []).append(version)
    request = urllib.request.Request(
        BULK_URL,
        data=json.dumps(by_pkg).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        advisories = json.load(response)
    if not advisories:
        print("NO advisories affect any bundled package@version copy")
        return 0
    affected = 0
    for pkg, advs in advisories.items():
        for adv in advs:
            affected += 1
            print(
                f"  {pkg} {by_pkg[pkg]}: {adv.get('title')} | severity={adv.get('severity')} "
                f"| vulnerable={adv.get('vulnerable_versions')}"
            )
    print(f"advisories affecting bundled copies: {affected}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
