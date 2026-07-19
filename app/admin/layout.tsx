import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The panel's shell. Nested inside the root layout (fonts ride along free) but
 * visually its own world: [data-admin] scopes the graphite palette defined in
 * globals.css. Auth is deliberately NOT checked here — layouts don't re-render
 * on client-side navigation, so every page calls requireAdmin() itself and the
 * proxy handles the optimistic redirect.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel wiadomości",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-admin
      className="min-h-dvh font-geist text-[15px] antialiased"
    >
      {children}
    </div>
  );
}
