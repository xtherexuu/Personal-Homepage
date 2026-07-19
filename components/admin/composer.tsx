"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { useRouter } from "next/navigation";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Redo2,
  Send,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";

import {
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from "@/lib/attachment-limits";
import { editorExtensions } from "@/lib/editor-extensions";
import { formatBytes } from "@/lib/format";

/**
 * The reply composer — a paper sheet on the desk. The editor edits a Tiptap
 * document; SUBMIT sends the raw JSON doc (never HTML) plus files to
 * /api/admin/reply, where the server regenerates, sanitizes and mails it.
 * Client-side checks here exist purely for friendly messages — the server
 * re-validates everything.
 */

const STATUS_MESSAGES: Record<number, string> = {
  400: "Wiadomość jest pusta lub nieprawidłowa.",
  401: "Sesja wygasła — odśwież stronę i zaloguj się ponownie.",
  404: "Ta wiadomość już nie istnieje.",
  413: "Załączniki są zbyt duże (limit 8 MB na plik, 15 MB łącznie).",
  415: "Ten typ pliku nie jest obsługiwany.",
  500: "Wysyłka nie powiodła się po stronie serwera — spróbuj ponownie.",
};

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-35 ${
        active
          ? "bg-neutral-800 text-white"
          : "text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => (
  <span aria-hidden className="mx-1 h-5 w-px self-center bg-(--ap-paper-line)" />
);

export function Composer({
  messageId,
  email,
  defaultSubject,
  initialDoc,
}: {
  messageId: number;
  email: string;
  defaultSubject: string;
  initialDoc: object;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState(defaultSubject);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const editor = useEditor({
    extensions: editorExtensions(),
    content: initialDoc,
    // Required in Next.js — SSR would otherwise throw a hydration error.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap px-6 py-5 text-[15px] leading-relaxed",
        "aria-label": "Treść odpowiedzi",
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            blockquote: e.isActive("blockquote"),
            link: e.isActive("link"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  /* ------------------------------ attachments ------------------------------ */

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setFileError(`Maksymalnie ${MAX_FILES} załączników.`);
        break;
      }
      if (f.size === 0) {
        setFileError(`„${f.name}” jest pusty.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFileError(`„${f.name}” przekracza 8 MB.`);
        continue;
      }
      const total = next.reduce((s, x) => s + x.size, 0) + f.size;
      if (total > MAX_TOTAL_BYTES) {
        setFileError("Łączny rozmiar załączników przekracza 15 MB.");
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = "";
  }

  /* --------------------------------- links --------------------------------- */

  function applyLink() {
    const raw = linkHref.trim();
    if (!raw || !editor) return;
    const href = /^(https?:\/\/|mailto:)/i.test(raw) ? raw : `https://${raw}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
    setLinkHref("");
  }

  /* ---------------------------------- send ---------------------------------- */

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!editor || sending) return;
    setSending(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("messageId", String(messageId));
      fd.set("subject", subject);
      fd.set("doc", JSON.stringify(editor.getJSON()));
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/admin/reply", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        setResult({ ok: true, text: `Wysłano odpowiedź do ${email}.` });
        setFiles([]);
        // Reset to the ORIGINAL quoted document, not a blank one: a second
        // reply should still open with the client's message quoted, the way it
        // did the first time (router.refresh() alone won't re-seed the editor —
        // useEditor reads `content` once).
        editor.commands.setContent(initialDoc);
        setSubject(defaultSubject);
        router.refresh();
      } else {
        setResult({
          ok: false,
          text:
            STATUS_MESSAGES[res.status] ??
            "Nie udało się wysłać odpowiedzi — spróbuj ponownie.",
        });
      }
    } catch {
      setResult({ ok: false, text: "Brak połączenia — spróbuj ponownie." });
    } finally {
      setSending(false);
    }
  }

  /* --------------------------------- render --------------------------------- */

  // A chain is single-use — mint a fresh one per click, never share one.
  const c = () => editor?.chain().focus();

  return (
    <form
      onSubmit={send}
      className="ap-sheet overflow-hidden rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
    >
      <p className="border-b border-(--ap-paper-line) px-6 py-3 font-mono text-xs text-neutral-500">
        Do:{" "}
        <span className="text-neutral-800 select-all">{email}</span>
      </p>

      <label className="block border-b border-(--ap-paper-line)">
        <span className="sr-only">Temat</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={180}
          required
          placeholder="Temat"
          className="w-full bg-transparent px-6 py-3 font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
      </label>

      <div
        role="toolbar"
        aria-label="Formatowanie"
        className="flex flex-wrap items-center gap-0.5 border-b border-(--ap-paper-line) px-3 py-1.5"
      >
        <ToolbarButton label="Pogrubienie" active={state?.bold} onClick={() => c()?.toggleBold().run()}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton label="Kursywa" active={state?.italic} onClick={() => c()?.toggleItalic().run()}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton label="Podkreślenie" active={state?.underline} onClick={() => c()?.toggleUnderline().run()}>
          <Underline size={16} />
        </ToolbarButton>
        <ToolbarButton label="Przekreślenie" active={state?.strike} onClick={() => c()?.toggleStrike().run()}>
          <Strikethrough size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Nagłówek 1" active={state?.h1} onClick={() => c()?.toggleHeading({ level: 1 }).run()}>
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Nagłówek 2" active={state?.h2} onClick={() => c()?.toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Nagłówek 3" active={state?.h3} onClick={() => c()?.toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Lista punktowana" active={state?.bulletList} onClick={() => c()?.toggleBulletList().run()}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton label="Lista numerowana" active={state?.orderedList} onClick={() => c()?.toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton label="Cytat" active={state?.blockquote} onClick={() => c()?.toggleBlockquote().run()}>
          <Quote size={16} />
        </ToolbarButton>

        <Divider />

        {state?.link ? (
          <ToolbarButton label="Usuń link" active onClick={() => c()?.unsetLink().run()}>
            <Link2Off size={16} />
          </ToolbarButton>
        ) : (
          <ToolbarButton label="Wstaw link" active={linkOpen} onClick={() => setLinkOpen((v) => !v)}>
            <Link2 size={16} />
          </ToolbarButton>
        )}

        <Divider />

        <ToolbarButton label="Cofnij" disabled={!state?.canUndo} onClick={() => c()?.undo().run()}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Ponów" disabled={!state?.canRedo} onClick={() => c()?.redo().run()}>
          <Redo2 size={16} />
        </ToolbarButton>
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-(--ap-paper-line) bg-[#f6f4ef] px-6 py-2">
          <input
            value={linkHref}
            onChange={(e) => setLinkHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            placeholder="https://…"
            aria-label="Adres linku"
            className="w-full bg-transparent font-mono text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white"
          >
            Wstaw
          </button>
        </div>
      )}

      <div className="min-h-48">
        <EditorContent editor={editor} />
      </div>

      {(files.length > 0 || fileError) && (
        <div className="border-t border-(--ap-paper-line) px-6 py-3">
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-(--ap-paper-line) bg-[#f4f2ed] px-2.5 py-1 font-mono text-xs text-neutral-700"
                >
                  <Paperclip size={12} aria-hidden />
                  {f.name}
                  <span className="text-neutral-400">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    aria-label={`Usuń załącznik ${f.name}`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="ml-0.5 rounded text-neutral-400 transition-colors hover:text-neutral-800"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileError && (
            <p role="alert" className="mt-2 text-sm text-[#c2412f]">
              {fileError}
            </p>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-(--ap-paper-line) bg-[#f6f4ef] px-6 py-3">
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-(--ap-paper-line) px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
        >
          <Paperclip size={15} aria-hidden />
          Dodaj załącznik
        </button>

        {result && (
          <p
            role="status"
            className={`text-sm ${result.ok ? "text-[#1e7d54]" : "text-[#c2412f]"}`}
          >
            {result.text}
          </p>
        )}

        <button
          type="submit"
          disabled={sending || !editor}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          <Send size={15} aria-hidden />
          {sending ? "Wysyłanie…" : "Wyślij odpowiedź"}
        </button>
      </footer>
    </form>
  );
}
