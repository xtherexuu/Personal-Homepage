"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";

import {
  createFolder,
  deleteFolder,
  updateFolder,
} from "@/app/admin/actions";
import { FolderDialog } from "@/components/admin/folder-dialog";
import type { FolderWithCount } from "@/components/admin/types";
import {
  DEFAULT_FOLDER_COLOR,
  folderDot,
  isFolderColor,
  type FolderColor,
} from "@/lib/folder-colors";

type Dialog =
  | { mode: "create" }
  | { mode: "edit"; folder: FolderWithCount }
  | null;

/**
 * The „Foldery" tab: create folders, recolor/rename them, delete them, and jump
 * into each folder's messages. Deleting a folder only drops the label — the
 * messages stay in the inbox.
 */
export function FoldersManager({ folders }: { folders: FolderWithCount[] }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const colorOf = (c: string): FolderColor =>
    isFolderColor(c) ? c : DEFAULT_FOLDER_COLOR;

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-(--ap-muted)">
          {folders.length === 0
            ? "Uporządkuj wiadomości własnymi folderami."
            : `${folders.length} ${folders.length === 1 ? "folder" : "folderów"}`}
        </p>
        <button
          type="button"
          onClick={() => setDialog({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-lg bg-(--ap-accent) px-3 py-1.5 text-sm font-medium text-[#0d1420] transition-opacity hover:opacity-90"
        >
          <FolderPlus size={16} aria-hidden />
          Nowy folder
        </button>
      </div>

      {folders.length === 0 ? (
        <p className="py-20 text-center text-(--ap-muted)">
          Nie masz jeszcze folderów. Utwórz pierwszy, aby grupować wiadomości.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((f) => (
            <li
              key={f.id}
              className="group relative rounded-xl border border-(--ap-line) bg-(--ap-surface) transition-colors hover:border-(--ap-line-strong)"
            >
              <Link
                href={`/admin?folder=${f.id}`}
                className="flex items-center gap-3 p-4 pr-20"
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${folderDot(f.color)}22` }}
                >
                  <Folder
                    size={20}
                    aria-hidden
                    style={{ color: folderDot(f.color) }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="font-mono text-xs text-(--ap-muted)">
                    {f.count} {f.count === 1 ? "wiadomość" : "wiadomości"}
                  </span>
                </span>
              </Link>

              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  type="button"
                  aria-label={`Edytuj folder ${f.name}`}
                  onClick={() => setDialog({ mode: "edit", folder: f })}
                  className="grid h-8 w-8 place-items-center rounded-lg text-(--ap-muted) transition-colors hover:bg-(--ap-raised) hover:text-(--ap-text)"
                >
                  <Pencil size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Usuń folder ${f.name}`}
                  onClick={() => setConfirmId(f.id)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-(--ap-muted) transition-colors hover:bg-(--ap-raised) hover:text-(--ap-danger)"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>

              {confirmId === f.id && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-(--ap-surface)/95 p-4 text-center">
                  <p className="text-sm">
                    Usunąć folder „{f.name}”? Wiadomości zostaną w skrzynce.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await deleteFolder(f.id);
                          setConfirmId(null);
                        })
                      }
                      className="rounded-lg bg-(--ap-danger) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Usuń
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg px-3 py-1.5 text-sm text-(--ap-muted) hover:text-(--ap-text)"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog?.mode === "create" && (
        <FolderDialog
          title="Nowy folder"
          submitLabel="Utwórz"
          initialColor={DEFAULT_FOLDER_COLOR}
          onSubmit={(name, color) => createFolder(name, color)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.mode === "edit" && (
        <FolderDialog
          title="Edytuj folder"
          submitLabel="Zapisz"
          initialName={dialog.folder.name}
          initialColor={colorOf(dialog.folder.color)}
          onSubmit={(name, color) => updateFolder(dialog.folder.id, name, color)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
