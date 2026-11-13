"use client";

import { useEffect, useRef, useState } from "react";
import { useTasks, type SaveState } from "@/lib/store-context";
import type { DayEnergy } from "@/lib/types";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import Icon from "../ui/Icon";
import Input from "../ui/Input";
import SavedCue from "../ui/SavedCue";

const CHOICES: { value: DayEnergy; label: string }[] = [
  { value: 1, label: "Low" },
  { value: 2, label: "Okay" },
  { value: 3, label: "Good" },
];

/** How the day felt: energy 1 to 3 and an optional line. Saved to day_reviews. */
export default function DayCheck({ dayISO }: { dayISO: string }) {
  const { getDayReview, saveDayReview } = useTasks();
  const [energy, setEnergy] = useState<DayEnergy | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const savedNote = useRef<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let live = true;
    void (async () => {
      const review = await getDayReview(dayISO);
      if (!live) return;
      setEnergy(review?.energy ?? null);
      setNote(review?.note ?? "");
      savedNote.current = review?.note ?? null;
    })();
    return () => {
      live = false;
      loaded.current = false;
    };
  }, [dayISO, getDayReview]);

  async function save(nextEnergy: DayEnergy | null, nextNote: string | null) {
    setState("saving");
    const result = await saveDayReview(dayISO, { energy: nextEnergy, note: nextNote });
    if (result) savedNote.current = nextNote;
    setState(result ? "saved" : "error");
  }

  function pick(value: DayEnergy) {
    const next = energy === value ? null : value;
    setEnergy(next);
    void save(next, note.trim() || null);
  }

  function commitNote() {
    const trimmed = note.trim() || null;
    if (trimmed === savedNote.current) return;
    void save(energy, trimmed);
  }

  return (
    <Card aria-labelledby="day-check-title">
      <CardHeader
        titleId="day-check-title"
        title="How was today?"
        icon={<Icon name="today" size={14} />}
        right={<SavedCue state={state} onRetry={() => void save(energy, note.trim() || null)} />}
      />
      <div className="flex flex-col gap-3 p-4 pt-2">
        <div className="flex items-center gap-2">
          {CHOICES.map((c) => (
            <Button
              key={c.value}
              variant="chip"
              size="sm"
              aria-pressed={energy === c.value}
              onClick={() => pick(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <Input
          variant="field"
          value={note}
          placeholder="One line about today (optional)"
          aria-label="Note about today"
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitNote();
          }}
        />
      </div>
    </Card>
  );
}
