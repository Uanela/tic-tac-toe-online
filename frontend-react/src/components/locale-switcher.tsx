import { m } from "../paraglide/messages.js";
import { locales, type Locale } from "../paraglide/runtime.js";
import { useLocale } from "../utils/contexts/locale.context";
import { Button } from "./button";
import styles from "./locale-switcher.module.css";

/** Locale codes are their own labels — no translation, so they stay legible. */
const LABELS: Record<Locale, string> = { pt: "PT", en: "EN" };

export function LocaleSwitcher() {
  const { locale, changeLocale } = useLocale();

  return (
    <div className={styles.switcher} role="group" aria-label={m.locale_switch()}>
      {locales.map((option) => (
        <Button
          key={option}
          type="button"
          className={`${styles.option} ${option === locale ? styles.active : ""}`}
          aria-pressed={option === locale}
          onClick={() => changeLocale(option)}
        >
          {LABELS[option]}
        </Button>
      ))}
    </div>
  );
}
