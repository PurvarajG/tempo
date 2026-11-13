// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

type RGBA = { r: number; g: number; b: number; a: number };
type Theme = "light" | "dark";

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

function block(startRe: RegExp): string {
  const m = startRe.exec(css);
  if (!m) throw new Error(`block not found: ${startRe}`);
  let i = css.indexOf("{", m.index) + 1;
  const begin = i;
  let depth = 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(begin, i - 1);
}

function decls(body: string, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:\\s*([^;]+);`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2].trim();
  return out;
}

const lightRaw = decls(block(/@theme static\s*\{/), "color");
const darkRaw = decls(block(/^:root\s*\{/m), "dark");

/** Raw (unresolved) value of --color-<name> in a theme. */
function rawToken(theme: Theme, name: string): string {
  if (theme === "dark" && name in darkRaw) return darkRaw[name];
  if (!(name in lightRaw)) throw new Error(`unknown token ${name}`);
  return lightRaw[name];
}

function parse(value: string, theme: Theme, overrides: Record<string, string> = {}): RGBA {
  const v = value.trim();
  const ref = /^var\(--(color|dark)-([a-z0-9-]+)\)$/.exec(v);
  if (ref) {
    const [, kind, name] = ref;
    if (kind === "dark") return parse(darkRaw[name], theme, overrides);
    if (name in overrides) return parse(overrides[name], theme, overrides);
    return parse(rawToken(theme, name), theme, overrides);
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgb) {
    const p = rgb[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  }
  throw new Error(`cannot parse colour: ${value}`);
}

function over(top: RGBA, base: RGBA): RGBA {
  const a = top.a + base.a * (1 - top.a);
  const mix = (t: number, b: number) => (t * top.a + b * base.a * (1 - top.a)) / a;
  return { r: mix(top.r, base.r), g: mix(top.g, base.g), b: mix(top.b, base.b), a };
}

function lum({ r, g, b }: RGBA): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: RGBA, bg: RGBA): number {
  const a = lum(fg);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

type Pair = { name: string; min: number; fg: string[]; bgLayers: string[]; navRail?: boolean };

// bgLayers are painted bottom to top; the first is always opaque.
const pairs: Pair[] = [];
function text(name: string, fg: string, bg: string[], min = 4.5) {
  pairs.push({ name, min, fg: [fg], bgLayers: bg });
}

for (const t of ["ink", "ink-2", "ink-3"]) {
  for (const b of ["surface", "raised", "sunk"]) text(`${t} on ${b}`, t, [b]);
}
text("accent-ink on accent", "accent-ink", ["accent"]);
text("accent on surface", "accent", ["surface"]);
text("hi on hi-bg over surface", "hi", ["surface", "hi-bg"]);
text("med on med-bg over surface", "med", ["surface", "med-bg"]);
text("ok on surface", "ok", ["surface"]);
text("accent on accent-soft over surface", "accent", ["surface", "accent-soft"]);
text("ink-dim on surface (large text only: 34px H1 second tone)", "ink-dim", ["surface"], 3);
for (const b of ["surface", "raised", "sunk"]) {
  text(`line-strong on ${b} (control outline)`, "line-strong", [b], 3);
}
for (let i = 1; i <= 7; i++) text(`project-${i} on surface (non-text)`, `project-${i}`, ["surface"], 3);
for (let i = 1; i <= 7; i++) {
  pairs.push({ name: `.nav-rail project-${i} on nav (non-text)`, min: 3, fg: [`project-${i}`], bgLayers: ["nav"], navRail: true });
}
for (let i = 1; i <= 7; i++) text(`legacy project-foreground on project-${i}`, "project-foreground", [`project-${i}`]);
// The sidebar logo initial is aria-hidden (the project name follows it), so it is held to 3:1.
for (let i = 1; i <= 7; i++) text(`logo-ink on project-${i} (aria-hidden initial)`, "logo-ink", [`project-${i}`], 3);

function compute(theme: Theme, p: Pair): number {
  const overrides: Record<string, string> = {};
  if (p.navRail) {
    for (let i = 1; i <= 7; i++) overrides[`project-${i}`] = darkRaw[`project-${i}`];
  }
  const tok = (n: string) => parse(`var(--color-${n})`, theme, overrides);
  let bg = tok(p.bgLayers[0]);
  for (const layer of p.bgLayers.slice(1)) bg = over(tok(layer), bg);
  const fg = over(tok(p.fg[0]), bg);
  return ratio(fg, bg);
}

const themes: Theme[] = ["light", "dark"];

describe("Doem v2 token contrast (computed from app/globals.css)", () => {
  const rows: string[] = [];
  for (const theme of themes) {
    describe(theme, () => {
      for (const p of pairs) {
        it(`${p.name} >= ${p.min}:1`, () => {
          const r = compute(theme, p);
          rows.push(`${theme.padEnd(5)} ${r.toFixed(2).padStart(6)}  min ${String(p.min).padEnd(3)} ${r >= p.min ? "ok  " : "FAIL"} ${p.name}`);
          expect(r).toBeGreaterThanOrEqual(p.min);
        });
      }
    });
  }
  it("prints the ratio table", () => {
    console.log("\n" + rows.sort().join("\n"));
  });
});
