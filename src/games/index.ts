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
];
