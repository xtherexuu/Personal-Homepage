"use client";

import { Check } from "lucide-react";

import {
  FOLDER_COLOR_KEYS,
  FOLDER_COLORS,
  type FolderColor,
} from "@/lib/folder-colors";

/** Swatch grid for choosing a folder color. Selected swatch shows a check. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: FolderColor;
  onChange: (color: FolderColor) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Kolor folderu"
      className="flex flex-wrap gap-2"
    >
      {FOLDER_COLOR_KEYS.map((key) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={FOLDER_COLORS[key].label}
            title={FOLDER_COLORS[key].label}
            onClick={() => onChange(key)}
            style={{ backgroundColor: FOLDER_COLORS[key].dot }}
            className={`grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110 ${
              selected
                ? "ring-2 ring-(--ap-text) ring-offset-2 ring-offset-(--ap-surface)"
                : ""
            }`}
          >
            {selected && (
              <Check size={14} strokeWidth={3} className="text-black/70" />
            )}
          </button>
        );
      })}
    </div>
  );
}
