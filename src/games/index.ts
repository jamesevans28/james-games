export type GameMeta = {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string; // path under public or src that Vite can serve
  load: () => Promise<{ mount: (container: HTMLElement) => { destroy: () => void } }>;
};

export const games: GameMeta[] = [
  {
    id: "reflex-ring",
    title: "Reflex Ring",
    description: "Tap precisely as the arrow hits the highlighted segment. Speeds up over time.",
    thumbnail: "/assets/star.png",
    load: async () => {
      const mod = await import("./reflex-ring/index");
      return { mount: mod.mount };
    },
  },
  {
    id: "snapadile",
    title: "Snapadile",
    description: "Tap the crocs before they reach your raft. More and faster crocs over time.",
    thumbnail: "/assets/logo.png",
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
    thumbnail: "/assets/logo.png",
    load: async () => {
      const mod = await import("./car-crash/index");
      return { mount: mod.mount };
    },
  },
];
