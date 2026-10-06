/**
 * الخطوة ٢ (برنامج تصحيح ما بعد المسح لPR #316 — 2026-10-06): اختبارات
 * الانحدار لخطوة تدقيق CI المستخرجة إلى scripts/ci-audit-step.sh.
 *
 * العيب الأصلي (D8-a): `code=$?` بعد جملة if كاذبة كان يلتقط خرج الجملة (0)
 * لا خرج أمر التدقيق — فتنجح الخطوة رغم فشل التدقيق. هذه الاختبارات تثبت
 * الإصلاح من الجهات الثلاث:
 *  1) فشل التدقيق يخرج غير صفري (ويرث رقم الخرج الأصلي حرفيًا)؛
 *  2) نجاح التدقيق يخرج صفرًا من المحاولة الأولى؛
 *  3) إعادة المحاولة تعمل (فشل ثم نجاح = نجاح في المحاولة الثانية)؛
 *  4) المسار الدفاعي: ماكس محاولات صفر لا ينجح أبدًا (خرج 1 دفاعي).
 * حتمية بلا شبكة وبلا نوم حقيقي (CI_AUDIT_RETRY_SLEEP=0 وأوامر كعب).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(/ci-audit-step\.test\.mjs$/, "ci-audit-step.sh");

function runStep(args, env = {}) {
  return spawnSync("bash", [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      CI_AUDIT_RETRY_SLEEP: "0",
      ...env,
    },
  });
}

describe("ci-audit-step (fixed exit-code propagation)", () => {
  it("propagates the audit's non-zero exit code verbatim when every attempt fails", () => {
    const result = runStep(["bash", "-c", "exit 7"], { CI_AUDIT_MAX_ATTEMPTS: "2" });
    expect(result.status).toBe(7);
    expect(result.stdout).toContain("audit attempt 1 failed (exit 7)");
    expect(result.stdout).toContain("audit attempt 2 failed (exit 7)");
    expect(result.stdout).toContain("::error::dependency audit failed 2 times (last exit 7)");
  });

  it("exits 0 on the first attempt when the audit passes", () => {
    const result = runStep(["bash", "-c", "exit 0"], { CI_AUDIT_MAX_ATTEMPTS: "3" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("audit passed on attempt 1");
    expect(result.stdout).not.toContain("attempt 1 failed");
  });

  it("retries a transient failure and passes on the second attempt", () => {
    const state = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ci-audit-")), "count");
    fs.writeFileSync(state, "0", "utf8");
    const stub = [
      "bash",
      "-c",
      `n=$(cat ${JSON.stringify(state)}); n=$((n+1)); echo $n > ${JSON.stringify(state)}; [ "$n" -ge 2 ]`,
    ];
    const result = runStep(stub, { CI_AUDIT_MAX_ATTEMPTS: "3" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("audit attempt 1 failed");
    expect(result.stdout).toContain("audit passed on attempt 2");
    fs.rmSync(path.dirname(state), { recursive: true, force: true });
  });

  it("can never succeed through loop fall-through (defensive exit, MAX_ATTEMPTS=0)", () => {
    const result = runStep(["bash", "-c", "exit 0"], { CI_AUDIT_MAX_ATTEMPTS: "0" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("defensive failure");
  });

  it("the default audit command is the register-aware checker (ci.yml wiring pin)", () => {
    const script = fs.readFileSync(SCRIPT_PATH, "utf8");
    expect(script).toContain("ci-audit-check.mjs");
  });
});
