import { describe, expect, it } from "vitest";
import { createSavedParty, normalizePartyLabel, renameSavedParty, setSavedPartyArchive } from "./policies.js";
import type { SavedParty } from "./types.js";

/* S05 (DOC-014 / UNIT-037 B1/A6): سياسات دورة حياة الطرف المحفوظ — الشكل
 * الصادق للسجل عند الإنشاء/التعديل/الأرشفة، ولا دمج بالاسم ولا هاتف مفروض. */

const now = "2026-10-29T09:00:00.000Z";

const baseParty: SavedParty = {
  id: "party-1",
  label: "محمد — محل الزهور",
  phone: null,
  note: null,
  archivedAt: null,
  operationKey: "op-create-1",
  createdAt: now,
  updatedAt: now,
};

describe("createSavedParty (UNIT-037 A1/B1)", () => {
  it("saves an explicit party with a descriptive label and no forced phone", () => {
    const party = createSavedParty({
      id: "party-1",
      label: "  محمد — محل الزهور ",
      phone: null,
      note: null,
      operationKey: "op-create-1",
      recordedAt: now,
    });
    expect(party.label).toBe("محمد — محل الزهور");
    expect(party.phone).toBeNull();
    expect(party.archivedAt).toBeNull();
    expect(party.createdAt).toBe(now);
  });

  it("rejects an empty or whitespace-only label — no fake identity", () => {
    expect(() => createSavedParty({ id: "p", label: "   ", operationKey: "k", recordedAt: now })).toThrow(
      "اكتب اسمًا أو وصفًا يعرّف الطرف قبل حفظه.",
    );
  });

  it("keeps an optional phone as display-only data — blank normalizes to null", () => {
    const party = createSavedParty({
      id: "party-2",
      label: "أم أحمد",
      phone: "  ",
      note: "الجارة",
      operationKey: "op-create-2",
      recordedAt: now,
    });
    expect(party.phone).toBeNull();
    expect(party.note).toBe("الجارة");
  });

  it("normalizes label whitespace without merging identities — same text stays one label, distinct ids stay distinct", () => {
    expect(normalizePartyLabel("  خالد   العمري ")).toBe("خالد العمري");
    const first = createSavedParty({ id: "a", label: "خالد", operationKey: "k1", recordedAt: now });
    const second = createSavedParty({ id: "b", label: "خالد", operationKey: "k2", recordedAt: now });
    /* طرفان بالتسمية نفسها هويتان مستقلتان — لا دمج بالاسم أبدًا (SDF-009). */
    expect(first.id).not.toBe(second.id);
    expect(first.label).toBe(second.label);
  });

  it("rejects a bad timestamp honestly", () => {
    expect(() =>
      createSavedParty({ id: "p", label: "خالد", operationKey: "k", recordedAt: "not-a-time" }),
    ).toThrow();
  });
});

describe("renameSavedParty (UNIT-037 A6/U037-F05 — SDF-011)", () => {
  it("changes the current label only — id, createdAt, and archive state are untouched", () => {
    const renamed = renameSavedParty(baseParty, {
      label: "محمد الزهور",
      operationKey: "op-rename-1",
      recordedAt: "2026-10-29T10:00:00.000Z",
    });
    expect(renamed.label).toBe("محمد الزهور");
    expect(renamed.id).toBe(baseParty.id);
    expect(renamed.createdAt).toBe(baseParty.createdAt);
    expect(renamed.updatedAt).toBe("2026-10-29T10:00:00.000Z");
    /* التسمية القديمة تبقى محفوظة في لقطات المصادر — لا شيء هنا يمسها. */
  });

  it("rejects an empty rename", () => {
    expect(() => renameSavedParty(baseParty, { label: " ", operationKey: "k", recordedAt: now })).toThrow(
      "اكتب اسمًا أو وصفًا يعرّف الطرف قبل الحفظ.",
    );
  });
});

describe("setSavedPartyArchive (UNIT-037 A6/U037-F12 — SDF-011)", () => {
  it("archive is explicit, reversible, and keeps identity and label", () => {
    const archived = setSavedPartyArchive(baseParty, {
      archived: true,
      operationKey: "op-archive-1",
      recordedAt: "2026-10-29T11:00:00.000Z",
    });
    expect(archived.archivedAt).toBe("2026-10-29T11:00:00.000Z");
    expect(archived.id).toBe(baseParty.id);
    expect(archived.label).toBe(baseParty.label);

    const restored = setSavedPartyArchive(archived, {
      archived: false,
      operationKey: "op-restore-1",
      recordedAt: "2026-10-29T12:00:00.000Z",
    });
    expect(restored.archivedAt).toBeNull();
    expect(restored.label).toBe(baseParty.label);
  });
});
