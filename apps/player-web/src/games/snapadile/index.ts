import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import SnapadileScene from "./SnapadileScene";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) =>
  createGameMount(host, el, {
    scenes: [SnapadileScene],
    physics: { default: "arcade", arcade: { debug: false } },
    backgroundColor: "#0b2f4f",
  });
