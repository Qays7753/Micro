/**
 * Phase E RTL rendered-UI review measurement — one eval expression for the
 * agent-browser CLI. Measures: dir/lang, horizontal overflow, touch targets
 * (min side < 32px), and Arabic font loading on the LIVE rendered page.
 */
const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const overflow = document.documentElement.scrollWidth - vw;
  const doc = document.documentElement;
  const dirOk = doc.getAttribute('dir') === 'rtl';
  const langOk = doc.getAttribute('lang') === 'ar';
  const targets = Array.from(document.querySelectorAll('button, a[href], input, select, [role="menuitem"]'));
  let small = 0;
  const smallSamples = [];
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (Math.min(r.width, r.height) < 32) {
      small += 1;
      if (smallSamples.length < 4) smallSamples.push(el.textContent.trim().slice(0, 24) + ' [' + Math.round(r.width) + 'x' + Math.round(r.height) + ']');
    }
  }
  const fonts = {
    alexandria: document.fonts.check('16px Alexandria'),
    plex: document.fonts.check('16px "IBM Plex Sans Arabic"'),
  };
  const h1 = (document.querySelector('h1') || {}).textContent || '';
  const notices = Array.from(document.querySelectorAll('[role="alert"], [role="status"]')).map(n => (n.textContent || '').trim().slice(0, 40));
  return JSON.stringify({ vw, overflow, dirOk, langOk, targets: targets.length, small, smallSamples, fonts, h1: h1.slice(0, 40), notices: notices.slice(0, 3) });
})()`;

const routes = process.argv[2] ? process.argv[2].split(",") : ["/", "/market", "/delivery", "/driver", "/ask"];
const widths = process.argv[3] ? process.argv[3].split(",").map(Number) : [360, 390, 430];
const base = "http://127.0.0.1:8787";

import { execFileSync } from "node:child_process";

for (const width of widths) {
  execFileSync("agent-browser", ["set", "viewport", String(width), "740"], { stdio: "pipe" });
  for (const route of routes) {
    execFileSync("agent-browser", ["open", base + route], { stdio: "pipe" });
    execFileSync("agent-browser", ["wait", "--load", "networkidle"], { stdio: "pipe" });
    execFileSync("agent-browser", ["wait", "400"], { stdio: "pipe" });
    const out = execFileSync("agent-browser", ["eval", MEASURE], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    let m;
    try {
      const once = JSON.parse(out.trim()); // the CLI returns a JSON-encoded string
      m = typeof once === "string" ? JSON.parse(once) : once;
    } catch {
      try {
        m = JSON.parse(out.replace(/^[^\{]*/, "").replace(/\}\s*$/, "}") || "{}");
      } catch {
        m = { parseError: out.slice(0, 200) };
      }
    }
    const status = m.parseError
      ? "PARSE_ERROR"
      : `${m.dirOk && m.langOk ? "rtl-ok" : "DIR/LANG-FAIL"} | overflow=${m.overflow}px | targets=${m.targets} small<32px=${m.small} | fonts=${m.fonts?.alexandria ? "A" : "-"}${m.fonts?.plex ? "P" : "-"} | h1="${m.h1}"`;
    console.log(`[${width}px] ${route} :: ${status}`);
    if (m.smallSamples && m.smallSamples.length > 0) console.log(`    small targets: ${m.smallSamples.join(" | ")}`);
  }
}
