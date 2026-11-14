"use client";

import { useRef, useState } from "react";
import type { RefObject } from "react";
import { STAGE_KINDS } from "@/lib/types";
import type { ProjectStage, StageKind } from "@/lib/types";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Input from "../ui/Input";
import { limitToSave } from "./lanes";

const LABEL = "text-meta font-medium text-ink-2";
const SELECT =
  "h-10 w-full rounded-row bg-sunk px-3 text-body text-ink inset-ring-1 inset-ring-line-strong";

function LabelledField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}

function useFocusRef(): RefObject<HTMLInputElement | null> {
  return useRef<HTMLInputElement | null>(null);
}

export function AddStageDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, kind: StageKind) => Promise<void> | void;
}) {
  // Mounted only while open, so the fields start fresh every time.
  if (!open) return <></>;
  return <AddBody onClose={onClose} onAdd={onAdd} />;
}

function AddBody({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, kind: StageKind) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StageKind>("active");
  const [busy, setBusy] = useState(false);
  const nameRef = useFocusRef();
  const trimmed = name.trim();

  async function submit() {
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onAdd(trimmed, kind);
      onClose();
    } catch {
      // The store has already surfaced the reason; keep the dialog open.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a lane"
      initialFocusRef={nameRef}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!trimmed || busy} onClick={submit}>
            Add
          </Button>
        </>
      }
    >
      <LabelledField id="new-column-name" label="Lane name">
        <Input
          id="new-column-name"
          ref={nameRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </LabelledField>
      <LabelledField id="new-column-kind" label="Behaves as">
        <select
          id="new-column-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as StageKind)}
          className={SELECT}
        >
          {/* A second done column is refused by the server, so it isn't offered. */}
          {STAGE_KINDS.filter((k) => k !== "done").map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </LabelledField>
    </Dialog>
  );
}

export function RenameStageDialog({
  stage,
  onClose,
  onRename,
}: {
  stage: ProjectStage | null;
  onClose: () => void;
  onRename: (name: string) => Promise<void> | void;
}) {
  if (!stage) return <></>;
  return <RenameBody key={stage.id} stage={stage} onClose={onClose} onRename={onRename} />;
}

function RenameBody({
  stage,
  onClose,
  onRename,
}: {
  stage: ProjectStage;
  onClose: () => void;
  onRename: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(stage.name);
  const [busy, setBusy] = useState(false);
  const ref = useFocusRef();
  const trimmed = name.trim();

  async function submit() {
    if (busy) return;
    if (!trimmed || trimmed === stage.name) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onRename(trimmed);
      onClose();
    } catch {
      // The store has already surfaced the reason.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Rename "${stage.name}"`}
      initialFocusRef={ref}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <LabelledField id="rename-column-name" label="Lane name">
        <Input
          id="rename-column-name"
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </LabelledField>
    </Dialog>
  );
}

export function StageLimitDialog({
  stage,
  open,
  onClose,
  onSave,
}: {
  stage: ProjectStage | null;
  open: number;
  onClose: () => void;
  onSave: (limit: number | null) => Promise<void> | void;
}) {
  if (!stage) return <></>;
  return <LimitBody key={stage.id} stage={stage} open={open} onClose={onClose} onSave={onSave} />;
}

function LimitBody({
  stage,
  open,
  onClose,
  onSave,
}: {
  stage: ProjectStage;
  open: number;
  onClose: () => void;
  onSave: (limit: number | null) => Promise<void> | void;
}) {
  const [value, setValue] = useState(stage.wipLimit != null ? String(stage.wipLimit) : "");
  const [busy, setBusy] = useState(false);
  const ref = useFocusRef();

  async function commit(limit: number | null) {
    if (busy) return;
    setBusy(true);
    try {
      await onSave(limit);
      onClose();
    } catch {
      // The store has already surfaced the reason.
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const n = Number.parseInt(value, 10);
    void commit(limitToSave(Number.isFinite(n) && n > 0 ? n : null, open));
  }

  const lead = `${open} open ${open === 1 ? "card" : "cards"} here.`;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Limit for ${stage.name}`}
      description={open > 0 ? `${lead} A lower limit starts at ${open}.` : lead}
      initialFocusRef={ref}
      actions={
        <>
          <Button disabled={busy} onClick={() => void commit(null)}>
            No limit
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <LabelledField id="stage-limit" label="Card limit">
        <Input
          id="stage-limit"
          ref={ref}
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
      </LabelledField>
    </Dialog>
  );
}
