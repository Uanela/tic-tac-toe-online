import { useEffect, useRef } from "react";
import { Link } from "../../components/link";
import { useSound } from "../../utils/contexts/sound.context";
import { m } from "../../paraglide/messages.js";
import styles from "./settings-page.module.css";

/** Long enough to swallow a drag's worth of `input` events, short enough to feel live. */
const PREVIEW_DEBOUNCE_MS = 160;

export default function SettingsPage() {
  const sound = useSound();
  const previewTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    };
  }, []);

  function schedulePreview(run: () => void) {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(run, PREVIEW_DEBOUNCE_MS);
  }

  return (
    <div className={ styles.page }>
      <div className={ styles.header }>
        <h1>{ m.settings_title() }</h1>
        <p>{ m.settings_sub() }</p>
      </div>

      <section className={ styles.section }>
        <div className={ styles.sectionTitle }>{ m.settings_sound_title() }</div>
        <div className={ styles.sectionSub }>{ m.settings_sound_sub() }</div>

        <SliderRow
          label={ m.settings_master() }
          value={ sound.master }
          disabled={ sound.muted }
          onChange={ (value) => sound.setMaster(value) }
        />
        <SliderRow
          label={ m.settings_music() }
          value={ sound.music }
          disabled={ sound.muted }
          onChange={ (value) => {
            sound.setMusic(value);
            schedulePreview(() => sound.previewMusic());
          } }
        />
        <SliderRow
          label={ m.settings_sfx() }
          value={ sound.sfx }
          disabled={ sound.muted }
          onChange={ (value) => {
            sound.setSfx(value);
            schedulePreview(() => sound.playMove("X"));
          } }
        />

        <div className={ styles.row }>
          <span className={ styles.rowLabel }>{ m.settings_mute() }</span>
          <span className={ styles.rowHint }>{ m.settings_mute_hint() }</span>
          <label className={ styles.switch }>
            <input
              type="checkbox"
              checked={ sound.muted }
              onChange={ (e) => sound.setMuted(e.target.checked) }
              aria-label={ m.settings_mute() }
            />
            <span className={ styles.track } />
          </label>
        </div>
      </section>

      <section className={ styles.section }>
        <div className={ styles.sectionTitle }>
          { m.settings_notifications_title() }
        </div>
        <div className={ styles.sectionSub }>
          { m.settings_notifications_hint() }
        </div>

        <Link to="/settings/notifications" className={ styles.linkRow }>
          <span className={ styles.linkLabel }>
            { m.settings_notifications_link() }
          </span>
          <span className={ styles.linkArrow } aria-hidden="true">
            →
          </span>
        </Link>
      </section>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  /** 0–1, the stored form; the row presents it as a percentage. */
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, disabled, onChange }: SliderRowProps) {
  const percent = Math.round(value * 100);

  return (
    <label className={ styles.row }>
      <span className={ styles.rowLabel }>{ label }</span>
      <input
        className={ styles.slider }
        type="range"
        min={ 0 }
        max={ 100 }
        step={ 1 }
        value={ percent }
        disabled={ disabled }
        onChange={ (e) => onChange(Number(e.target.value) / 100) }
        aria-label={ label }
      />
      <span className={ styles.rowValue }>{ percent }%</span>
    </label>
  );
}
