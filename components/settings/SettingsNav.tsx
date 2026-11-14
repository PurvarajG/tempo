"use client";

import { useEffect, useState } from "react";

/**
 * The jump list beside the settings cards. Rows follow the v2 sidebar nav
 * (soft.html `.nav a`): plain ink-2 text with no box, and the active row is a
 * raised pill with a hairline and shadow-sm. The page stays a server component
 * so the feed secret is read from the environment; only this nav, which needs
 * IntersectionObserver to track the scroll position, is a client child.
 * Below `shell:` it sits above the cards as a horizontal row.
 */
export default function SettingsNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // Closest to the top of the scroll container wins.
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b,
        );
        setActive(top.target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: [0, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Settings sections"
      className="min-w-0 shell:sticky shell:top-0 shell:self-start"
    >
      <ul className="flex flex-wrap gap-0.5 shell:flex-col">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() =>
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              aria-current={active === s.id ? "true" : undefined}
              className={`flex h-10 w-full items-center rounded-row px-3 text-left text-body transition-colors ${
                active === s.id
                  ? "bg-raised font-medium text-ink shadow-sm ring-1 ring-line"
                  : "text-ink-2 hover:bg-line hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
