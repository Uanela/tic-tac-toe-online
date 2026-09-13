import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../utils/contexts/auth.context";
import { m } from "../paraglide/messages.js";
import styles from "./boot-screen.module.css";

/** How long the screen holds before it is allowed to lift. */
const MINIMUM_MS = 3000;
/** Where the bar waits while the app is still working behind the screen. */
const HELD_PERCENT = 95;
/** Matches the CSS transition, so the node leaves once the fade has finished. */
const FADE_MS = 450;

/**
 * The screen a full page load starts on. It covers the app rather than replacing
 * it, so the router, the session and the socket are already warm by the time it
 * fades — and it holds for a minimum stretch so a fast boot never flashes past.
 *
 * A client-side route change never remounts this, which is what keeps the
 * screen to cold starts only.
 */
export function BootScreen({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const [progress, setProgress] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    const ticker = window.setInterval(() => {
      const ratio = Math.min((performance.now() - startedAt) / MINIMUM_MS, 1);
      setProgress((previous) => Math.max(previous, ratio * 100));
      if (ratio === 1) window.clearInterval(ticker);
    }, 60);
    return () => window.clearInterval(ticker);
  }, []);

  // 100% is reserved for a session that has actually finished restoring, so the
  // bar never claims the app is ready while it is still asking who you are.
  const filled = loading ? Math.min(progress, HELD_PERCENT) : progress;
  const lifting = !loading && progress >= 100;

  useEffect(() => {
    if (!lifting) return;
    const timer = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [lifting]);

  return (
    <>
      {/* Inert while covered, so nothing behind the screen can be tabbed into. */}
      <div className={ styles.app } inert={ !gone }>
        { children }
      </div>

      { !gone && (
        <div className={ `${styles.overlay} ${lifting ? styles.lifting : ""}` }>
          <img className={ styles.logo } src="/images/arkos-icon.png" alt="" />

          <div className={ styles.bottom }>
            <span className={ styles.spinner } />
            <p className={ styles.label }>{ m.boot_loading() }</p>
            <div
              className={ styles.bar }
              role="progressbar"
              aria-label={ m.boot_loading() }
              aria-valuemin={ 0 }
              aria-valuemax={ 100 }
              aria-valuenow={ Math.round(filled) }
            >
              <span
                className={ styles.fill }
                style={ { width: `${filled}%` } }
              />
              <span className={ styles.percent }>{ Math.round(filled) }%</span>
            </div>
            <p className={ styles.credit }>{ m.boot_credit() }</p>
          </div>
        </div>
      ) }
    </>
  );
}
