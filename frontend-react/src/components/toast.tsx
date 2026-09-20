import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Info, Swords } from "lucide-react";
import { Button } from "./button";
import { formatClock } from "../lib/format";
import { m } from "../paraglide/messages.js";
import {
  ToastContext,
  type ToastApi,
  type ToastEntry,
  type ToastOptions,
  type ToastRef,
  type ToastVariant,
} from "../utils/contexts/toast.context";
import styles from "./toast.module.css";

const DEFAULT_DURATION = 4000;
const TICK_MS = 250;

const ICONS: Record<ToastVariant, ReactNode> = {
  info: <Info size={19} />,
  success: <Check size={19} />,
  error: <AlertTriangle size={19} />,
  invite: <Swords size={19} />,
};

const TITLES: Record<ToastVariant, () => string> = {
  info: m.toast_info_title,
  success: m.toast_success_title,
  error: m.toast_error_title,
  invite: m.invite_title,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const lastId = useRef(0);

  // A ref matches on the key too, so a caller can close a toast it holds by key.
  const dismiss = useCallback((ref: ToastRef) => {
    setToasts((prev) => prev.filter((t) => t.id !== ref && t.key !== ref));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = lastId.current++;
    setToasts((prev) => [
      ...(options.key ? prev.filter((t) => t.key !== options.key) : prev),
      {
        ...options,
        id,
        totalMs: options.expiresAt
          ? Math.max(1, options.expiresAt - Date.now())
          : undefined,
      },
    ]);
  }, []);

  const value = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className={styles.viewport} role="status" aria-live="polite">
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} dismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  dismiss,
}: {
  toast: ToastEntry;
  dismiss: (ref: ToastRef) => void;
}) {
  const {
    title,
    description,
    variant = "info",
    actions,
    duration,
    expiresAt,
    totalMs,
    id,
  } = toast;

  const [remaining, setRemaining] = useState<number | null>(() =>
    expiresAt === undefined ? null : Math.max(0, expiresAt - Date.now()),
  );

  useEffect(() => {
    if (expiresAt === undefined) return;

    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));

    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const onDismiss = useCallback(() => dismiss(id), [dismiss, id]);
  const counting = remaining !== null;

  useEffect(() => {
    if (counting && remaining <= 0) onDismiss();
  }, [counting, remaining, onDismiss]);

  useEffect(() => {
    if (counting || duration === 0) return;

    const timer = setTimeout(onDismiss, duration ?? DEFAULT_DURATION);
    return () => clearTimeout(timer);
  }, [counting, duration, onDismiss]);

  const progress =
    counting && totalMs
      ? Math.max(0, Math.min(100, (remaining / totalMs) * 100))
      : 100;

  return (
    <div className={`${styles.toast} ${styles[variant]}`}>
      <div
        className={styles.badge}
        style={{ "--progress": progress } as CSSProperties}
      >
        {ICONS[variant]}
      </div>

      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.title}>{title ?? TITLES[variant]()}</span>
          {counting && (
            <span className={styles.timer}>
              {formatClock(Math.ceil(remaining / 1000))}
            </span>
          )}
        </div>

        {description && <div className={styles.description}>{description}</div>}

        {actions && actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                className={`btn ${styles.action} ${
                  action.emphasis === "ghost" ? "ghost" : ""
                }`}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

