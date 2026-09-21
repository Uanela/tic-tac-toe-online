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

export function formatRelative(value: string | Date): string {
  const format = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" });
  let amount = (new Date(value).getTime() - Date.now()) / 1000;

  for (const [unit, step] of RELATIVE_STEPS) {
    if (Math.abs(amount) < step) return format.format(Math.round(amount), unit);
    amount /= step;
  }

  return format.format(Math.round(amount), "year");
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.34524],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** mm:ss. Whole seconds in, so each caller keeps its own rounding. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
