import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import BlockerScene from "./scenes/BlockerScene";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [BlockerScene], backgroundColor: "#0b1220" });
