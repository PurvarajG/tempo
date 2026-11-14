"use client";

import BrainDump from "@/components/inbox/BrainDump";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

/** Weekly reset: the brain dump box in a card with the standard icon-tile header. */
export default function BrainDumpCard(): React.ReactElement {
  return (
    <Card aria-labelledby="wrap-brain-dump-title">
      <CardHeader titleId="wrap-brain-dump-title" icon={<Icon name="paper" size={16} />} title="Brain dump" right="One task per line" />
      <BrainDump labelledBy="wrap-brain-dump-title" />
    </Card>
  );
}
