/**
 * F-028/NF-021 (R10-B5 — 2026-10-13): الاختبار التوافقي لمعجم مؤشرات CI —
 * يفرز آليًا أن حارس الراتشة (ciMarkerPresent) وحارس الأسطح
 * (detectEnvironment) يتفقان على نفس المفردات إلى الأبد:
 *  - كل بيئة يراها حارس الأسطح «local» يجب أن يراها حارس الراتشة خالية من
 *    مؤشرات CI؛ والعكس صحيح.
 *  - كل بيئة يراها حارس الأسطح غير موثقة (null) أو بهوية CI موثوقة يجب أن
 *    يراها حارس الراتشة «CI حاضرة» (فشل مغلق لا تحذير محلي).
 * هذا هو إغلاق الانفصال الأصلي: CI='1' كانت «محليًا» عند الراتشة و«مجهولة»
 * عند الأسطح. حتمي بلا شبكة ولا نوم؛ مصفوفة البيئات محلية خالصة.
 */
import { describe, expect, it } from "vitest";
import { CI_MARKER_KEYS, ciMarkerPresent } from "./check-file-size-ratchet.mjs";
import { CI_MARKER_KEYS as SURFACES_KEYS, detectEnvironment } from "../apps/prototype-web/scripts/check-bundle-surfaces.mjs";

/* مصفوفة البيئات — كل حالة واقعية أو عدائية معروفة، بلا افتراضات بيئة
 * التشغيل نفسها (الاختبار يمرر كائنات env صريحة لا process.env). */
const ENV_MATRIX = [
  { name: "empty", env: {} },
  { name: "CI=true", env: { CI: "true" } },
  { name: "CI=1 (the original disagreement)", env: { CI: "1" } },
  { name: "CI=false (conscious opt-out)", env: { CI: "false" } },
  { name: "CI=empty string", env: { CI: "" } },
  { name: "GITHUB_ACTIONS=true", env: { GITHUB_ACTIONS: "true" } },
  { name: "GITHUB_ACTIONS=false", env: { GITHUB_ACTIONS: "false" } },
  { name: "GITHUB_ACTIONS=weird (untrusted value)", env: { GITHUB_ACTIONS: "weird" } },
  { name: "CF_PAGES=1", env: { CF_PAGES: "1" } },
  { name: "CF_PAGES=0 (non-standard but non-false)", env: { CF_PAGES: "0" } },
  { name: "CF_PAGES_COMMIT_SHA set", env: { CF_PAGES_COMMIT_SHA: "abc123" } },
  { name: "GITLAB_CI=true", env: { GITLAB_CI: "true" } },
  { name: "JENKINS_URL set", env: { JENKINS_URL: "https://ci.example.internal" } },
  { name: "TEAMCITY_VERSION set", env: { TEAMCITY_VERSION: "2024.1" } },
  { name: "unrelated vars only", env: { NODE_ENV: "test", FORCE_COLOR: "1" } },
];

describe("CI marker vocabulary conformance (ratchet <-> bundle-surfaces)", () => {
  it("both guards declare the identical marker key set", () => {
    expect([...CI_MARKER_KEYS].sort()).toEqual([...SURFACES_KEYS].sort());
  });

  it("local ⟺ no CI marker, for every environment in the matrix", () => {
    for (const { name, env } of ENV_MATRIX) {
      expect(detectEnvironment(env) === "local", name).toBe(!ciMarkerPresent(env));
    }
  });

  it("any non-local verdict (null or a CI identity) implies a CI marker is present", () => {
    for (const { name, env } of ENV_MATRIX) {
      const identity = detectEnvironment(env);
      if (identity !== "local") expect(ciMarkerPresent(env), name).toBe(true);
    }
  });

  it("CI='1' specifically: unknown to surfaces (fail-closed) and CI-present to the ratchet", () => {
    expect(detectEnvironment({ CI: "1" })).toBeNull();
    expect(ciMarkerPresent({ CI: "1" })).toBe(true);
  });

  it("explicit 'false' values are a conscious opt-out, not markers (both guards)", () => {
    for (const key of CI_MARKER_KEYS) {
      expect(ciMarkerPresent({ [key]: "false" }), key).toBe(false);
      expect(detectEnvironment({ [key]: "false" }), key).toBe("local");
    }
  });
});
