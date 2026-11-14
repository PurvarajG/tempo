# doem brand handoff

Implement the original **01 Task d** selected from the four-option concept sheet. The selected reference is in `reference/selected-concept-sheet.png`, upper left. The vector master is a clean geometric reconstruction of that raster concept, retaining its rounded right ascender, open bowl and separate middle task bar. It uses the exact app palette. Minor contour differences are inherent in this reconstruction.

## Identity

Use lowercase **doem** in the logo. Pronounced DOH-em. The name combines “do them” with carpe diem, seize the day. The task rows form the letter d.

## Files and placement

| Usage | Asset |
| --- | --- |
| Light sidebar, website | `svg/doem-mark-indigo.svg` |
| Dark sidebar | `svg/doem-mark-dark.svg` |
| Monochrome | `svg/doem-mark-ink.svg` or `svg/doem-mark-white.svg` |
| Full horizontal logo | `svg/doem-lockup-light.svg` or `svg/doem-lockup-dark.svg` |
| macOS Dock/Finder | `macos/Doem.icns` |
| macOS source sizes | `macos/Doem.iconset` |
| Menu bar | `png/doem-mark-template-16.png` at 1x, `png/doem-mark-template-32.png` at 2x |
| Browser favicon | `web/favicon.svg` |
| High-resolution PNG | `png/doem-app-1024.png` |

SVG marks contain paths only. Lockup SVGs use live Geist text at weight 600 and require Geist installed or loaded by the app. For UI implementation, prefer the separate mark beside live text using the app's existing Geist font. The generated concept lettering has been standardised to the design language's Geist SemiBold.

## Implementation

1. Copy relevant assets into the application's asset directory and preserve the SVG viewBox.
2. Display the sidebar mark at 32 × 32 px with 10 px gap to the name. Use Geist 600, 20 px, tracking −0.03em. The viewBox includes breathing room.
3. Use the dark indigo mark with #ededef text on dark surfaces. Tie this to the application's explicit theme setting. The HTML example uses the system theme and should be adapted if the application overrides it.
4. For a native status item, use the monochrome PNG, set its logical size to 16 × 16 points and mark the NSImage as a template. Supply the 32 px representation for Retina displays. Check the final result in the running application's menu bar.
5. Set the macOS bundle icon through the project's existing packaging configuration. The supplied ICNS contains standard 1x and 2x representations. For Xcode, import the PNGs from the iconset into the existing AppIcon asset slots.
6. Use `web/brand.css` and `web/brand.html` as small integration examples. Give navigation links accessible names and keep redundant icon images decorative.

## Colour and spacing

Light accent #4a4ae8. Dark accent #8a8bff. Light ink #141519. Dark ink #ededef. White #ffffff. Tokens are also provided in `tokens.json`.

Keep at least one task-bar thickness of clear space around the visible mark. Preserve its proportions. Use the supplied monochrome silhouette when colour is unavailable. The app icon uses a white mark on an indigo rounded tile with transparent outer margins.

## Review before release

Open `preview.html` to inspect the exported identity. Check the actual application at 16, 32 and 64 px, in light and dark themes, and check the packaged Dock icon. Raster sizes and SVG structure were validated during export. Application integration and runtime rendering remain for the coding agent to verify.

## Reference and regeneration

The original design-language HTML is included for palette, type and UI context. `source/render.swift` renders the same path geometry into PNGs using macOS AppKit. Run it with `swift -module-cache-path /tmp/doem-swift-cache source/render.swift "$PWD"` from this package directory, then run `python3 source/build_icns.py`.
