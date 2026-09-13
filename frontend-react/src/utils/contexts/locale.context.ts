import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getLocale, setLocale, type Locale } from "../../paraglide/runtime.js";

export interface LocaleContextValue {
  locale: Locale;
  changeLocale: (next: Locale) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Call in `App`, not a provider: Paraglide keeps the locale outside React, so only state above the router re-renders the `m.*()` calls below it. */
export function useLocaleState(): LocaleContextValue {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  const changeLocale = useCallback((next: Locale) => {
    // `reload: false` keeps a game in progress alive — Paraglide's default is a full document navigation.
    setLocale(next, { reload: false });
    setLocaleState(next);
  }, []);

  // The document's own locale, so assistive tech and hyphenation follow the UI.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return { locale, changeLocale };
}

/** For the few callers that need the locale itself, like the switcher and number formatting — everything else should call `m.*()`. */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleContext.Provider>");
  return value;
}
