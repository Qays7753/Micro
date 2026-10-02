/**
 * Wave 3A (ARCH-002 / WS-212 — STR-405): اختبارات وصف مباشرة لبوابة المظروف.
 *
 * الغرض: تثبيت السلوك الحالي لـ transferEnvelope.ts مباشرة (كانت تغطيتها
 * غير مباشرة عبر localTransferService فقط): بوابة الأزواج المقبولة/المرفوضة،
 * إكراه أنواع الأزواج (لا مطابقة نصية)، ومسارات التحقق من بصمة sha256
 * (الحاضرة الصحيحة، المعطوبة، الغائبة للزوج الحالي، الغائبة للقديم).
 *
 * هذه اختبارات وصف (characterization): تثبت ما هو عليه السلوك اليوم لا ما
 * «ينبغي» أن يكون — أي تغيير مقصود في البوابة يجعلها تفشل فيعاد النظر بوعي.
 * لا تغيير إنتاج هنا إطلاقًا.
 */
import { describe, expect, it } from "vitest";
import {
  RELEASED_LEGACY_EXPORT_PAIRS,
  isCurrentPair,
  isReleasedLegacyPair,
  verifyTransferIntegrity,
} from "./transferEnvelope";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";

const DATA = { profile: null, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [] };
const envelope = (version: number, schemaVersion: number, extra: Record<string, unknown> = {}) => ({
  format: "micro-prototype-local-export",
  version,
  schemaVersion,
  exportedAt: "2026-10-03T10:00:00.000Z",
  data: DATA,
  ...extra,
});

describe("pair gate (current + released legacy)", () => {
  it("accepts exactly the current pair 30/38 as current", () => {
    expect(isCurrentPair(envelope(localExportVersion, localSchemaVersion) as never)).toBe(true);
    expect(isCurrentPair(envelope(localExportVersion - 1, localSchemaVersion) as never)).toBe(false);
    expect(isCurrentPair(envelope(localExportVersion, localSchemaVersion - 1) as never)).toBe(false);
  });

  it("accepts every released legacy pair and only those", () => {
    for (const pair of RELEASED_LEGACY_EXPORT_PAIRS) {
      const [version, schemaVersion] = pair.split("/").map(Number);
      expect(isReleasedLegacyPair(envelope(version, schemaVersion) as never), pair).toBe(true);
    }
    /* أزواج صدرت مخططها ولم تصدر نسخة تصديرها — مرفوضة دائمًا. */
    for (const pair of ["8/16", "27/34", "26/35", "5/4", "99/99"]) {
      const [version, schemaVersion] = pair.split("/").map(Number);
      expect(isReleasedLegacyPair(envelope(version, schemaVersion) as never), pair).toBe(false);
    }
  });

  it("rejects string-coerced pair values — no textual matching against the released set", () => {
    expect(isReleasedLegacyPair(envelope("8" as never, 17) as never)).toBe(false);
    expect(isReleasedLegacyPair(envelope(8, "17" as never) as never)).toBe(false);
    expect(isCurrentPair(envelope("30" as never, 38) as never)).toBe(false);
  });
});

describe("integrity verification (sha256 envelope paths)", () => {
  it("accepts a current envelope with a correct digest", () => {
    const candidate = envelope(localExportVersion, localSchemaVersion, {
      integrity: { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(DATA)) },
    });
    expect(verifyTransferIntegrity(candidate as never, true)).toBeNull();
  });

  it("rejects a current envelope with a corrupted digest (before touching data)", () => {
    const candidate = envelope(localExportVersion, localSchemaVersion, {
      integrity: { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(DATA)).slice(0, -1) + "0" },
    });
    expect(verifyTransferIntegrity(candidate as never, true)).toContain("بصمة");
  });

  it("rejects a current envelope with no integrity block", () => {
    expect(
      verifyTransferIntegrity(envelope(localExportVersion, localSchemaVersion) as never, true),
    ).toContain("بصمة");
  });

  it("keeps the legacy path: an old envelope without integrity passes its legacy lane", () => {
    /* المظروف ظهر مع نسخة ٢٧ — الأقدم بلا بصمة مقبولة على مسارها الموروث. */
    expect(verifyTransferIntegrity(envelope(8, 17) as never, false)).toBeNull();
  });

  it("verifies a legacy envelope WITH a present-but-corrupt digest strictly", () => {
    const candidate = envelope(20, 28, {
      integrity: { algorithm: "sha256", digest: "0".repeat(64) },
    });
    expect(verifyTransferIntegrity(candidate as never, false)).toContain("بصمة");
  });
});
