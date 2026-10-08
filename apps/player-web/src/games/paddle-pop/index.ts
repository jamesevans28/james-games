import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import PaddlePopScene from "./scenes/PaddlePopScene";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) =>
  createGameMount(host, el, {
    scenes: [PaddlePopScene],
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    // The volcano background art covers this; it only shows while the art loads.
    backgroundColor: "#111827",
  });
