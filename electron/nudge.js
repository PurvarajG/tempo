"use strict";

// Pure "not tracking" nudge counter. No Electron import, no timers: main.js
// calls tick() once a minute.

const ACTIVE_IDLE_SECONDS = 60; // idle at or above this counts as away, not drifting

function createNudgeCounter() {
  let threshold = null;
  let count = 0;
  let notified = false;

  return {
    setThreshold(minutes) {
      threshold = typeof minutes === "number" && minutes > 0 ? minutes : null;
    },
    tick(state) {
      if (state.tracking) {
        count = 0;
        notified = false;
        return { notify: false, minutes: 0 };
      }
      if (state.locked || state.idleSeconds >= ACTIVE_IDLE_SECONDS) {
        return { notify: false, minutes: count };
      }
      count += 1;
      let notify = false;
      if (threshold !== null && !notified && count >= threshold) {
        notified = true;
        notify = true;
      }
      return { notify, minutes: count };
    },
    reset() {
      count = 0;
      notified = false;
    },
  };
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function nudgeMessage(minutes) {
  return { title: "Not tracking", body: `Nothing has been tracked for ${formatMinutes(minutes)}.` };
}

module.exports = { createNudgeCounter, nudgeMessage, ACTIVE_IDLE_SECONDS };
