import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type ToastVariant = "info" | "success" | "error" | "invite";

export interface ToastAction {
  label: string;
  onClick: () => void;
  emphasis?: "primary" | "ghost";
}

export interface ToastOptions {
  /** Left out when the content is a server message, so the toast carries the variant's own word. */
  title?: string;
  /** A node, not a string, so a caller can pass `<RichText parts={...} />`. */
  description?: ReactNode;
  variant?: ToastVariant;
  actions?: ToastAction[];
  /** Milliseconds on screen. `0` keeps the toast up until an action or the countdown ends it. */
  duration?: number;
  /** Epoch ms to count down to. Also drives the ring and holds the toast open. */
  expiresAt?: number;
  /** Showing a second toast under the same key replaces the first instead of stacking. */
  key?: string;
}

export interface ToastEntry extends ToastOptions {
  id: number;
  /** Captured at show time, because progress needs the span and `expiresAt` alone is only an end. */
  totalMs?: number;
}

export type ToastRef = string | number;

export interface ToastApi {
  show: (options: ToastOptions) => void;
  dismiss: (ref: ToastRef) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
