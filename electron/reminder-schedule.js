/**
 * Pure reminder schedule for the Electron main process. No timers and no
 * Electron import: the caller passes `now` and shows what due() returns.
 */
const REPEAT_AFTER_MINUTES = 10;
const SNOOZE_MINUTES = 15;
const CATCH_UP_MINUTES = 5;

const MINUTE = 60 * 1000;

function reminderKey(reminder) {
  return `${reminder.taskId}@${reminder.scheduled} ${reminder.dueTime}`;
}

function dueDate(reminder) {
  const [y, m, d] = String(reminder.scheduled).split("-").map(Number);
  const [hh, mm] = String(reminder.dueTime).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function createReminderSchedule() {
  let reminders = [];
  // key -> { fired: Set<kind>, handled: boolean, snoozeAt: number | null }
  const state = new Map();

  function stateFor(key) {
    let s = state.get(key);
    if (!s) {
      s = { fired: new Set(), handled: false, snoozeAt: null };
      state.set(key, s);
    }
    return s;
  }

  function currentKey(taskId) {
    const found = reminders.find((r) => r.taskId === taskId);
    return found ? reminderKey(found) : null;
  }

  return {
    setReminders(list) {
      reminders = Array.isArray(list) ? list.slice() : [];
      const keep = new Set(reminders.map(reminderKey));
      for (const key of Array.from(state.keys())) {
        if (!keep.has(key)) state.delete(key);
      }
    },

    due(now) {
      const t = now.getTime();
      const out = [];
      for (const r of reminders) {
        const key = reminderKey(r);
        const s = stateFor(key);
        const dueAt = dueDate(r).getTime();
        if (Number.isNaN(dueAt)) continue;
        const events = [];
        if (r.leadMinutes > 0) {
          events.push({
            kind: "lead",
            at: dueAt - r.leadMinutes * MINUTE,
            body: `Due at ${r.dueTime}, in ${r.leadMinutes}m.`,
          });
        }
        events.push({ kind: "due", at: dueAt, body: "Due now." });
        if (!s.handled && s.snoozeAt === null) {
          events.push({
            kind: "repeat",
            at: dueAt + REPEAT_AFTER_MINUTES * MINUTE,
            body: `Due at ${r.dueTime}.`,
          });
        }
        if (!s.handled && s.snoozeAt !== null) {
          events.push({ kind: "snooze", at: s.snoozeAt, body: `Due at ${r.dueTime}.` });
        }
        for (const e of events) {
          if (s.fired.has(e.kind) || t < e.at) continue;
          s.fired.add(e.kind);
          if (t - e.at > CATCH_UP_MINUTES * MINUTE) continue;
          out.push({ taskId: r.taskId, title: r.title, kind: e.kind, body: e.body });
        }
      }
      return out;
    },

    snooze(taskId, now) {
      const key = currentKey(taskId);
      if (!key) return;
      const s = stateFor(key);
      s.snoozeAt = now.getTime() + SNOOZE_MINUTES * MINUTE;
      s.fired.delete("snooze");
      s.handled = false;
    },

    handled(taskId) {
      const key = currentKey(taskId);
      if (!key) return;
      const s = stateFor(key);
      s.handled = true;
      s.snoozeAt = null;
    },
  };
}

module.exports = {
  createReminderSchedule,
  reminderKey,
  REPEAT_AFTER_MINUTES,
  SNOOZE_MINUTES,
  CATCH_UP_MINUTES,
};
