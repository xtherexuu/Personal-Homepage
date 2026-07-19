import type { ReactNode } from "react";

/**
 * The panel's registry stamp — small uppercase mono chip (NOWA, ODPOWIEDZIANO,
 * budget). Server-renderable; tones map to the [data-admin] palette.
 */
export function Stamp({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "accent" | "muted";
  children: ReactNode;
}) {
  const tones = {
    ok: "border-(--ap-ok)/35 text-(--ap-ok)",
    accent: "border-(--ap-accent)/40 text-(--ap-accent)",
    muted: "border-(--ap-line-strong) text-(--ap-muted)",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider whitespace-nowrap uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
