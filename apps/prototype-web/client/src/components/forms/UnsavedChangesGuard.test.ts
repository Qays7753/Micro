import { describe, expect, it, vi } from "vitest";
import { completeSaveNavigation, navigationDecision, resolveUnsavedExit } from "./UnsavedChangesGuard";

describe("unsaved changes guard decisions", () => {
  it("navigates without a prompt when the form is not dirty", () => {
    expect(navigationDecision(false, "/orders")).toBe("navigate");
  });

  it("prompts before leaving a dirty form", () => {
    expect(navigationDecision(true, "/orders")).toBe("prompt");
  });

  it("keeps the three user choices explicit", () => {
    expect(resolveUnsavedExit("save", "/schedule")).toEqual({ kind: "save", target: "/schedule" });
    expect(resolveUnsavedExit("discard", "/schedule")).toEqual({ kind: "discard", target: "/schedule" });
    expect(resolveUnsavedExit("cancel", "/schedule")).toEqual({ kind: "cancel" });
  });

  it("navigates only after a successful save", async () => {
    const navigate = vi.fn();
    const saved = await completeSaveNavigation(async () => true, navigate, "/orders");
    expect(saved).toBe(true);
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/orders");
  });

  it("keeps the user on the form when saving fails", async () => {
    const navigate = vi.fn();
    const saved = await completeSaveNavigation(async () => false, navigate, "/orders");
    expect(saved).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
