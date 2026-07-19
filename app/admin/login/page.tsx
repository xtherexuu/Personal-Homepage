import type { Metadata } from "next";

import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Logowanie" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 font-mono text-xs tracking-[0.2em] text-(--ap-muted) uppercase">
          bartoszzaleski.com
        </p>
        <h1 className="mb-8 font-display text-2xl font-bold">
          Panel wiadomości
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
