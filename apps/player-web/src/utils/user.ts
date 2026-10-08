import { adapters } from "../platform/adapters";

const STORAGE_NAME_KEY = "playerName";

export function getUserName(): string | null {
  const v = adapters.storage.get(STORAGE_NAME_KEY);
  return v && v.trim().length > 0 ? v.trim() : null;
}

export function setUserName(name: string) {
  const v = (name || "").trim().slice(0, 24); // cap length for UI
  adapters.storage.set(STORAGE_NAME_KEY, v);
}

export function ensureUserName(): string | null {
  const n = getUserName();
  if (!n) return null;
  return n;
}
