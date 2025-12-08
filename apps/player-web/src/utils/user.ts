const STORAGE_NAME_KEY = "playerName";

export function getUserName(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_NAME_KEY);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

export function setUserName(name: string) {
  const v = (name || "").trim().slice(0, 24); // cap length for UI
  localStorage.setItem(STORAGE_NAME_KEY, v);
}

export function ensureUserName(): string | null {
  let n = getUserName();
  if (!n) return null;
  return n;
}
