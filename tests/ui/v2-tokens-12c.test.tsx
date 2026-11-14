// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

function declared(name: string): string | null {
  const re = new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, "gm");
  const m = re.exec(css);
  return m ? m[1].trim() : null;
}

describe("phase 12C tokens", () => {
  it("defines the day numeral type token", () => {
    expect(declared("--text-day-num")).toBe("32px");
    expect(declared("--text-day-num--line-height")).toBe("1");
    expect(declared("--text-day-num--letter-spacing")).toBe("-0.05em");
    expect(declared("--text-day-num--font-weight")).toBe("500");
  });

  it("defines the project dot radius token and keeps --radius-dot", () => {
    expect(declared("--radius-pdot")).toBe("3px");
    expect(declared("--radius-dot")).toBe("1.5px");
  });
});
