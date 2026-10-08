import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import FlashBashScene, { SPACE } from "./scenes/FlashBashScene";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [FlashBashScene], backgroundColor: SPACE });
