import StarterKit from "@tiptap/starter-kit";

/**
 * ONE extension list for both sides of the composer: the client editor
 * (components/admin/composer.tsx) and the server's HTML regeneration
 * (lib/email-html.ts). Sharing the factory is what guarantees the server can
 * always render exactly the documents the editor can produce — and nothing
 * else: a doc node outside this schema makes generateHTML throw, which the
 * reply route treats as a 400.
 *
 * Directive-free on purpose; StarterKit v3 already bundles Link and Underline.
 */
export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["https", "http", "mailto"],
      },
    }),
  ];
}
