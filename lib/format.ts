/**
 * Polish date/size formatting for the admin panel. Server components render
 * these once per request, so relative phrasing carries no hydration risk.
 */

// Pin the zone: the VPS may well run TZ=UTC, and an unpinned formatter would
// then print every timestamp 1–2h off Polish local time (and shift the date
// across the midnight boundary). The site's audience is Polish; so is the clock.
const TZ = "Europe/Warsaw";

const dateTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("pl-PL", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Warsaw-local calendar-day ordinal, so "wczoraj" means the previous DATE. */
const dayParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayNumber = (ms: number) =>
  Math.floor(Date.parse(`${dayParts.format(new Date(ms))}T00:00:00Z`) / 86_400_000);

export const formatDateTime = (ms: number) => dateTime.format(new Date(ms));

/** List-friendly: recent items say how recent, older ones just date themselves. */
export function formatWhen(ms: number, now = Date.now()): string {
  const min = Math.floor((now - ms) / 60_000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 12) return `${h} godz. temu`;
  // Past ~12h, calendar date reads truer than an hour count: "wczoraj" is the
  // day before today's DATE, not merely 24–48h ago.
  const dayDelta = dayNumber(now) - dayNumber(ms);
  if (dayDelta <= 0) return `${h} godz. temu`;
  if (dayDelta === 1) return "wczoraj";
  if (dayDelta < 7) return `${dayDelta} dni temu`;
  return dateOnly.format(new Date(ms));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
