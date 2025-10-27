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
];
