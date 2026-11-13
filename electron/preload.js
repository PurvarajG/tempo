// Bridges a small, fixed set of methods into the renderer via
// contextBridge. Every channel name below is a literal — nothing here takes
// a caller-supplied channel or exposes ipcRenderer itself, so nothing in the
// renderer can reach past this surface into Node or Electron internals.
// Covers commands, badge/timer/notify, attention, reminders, desktop settings
// the quick-capture window and Claude Code sessions (read-only).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("doem", {
  onCommand(callback) {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("doem:command", listener);
    return () => ipcRenderer.removeListener("doem:command", listener);
  },
  setBadge(count) {
    ipcRenderer.send("doem:set-badge", count);
  },
  setTimerStatus(status) {
    ipcRenderer.send("doem:timer-status", status);
  },
  setCanToggleTimer(canToggle) {
    ipcRenderer.send("doem:can-toggle-timer", canToggle);
  },
  notify(title, options) {
    ipcRenderer.send("doem:notify", title, options);
  },
  attention(payload) {
    ipcRenderer.send("doem:attention", payload);
  },
  setReminders(reminders) {
    ipcRenderer.send("doem:set-reminders", reminders);
  },
  setDesktopSettings(settings) {
    ipcRenderer.send("doem:set-desktop-settings", settings);
  },
  getCaptureStatus() {
    return ipcRenderer.invoke("doem:get-capture-status");
  },
  onCaptureStatus(callback) {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("doem:capture-status", listener);
    return () => ipcRenderer.removeListener("doem:capture-status", listener);
  },
  getClaudeSessions() {
    return ipcRenderer.invoke("doem:get-claude-sessions");
  },
  onClaudeSessions(callback) {
    const listener = (_event, sessions) => callback(sessions);
    ipcRenderer.on("doem:claude-sessions", listener);
    return () => ipcRenderer.removeListener("doem:claude-sessions", listener);
  },
  closeCapture() {
    ipcRenderer.send("doem:capture-close");
  },
  captureSaved() {
    ipcRenderer.send("doem:capture-saved");
  },
  platform: process.platform,
});
