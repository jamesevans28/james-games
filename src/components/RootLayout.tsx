import { Outlet } from "react-router-dom";

export default function RootLayout() {
  return (
    <div className="bg-gray-900 min-h-screen flex flex-col items-center justify-center font-sans">
      <main className="w-full h-full max-w-lg mx-auto bg-black shadow-2xl shadow-purple-900/20">
        <Outlet />
      </main>
    </div>
  );
}
