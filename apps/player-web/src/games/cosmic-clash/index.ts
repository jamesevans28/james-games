import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import CosmicClashScene from "./scenes/CosmicClashScene";

export { default as manifest } from "./manifest";

// No physics config: movement and hits are plain distance checks in the scene.
export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [CosmicClashScene], backgroundColor: "#05060f" });
