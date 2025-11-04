import { Outlet } from "react-router-dom";

export default function RootLayout() {
  return (
    <div className="min-h-screen w-full bg-white text-black font-sans">
      <main className="w-full h-full">
        <Outlet />
      </main>
    </div>
  );
}
