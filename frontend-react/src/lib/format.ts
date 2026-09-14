import { getLocale } from "../paraglide/runtime.js";

/** Numbers follow the UI language rather than the browser's, so an English reader is not shown `1.234` for an XP total. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}

/** Dates follow the UI language too. `medium` keeps a match row to a day, a month and a year. */
export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
    new Date(value)
  );
}
