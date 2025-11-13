export type GameMeta = {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string; // path under public or src that Vite can serve
  // optional metadata
  createdAt?: string; // ISO date
  updatedAt?: string; // ISO date
  load: () => Promise<{ mount: (container: HTMLElement) => { destroy: () => void } }>;
};

export const games: GameMeta[] = [
  {
    id: "reflex-ring",
    title: "Reflex Ring",
    description: "Tap precisely as the arrow hits the highlighted segment. Speeds up over time.",
    thumbnail: "/assets/reflex-ring/thumbnail.svg",
    createdAt: "2024-09-15T00:00:00.000Z",
    updatedAt: "2024-09-15T00:00:00.000Z",
    load: async () => {
      const mod = await import("./reflex-ring/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "snapadile",
    title: "Snapadile",
    description: "Tap the crocs before they reach your raft. More and faster crocs over time.",
    thumbnail: "/assets/snapadile/thumbnail.svg",
    createdAt: "2024-09-16T00:00:00.000Z",
    updatedAt: "2024-09-16T00:00:00.000Z",
    load: async () => {
      const mod = await import("./snapadile/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "car-crash",
    title: "Car Crash",
    description:
      "Switch lanes to dodge incoming cars. Step-based movement with growing difficulty.",
    thumbnail: "/assets/car-crash/thumbnail.svg",
    createdAt: "2024-09-17T00:00:00.000Z",
    updatedAt: "2024-09-17T00:00:00.000Z",
    load: async () => {
      const mod = await import("./car-crash/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "fill-the-cup",
    title: "Fill the Cup",
    description:
      "Hold to pour water and fill each glass to the highlighted band. Smaller targets over time.",
    thumbnail: "/assets/fill-the-cup/thumbnail.svg",
    createdAt: "2025-11-01T00:00:00.000Z",
    updatedAt: "2025-11-01T00:00:00.000Z",
    load: async () => {
      const mod = await import("./fill-the-cup/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "flash-bash",
    title: "Flash Bash",
    description:
      "Watch the sequence of colored shapes, then mimic them before time runs out. Sequences get longer!",
    thumbnail: "/assets/flash-bash/thumbnail.svg",
    createdAt: "2025-11-04T00:00:00.000Z",
    updatedAt: "2025-11-04T00:00:00.000Z",
    load: async () => {
      const mod = await import("./flash-bash/index.ts");
      return { mount: mod.mount };
    },
  },
  {
    id: "ho-ho-home-delivery",
    title: "Ho Ho Home Delivery",
    description:
      "Drop presents into chimneys from Santa's sleigh. Nail the landing, avoid misses. 3 lives!",
    thumbnail: "/assets/ho-ho-home-delivery/thumbnail.svg",
    createdAt: "2025-11-05T00:00:00.000Z",
    updatedAt: "2025-11-05T00:00:00.000Z",
    load: async () => {
      const mod = await import("./ho-ho-home-delivery/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "ready-steady-shoot",
    title: "Ready Steady Shoot",
    description:
      "Hold to pick angle, hold to pick power, then release to shoot. Swish for 2 points! 3 lives.",
    thumbnail: "/assets/ready-steady-shoot/thumbnail.svg",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    load: async () => {
      const mod = await import("./ready-steady-shoot/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "paddle-pop",
    title: "Paddle Pop",
    description: "Deflect the marble, collect power-ups, hit bonus discs, avoid falling obstacles.",
    thumbnail: "/assets/paddle-pop/thumbnail.svg",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    load: async () => {
      const mod = await import("./paddle-pop/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "word-rush",
    title: "Word Rush with Tom",
    description: "Guess words and phrases with your selected letters. 2-minute timer per level!",
    thumbnail: "/assets/word-rush/thumbnail.svg",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    load: async () => {
      const mod = await import("./word-rush/index");
      return { mount: mod.mount };
    },
  },
];
