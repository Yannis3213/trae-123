import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "../lib/auth";
import "../index.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    </AuthProvider>
  );
}
