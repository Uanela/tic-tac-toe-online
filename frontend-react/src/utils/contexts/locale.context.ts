import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getLocale, setLocale, type Locale } from "../../paraglide/runtime.js";

export interface LocaleContextValue {
  locale: Locale;
  changeLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Owns the active locale. Call this in `App` rather than in a provider component:
 * a locale change has to re-render the tree, and Paraglide keeps the locale
 * outside React, so nothing re-renders on its own. Holding the state above the
 * router means every message call below it is re-evaluated, which lets components
 * read `m.*()` directly instead of subscribing to a context.
 */
export function useLocaleState(): LocaleContextValue {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  const changeLocale = useCallback((next: Locale) => {
    // `reload: false` is what keeps a game in progress alive across a switch —
    // Paraglide's default is a full document navigation. Its docs allow the escape
    // hatch for a client-rendered surface that owns its own state, and warn against
    // it only where the locale lives in the URL. This app has no `url` strategy, so
    // `/play?inviteId=…` survives untouched.
    setLocale(next, { reload: false });
    setLocaleState(next);
  }, []);

  // The document's own locale, so assistive tech and hyphenation follow the UI.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return { locale, changeLocale };
}

/**
 * The locale, for the few places that need to know it rather than just render a
 * message — the switcher's active state, and number formatting. Everything else
 * should call `m.*()` and rely on the re-render `useLocaleState` causes.
 */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleContext.Provider>");
  return value;
}
