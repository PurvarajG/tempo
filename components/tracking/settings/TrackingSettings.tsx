"use client";

import type { ReactNode } from "react";
import ActivitiesSection from "@/components/tracking/settings/ActivitiesSection";
import CategoriesSection from "@/components/tracking/settings/CategoriesSection";
import GapRulesSection from "@/components/tracking/settings/GapRulesSection";
import ModuleOrderSection from "@/components/tracking/settings/ModuleOrderSection";
import { useTasks } from "@/lib/store-context";

function Block({ title, children, body }: { title: string; body: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="px-3 pb-1 pt-4 text-meta text-ink-3">{title}</h3>
      <p className="px-3 pb-2 text-secondary text-ink-3">{body}</p>
      {children}
    </section>
  );
}

/** The four tracking setting bodies, each under a small header and one sentence. */
export default function TrackingSettings() {
  const { ready, settings } = useTasks();

  if (!ready || !settings) {
    return (
      <div className="px-4 pb-4 pt-2" data-testid="tracking-settings-loading">
        <div className="h-10 w-64 animate-pulse rounded-row bg-sunk" />
      </div>
    );
  }

  return (
    <div className="pb-2">
      <Block
        title="Categories"
        body="The groups your time is sorted into. Delete is refused while a category has recorded time, so archive it instead."
      >
        <CategoriesSection />
      </Block>
      <Block
        title="Activities"
        body="What you actually do. Presets show up as one tap chips on the Now module."
      >
        <ActivitiesSection />
      </Block>
      <Block
        title="Gap rules"
        body="The day boundary, the waking window gaps are searched within, and the shortest gap worth flagging."
      >
        <GapRulesSection />
      </Block>
      <Block
        title="Dashboard modules"
        body="The dashboard shows modules in this order and skips any turned off."
      >
        <ModuleOrderSection />
      </Block>
    </div>
  );
}
