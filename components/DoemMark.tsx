/**
 * Inline SVG brand mark for Doem: concept 01 "Task d" (three task rows that
 * form a lowercase d) on an ink tile, the form of soft.html's .mark (a 32 box,
 * radius 10). The path is the owner's master from
 * brand/doem/svg/doem-mark-indigo.svg, byte for byte.
 *
 * The glyph is 20 tall in the 32 tile (the same share as on the app icon),
 * with its bounding-box centre (101, 104) on the tile centre. Ink tile and
 * surface glyph come from theme tokens, so dark mode flips to a light tile
 * with a dark d and follows the app's own theme setting (data-theme).
 */
import type { ReactElement } from "react";

export default function DoemMark({ className = "size-8" }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="var(--color-ink)" />
      <path
        transform="translate(5.9 5.6) scale(0.1)"
        fill="var(--color-surface)"
        d="M 150 22 C 150 10 158 4 172 4 C 186 4 194 10 194 22 L 194 126 C 194 176 165 204 118 204 L 28 204 C 16 204 10 197 10 186 C 10 175 17 168 28 168 L 110 168 C 139 168 153 151 153 133 C 153 114 137 98 110 98 L 30 98 C 18 98 12 91 12 80 C 12 69 19 62 30 62 L 125 62 C 135 62 143 64 150 69 Z M 27 114 L 102 114 C 114 114 121 121 121 131 C 121 141 114 148 102 148 L 27 148 C 15 148 8 141 8 131 C 8 121 15 114 27 114 Z"
      />
    </svg>
  );
}
