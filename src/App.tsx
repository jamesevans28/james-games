import { BrowserRouter, Routes, Route } from "react-router-dom";
import GameHub from "./pages";
import PlayGame from "./pages/games/[gameId]";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameHub />} />
        <Route path="/games/:gameId" element={<PlayGame />} />
      </Routes>
    </BrowserRouter>
  );
}
