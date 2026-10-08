/** The input kit (T4.6): every touch pattern the games use, in one place. */
export { holdZones, tapZones, swipe, keys, type InputHandle } from "./kit";
export { createDPad as dpad, type DPadDirection, type DPadInstance, type DPadMode } from "./dpad";
export { createOnScreenKeyboard } from "./onScreenKeyboard";
export { classifySwipe, zoneIndex, sideOf, OPPOSITE, type Direction4 } from "./gestures";
