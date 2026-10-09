import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import SortScene from "./scenes/SortScene";

export { default as manifest } from "./manifest";

// A paper backdrop in both themes: the ink outlines and ball marks need a light page.
export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [SortScene], backgroundColor: host.colors.paper });
