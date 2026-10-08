import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import ReflexRingGame from "./ReflexRingGame";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [ReflexRingGame] });
