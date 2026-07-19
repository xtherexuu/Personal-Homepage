"use client";

import { useState, useTransition } from "react";

import { Check, Folder, FolderPlus, Plus } from "lucide-react";

import { assignFolder, createFolder } from "@/app/admin/actions";
import { ColorPicker } from "@/components/admin/color-picker";
import type { FolderLite } from "@/components/admin/types";
import { DEFAULT_FOLDER_COLOR, folderDot, type FolderColor } from "@/lib/folder-colors";

/**
 * The folder check-list reused by the row context menu and the message detail
 * view: tick folders to add/remove the message, or create a new folder inline
 * and drop the message straight into it. Membership is optimistic — the toggle
 * reflects instantly and the server action reconciles the rest of the UI.
 */
export function FolderAssign({
  messageId,
  folders,
  initialMemberIds,
}: {
  messageId: number;
  folders: FolderLite[];
  initialMemberIds: number[];
}) {
  const [list, setList] = useState<FolderLite[]>(folders);
  const [members, setMembers] = useState<Set<number>>(
    () => new Set(initialMemberIds),
  );
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<FolderColor>(DEFAULT_FOLDER_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(folderId: number) {
    const member = !members.has(folderId);
    setMembers((prev) => {
      const next = new Set(prev);
      if (member) next.add(folderId);
      else next.delete(folderId);
      return next;
    });
    start(() => assignFolder(messageId, folderId, member));
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Podaj nazwę folderu.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await createFolder(trimmed, color);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await assignFolder(messageId, res.id, true);
      setList((prev) => [...prev, { id: res.id, name: res.name, color: res.color }]);
      setMembers((prev) => new Set(prev).add(res.id));
      setName("");
      setColor(DEFAULT_FOLDER_COLOR);
      setCreating(false);
    });
  }

  return (
    <div className="flex flex-col">
      {list.length > 0 ? (
        <ul className="max-h-56 overflow-y-auto py-1">
          {list.map((f) => {
            const member = members.has(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  aria-pressed={member}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-(--ap-raised)"
                >
                  <span
                    aria-hidden
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                      member
                        ? "border-transparent bg-(--ap-accent) text-[#0d1420]"
                        : "border-(--ap-line-strong)"
                    }`}
                  >
                    {member && <Check size={12} strokeWidth={3} />}
                  </span>
                  <Folder
                    size={15}
                    aria-hidden
                    style={{ color: folderDot(f.color) }}
                    className="shrink-0"
                  />
                  <span className="truncate">{f.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !creating && (
          <p className="px-3 py-3 text-xs text-(--ap-muted)">
            Nie masz jeszcze folderów.
          </p>
        )
      )}

      {creating ? (
        <div className="border-t border-(--ap-line) p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            maxLength={40}
            placeholder="Nazwa folderu"
            className="mb-2.5 w-full rounded-md border border-(--ap-line-strong) bg-(--ap-bg) px-2.5 py-1.5 text-sm focus:border-(--ap-accent) focus:outline-none"
          />
          <div className="mb-2.5">
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {error && <p className="mb-2 text-xs text-(--ap-danger)">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={create}
              className="rounded-md bg-(--ap-accent) px-2.5 py-1 text-xs font-medium text-[#0d1420] disabled:opacity-50"
            >
              Utwórz i dodaj
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="rounded-md px-2.5 py-1 text-xs text-(--ap-muted) hover:text-(--ap-text)"
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2.5 border-t border-(--ap-line) px-3 py-2 text-left text-sm text-(--ap-accent) transition-colors hover:bg-(--ap-raised)"
        >
          {list.length > 0 ? (
            <Plus size={15} aria-hidden />
          ) : (
            <FolderPlus size={15} aria-hidden />
          )}
          Nowy folder
        </button>
      )}
    </div>
  );
}
