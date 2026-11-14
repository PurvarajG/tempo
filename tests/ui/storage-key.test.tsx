import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStoredKey } from "@/lib/storage-key";

describe("readStoredKey (Tempo -> Doem localStorage rename)", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns the doem.* value when present and leaves any old key alone", () => {
    localStorage.setItem("doem.sidebarCollapsed", "1");
    localStorage.setItem("tempo.sidebarCollapsed", "0");
    expect(readStoredKey("doem.sidebarCollapsed")).toBe("1");
    expect(localStorage.getItem("tempo.sidebarCollapsed")).toBe("0");
  });

  it("moves a tempo.* value to doem.* once and removes the old key", () => {
    localStorage.setItem("tempo.sidebarOpenProject", "p-42");
    expect(readStoredKey("doem.sidebarOpenProject")).toBe("p-42");
    expect(localStorage.getItem("doem.sidebarOpenProject")).toBe("p-42");
    expect(localStorage.getItem("tempo.sidebarOpenProject")).toBeNull();
  });

  it("returns null when neither key exists", () => {
    expect(readStoredKey("doem.projectsCollapsed")).toBeNull();
    expect(store.size).toBe(0);
  });

  it("does not invent a legacy lookup for keys outside the doem. namespace", () => {
    localStorage.setItem("tempo.theme", "dark");
    expect(readStoredKey("theme")).toBeNull();
  });
});
