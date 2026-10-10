/** R7 / R6-F17-P09 (2026-10-10): عقد قراءة صفحة مواد المخزون الرباعية —
 * الفشل الجماعي الصادق والنجاح معًا. */
import { describe, expect, it } from "vitest";
import { readInventoryMaterialsPage } from "./inventoryMaterialsViewModel";
import type { InventoryMaterialService } from "./inventoryMaterialService";

const ok = <T>(value: T) => ({ ok: true as const, value });

describe("R7/P09 — القراءة الرباعية لصفحة المواد", () => {
  const service = (fail: "overview" | "movements" | "shortages" | "activation" | null) =>
    ({
      overview: async () => (fail === "overview" ? { ok: false } : ok({ marker: "overview" })),
      movements: async () => (fail === "movements" ? { ok: false } : ok([{ marker: "movement" }])),
      shortages: async () => (fail === "shortages" ? { ok: false } : ok([{ marker: "shortage" }])),
      readActivation: async () => (fail === "activation" ? { ok: false } : ok({ marker: "activation" })),
    }) as unknown as InventoryMaterialService;

  it("الأربع معًا: حالة ready بكل القيم كما هي", async () => {
    const state = await readInventoryMaterialsPage({ inventory: service(null) });
    expect(state.phase).toBe("ready");
    if (state.phase !== "ready") return;
    expect((state.overview as { marker: string }).marker).toBe("overview");
    expect(state.movements).toHaveLength(1);
    expect(state.shortages).toHaveLength(1);
    expect((state.activation as { marker: string }).marker).toBe("activation");
  });

  it("فشل أي قراءة من الأربع = خطأ صادق واحد (إعادة محاولة)", async () => {
    for (const fail of ["overview", "movements", "shortages", "activation"] as const) {
      expect(await readInventoryMaterialsPage({ inventory: service(fail) })).toEqual({ phase: "error" });
    }
  });
});
