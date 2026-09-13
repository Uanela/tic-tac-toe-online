import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../utils/contexts/auth.context";
import { api } from "../../lib/api";
import { m } from "../../paraglide/messages.js";
import styles from "./notification-preferences-page.module.css";

type NotificationCategory =
  | "Challenge"
  | "MorningDailyRemainder"
  | "AfternoonDailyRemainder"
  | "NightDailyRemainder"
  | "Annoucements";

type NotificationStatus = "Never" | "Once" | "Twice" | "Thrice" | "Always";

interface PreferenceRow {
  id: string;
  category: NotificationCategory;
  status: NotificationStatus;
}

/** Absent until the row is first written, which is what marks it a create. */
type LocalRow = { id?: string; status: NotificationStatus; };

type Preferences = Partial<Record<NotificationCategory, LocalRow>>;

interface MeResponse {
  data: {
    player: {
      id: string;
      settings: { id: string; notificationPreferences: PreferenceRow[]; } | null;
    } | null;
  };
}

const CATEGORIES: NotificationCategory[] = [
  "Challenge",
  "MorningDailyRemainder",
  "AfternoonDailyRemainder",
  "NightDailyRemainder",
  "Annoucements",
];

const STATUSES: NotificationStatus[] = [
  "Never",
  "Once",
  "Twice",
  "Thrice",
  "Always",
];

// The backend reads an absent row as allowed, so showing "Never" would misrepresent
// the setting — and silently change behaviour on the first save.
const DEFAULT_STATUS: NotificationStatus = "Always";

function categoryLabel(category: NotificationCategory): string {
  switch (category) {
    case "Challenge":
      return m.notifications_category_challenge();
    case "MorningDailyRemainder":
      return m.notifications_category_morning();
    case "AfternoonDailyRemainder":
      return m.notifications_category_afternoon();
    case "NightDailyRemainder":
      return m.notifications_category_night();
    case "Annoucements":
      return m.notifications_category_announcements();
  }
}

function statusLabel(status: NotificationStatus): string {
  switch (status) {
    case "Never":
      return m.notifications_status_never();
    case "Once":
      return m.notifications_status_once();
    case "Twice":
      return m.notifications_status_twice();
    case "Thrice":
      return m.notifications_status_thrice();
    case "Always":
      return m.notifications_status_always();
  }
}

function toPreferences(rows: PreferenceRow[]): Preferences {
  return Object.fromEntries(
    CATEGORIES.map((category) => {
      const existing = rows.find((row) => row.category === category);
      return [
        category,
        existing
          ? { id: existing.id, status: existing.status }
          : { status: DEFAULT_STATUS },
      ];
    })
  );
}

export default function NotificationPreferencesPage() {
  const { user } = useAuth();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current !== null) clearTimeout(savedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get<MeResponse>("/users/me");
        if (cancelled) return;

        const player = res.data.player;
        if (!player) {
          setFailed(true);
          return;
        }
        // `PATCH /users/me` carries the settings id and nothing a player may call
        // creates the row, so without one there is nowhere to store a preference.
        if (!player.settings) {
          setUnavailable(true);
          return;
        }

        setPlayerId(player.id);
        setSettingsId(player.settings.id);
        setPreferences(toPreferences(player.settings.notificationPreferences));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  function flashSaved() {
    setSaveState("saved");
    if (savedTimer.current !== null) clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1600);
  }

  async function handleChange(
    category: NotificationCategory,
    next: NotificationStatus
  ) {
    const current = preferences[category];
    if (!playerId || !settingsId || !current) return;

    setPreferences((prev) => ({ ...prev, [category]: { ...current, status: next } }));
    setSaveState("saving");

    try {
      // The nested write only touches the rows it names, so one category leaves the
      // rest alone, and the id is what separates an update from a create.
      await api.patch<MeResponse>("/users/me", {
        player: {
          id: playerId,
          settings: {
            id: settingsId,
            notificationPreferences: [
              {
                ...(current.id ? { id: current.id } : {}),
                category,
                status: next,
              },
            ],
          },
        },
      });

      const res = await api.get<MeResponse>("/users/me");
      const rows = res.data.player?.settings?.notificationPreferences;
      if (rows) setPreferences(toPreferences(rows));
      flashSaved();
    } catch {
      setPreferences((prev) => ({ ...prev, [category]: current }));
      setSaveState("error");
    }
  }

  if (!user) {
    return (
      <div className={ styles.gate }>
        <h2>{ m.notifications_gate_title() }</h2>
        <p>{ m.notifications_gate_sub() }</p>
        <div className={ styles.gateCta }>
          <Link to="/auth/login" className="btn">
            { m.nav_login() }
          </Link>
          <Link to="/auth/signup" className="btn ghost">
            { m.nav_signup() }
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={ styles.page }>
      <div className={ styles.header }>
        <h1>{ m.notifications_title() }</h1>
        <p>{ m.notifications_sub() }</p>
      </div>

      <section className={ styles.section }>
        { failed && <p className={ styles.loadError }>{ m.notifications_failed() }</p> }

        { !failed && unavailable && (
          <p className={ styles.loadError }>{ m.notifications_unavailable() }</p>
        ) }

        { !failed &&
          CATEGORIES.map((category) => (
            <div key={ category } className={ styles.row }>
              <span className={ styles.rowLabel }>{ categoryLabel(category) }</span>
              <select
                className={ styles.select }
                value={ preferences[category]?.status ?? DEFAULT_STATUS }
                disabled={ loading || unavailable || saveState === "saving" }
                onChange={ (e) =>
                  handleChange(category, e.target.value as NotificationStatus)
                }
                aria-label={ `${categoryLabel(category)} — ${m.notifications_frequency()}` }
              >
                { STATUSES.map((status) => (
                  <option key={ status } value={ status }>
                    { statusLabel(status) }
                  </option>
                )) }
              </select>
            </div>
          )) }
      </section>

      <div className={ styles.footer }>
        <span
          className={ [
            styles.saveState,
            saveState === "saved" ? styles.saveSaved : "",
            saveState === "error" ? styles.saveError : "",
          ]
            .filter(Boolean)
            .join(" ") }
        >
          { saveState === "saving" && m.notifications_saving() }
          { saveState === "saved" && m.notifications_saved() }
          { saveState === "error" && m.notifications_failed() }
        </span>
        <Link to="/settings" className={ styles.back }>
          { m.notifications_back() }
        </Link>
      </div>
    </div>
  );
}
