import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import MainScene from "./scenes/MainScene";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [MainScene], backgroundColor: "#001133" });
