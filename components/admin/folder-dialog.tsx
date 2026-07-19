"use client";

import { useEffect, useState, useTransition } from "react";

import { ColorPicker } from "@/components/admin/color-picker";
import { type FolderColor } from "@/lib/folder-colors";

/**
 * Create/rename/recolor modal for a folder. Presentational — the caller wires
 * `onSubmit` to createFolder or updateFolder and closes on success.
 */
export function FolderDialog({
  title,
  submitLabel,
  initialName = "",
  initialColor,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialColor: FolderColor;
  onSubmit: (name: string, color: FolderColor) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<FolderColor>(initialColor);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Podaj nazwę folderu.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await onSubmit(trimmed, color);
      if (res.ok) onClose();
      else setError(res.error ?? "Nie udało się zapisać.");
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl border border-(--ap-line-strong) bg-(--ap-surface) p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm text-(--ap-muted)">Nazwa</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={40}
            placeholder="np. Pilne, Klienci, Do wyceny"
            className="w-full rounded-lg border border-(--ap-line-strong) bg-(--ap-bg) px-3 py-2 focus:border-(--ap-accent) focus:outline-none"
          />
        </label>

        <div className="mb-4">
          <span className="mb-2 block text-sm text-(--ap-muted)">
            Kolor ikony
          </span>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {error && <p className="mb-3 text-sm text-(--ap-danger)">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm text-(--ap-muted) transition-colors hover:text-(--ap-text)"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="rounded-lg bg-(--ap-accent) px-3.5 py-2 text-sm font-medium text-[#0d1420] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Zapisywanie…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
