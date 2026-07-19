"use client";

import { useActionState } from "react";

import { login } from "@/app/admin/login/actions";

const FIELD =
  "w-full rounded-lg border border-(--ap-line-strong) bg-(--ap-surface) px-3.5 py-2.5 " +
  "text-(--ap-text) placeholder:text-(--ap-muted) transition-colors " +
  "focus:border-(--ap-accent) focus:outline-none";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm text-(--ap-muted)">Login</span>
        <input
          name="username"
          autoComplete="username"
          required
          maxLength={200}
          className={FIELD}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-(--ap-muted)">Hasło</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={200}
          className={FIELD}
        />
      </label>

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-(--ap-danger)/40 bg-(--ap-danger)/10 px-3.5 py-2.5 text-sm text-(--ap-danger)"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-(--ap-accent) py-2.5 font-medium text-[#0d1420] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}
