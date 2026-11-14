/** Focus the element with this id, retrying each frame until it exists or the deadline passes. Browser-only. */
export function focusWhenReady(id: string, deadline: number = Date.now() + 1000): void {
  const el = document.getElementById(id);
  if (el) {
    el.focus();
    return;
  }
  if (Date.now() < deadline) requestAnimationFrame(() => focusWhenReady(id, deadline));
}
