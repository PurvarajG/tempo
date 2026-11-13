// Pure away detector: decides WHEN to prompt and the away span.
// No Electron import, no timers. The main process feeds it lock, unlock
// and periodic idle readings.
const AWAY_IDLE_SECONDS = 300;
const MIN_LOCK_SECONDS = 60;
const MAX_LABEL = 40;

function createAwayWatcher() {
  let awayFrom = null;
  let locked = false;

  return {
    lock(now, tracking) {
      locked = true;
      if (!tracking) {
        awayFrom = null;
        return;
      }
      // An idle mark that began earlier stays: the away started then.
      if (!awayFrom) awayFrom = now;
    },

    unlock(now, tracking) {
      locked = false;
      const from = awayFrom;
      awayFrom = null;
      if (!from || !tracking) return null;
      if ((now.getTime() - from.getTime()) / 1000 < MIN_LOCK_SECONDS) return null;
      return { awayFrom: from, awayTo: now };
    },

    idleTick({ idleSeconds, now, tracking }) {
      if (locked) return null;
      if (!tracking) {
        awayFrom = null;
        return null;
      }
      if (!awayFrom) {
        if (idleSeconds >= AWAY_IDLE_SECONDS) {
          awayFrom = new Date(now.getTime() - idleSeconds * 1000);
        }
        return null;
      }
      if (idleSeconds < AWAY_IDLE_SECONDS) {
        const from = awayFrom;
        awayFrom = null;
        return { awayFrom: from, awayTo: new Date(now.getTime() - idleSeconds * 1000) };
      }
      return null;
    },
  };
}

function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function awayPromptText(minutes, label) {
  const text = String(label ?? "");
  const short = text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text;
  return {
    message: `Away for ${formatDuration(minutes)} while timing "${short}".`,
    buttons: [`Keep it on ${short}`, "Mark as break", "Discard"],
  };
}

module.exports = { createAwayWatcher, awayPromptText, AWAY_IDLE_SECONDS, MIN_LOCK_SECONDS };
