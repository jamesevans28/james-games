import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import HoopCityScene from "./scenes/HoopCityScene";

export { default as manifest } from "./manifest";

/** Night sky, so the city and the ball read well (the canvas is transparent otherwise). */
export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [HoopCityScene], backgroundColor: "#06142a" });
