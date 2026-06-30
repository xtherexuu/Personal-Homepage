// Minimal class-name joiner. Dependency-free on purpose: this project dropped
// clsx + tailwind-merge to keep the client bundle lean, and none of our call
// sites need Tailwind conflict resolution — they only toggle non-overlapping
// classes. Filters out falsy values and joins the rest with a space.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
