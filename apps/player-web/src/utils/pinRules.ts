/**
 * New PINs are 6 digits. Sign-in also takes 4 or 5, because players brought over from the
 * prototype (DECISIONS 2026-10-27) may still have a 4-digit PIN. The server checks the PIN
 * against its hash whatever the length.
 */
export function pinLengthOk(mode: "login" | "register", pin: string): boolean {
  return mode === "login" ? pin.length >= 4 && pin.length <= 6 : pin.length === 6;
}
