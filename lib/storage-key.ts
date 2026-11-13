/**
 * localStorage read that carries a value across the Tempo -> Doem rename.
 *
 * Keys are now `doem.<name>`. On the first read of a key that is missing, the
 * value stored under the pre-rename `tempo.<name>` key is copied to the new
 * key and the old key is removed, so each preference moves once.
 *
 * Callers keep their own try/catch: localStorage can throw (private mode,
 * blocked storage), and this helper lets that propagate like getItem would.
 */
const PREFIX = "doem.";
const LEGACY_PREFIX = "tempo.";

export function readStoredKey(key: string): string | null {
  const value = localStorage.getItem(key);
  if (value !== null || !key.startsWith(PREFIX)) return value;
  const legacyKey = LEGACY_PREFIX + key.slice(PREFIX.length);
  const legacy = localStorage.getItem(legacyKey);
  if (legacy === null) return null;
  try {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
  } catch {
    // Storage full or blocked: still return the old value for this read.
  }
  return legacy;
}
