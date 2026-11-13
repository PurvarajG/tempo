// Copies the Doem brand package (brand/doem/) into build/ for electron-builder:
//
//   brand/doem/macos/Doem.icns               -> build/icon.icns  (Dock, Finder)
//   brand/doem/png/doem-app-1024.png         -> build/icon.png
//   brand/doem/png/doem-mark-template-16.png -> build/trayTemplate.png     (menu bar, 1x)
//   brand/doem/png/doem-mark-template-32.png -> build/trayTemplate@2x.png  (menu bar, 2x)
//
// brand/doem/ is the source of truth (see brand/doem/START-HERE.md); the .icns
// and PNGs there are rendered from its SVGs. This script only copies them so
// a pack never ships a stale icon. Run with `npm run electron:icon`.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const brand = path.join(root, "brand", "doem");
const buildDir = path.join(root, "build");
mkdirSync(buildDir, { recursive: true });

const copies = [
  ["macos/Doem.icns", "icon.icns"],
  ["png/doem-app-1024.png", "icon.png"],
  ["png/doem-mark-template-16.png", "trayTemplate.png"],
  ["png/doem-mark-template-32.png", "trayTemplate@2x.png"],
];

for (const [from, to] of copies) {
  const src = path.join(brand, from);
  if (!existsSync(src)) throw new Error(`Missing brand asset: ${src}`);
  copyFileSync(src, path.join(buildDir, to));
}

console.log("Wrote build/icon.icns, build/icon.png and build/trayTemplate{,@2x}.png from brand/doem");
