import { createContext, useContext, type ReactNode } from "react";
import { useGameCatalog, type GameCatalogState } from "../hooks/useGameCatalog";

const GameCatalogContext = createContext<GameCatalogState | null>(null);

/** One shared catalog (bundled games + admin-managed extras) for the whole app. */
export function GameCatalogProvider({ children }: { children: ReactNode }) {
  const catalog = useGameCatalog();
  return <GameCatalogContext.Provider value={catalog}>{children}</GameCatalogContext.Provider>;
}

export function useCatalog(): GameCatalogState {
  const ctx = useContext(GameCatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <GameCatalogProvider>");
  return ctx;
}
