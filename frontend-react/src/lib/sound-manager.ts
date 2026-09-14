import { Howl, Howler } from "howler";

type Bus = "music" | "sfx";

export type TrackName =
  | "bgMusic"
  | "searchingOpponent"
  | "opponentFound"
  | "changingTurn"
  | "makeMove"
  | "dimmed"
  | "clockTicking"
  | "winStrikeHighlight"
  | "win"
  | "lose"
  | "draw";

interface TrackDef {
  file: string;
  bus: Bus;
  /** Native volume multiplier applied on top of the bus. */
  gain?: number;
  loop?: boolean;
  html5?: boolean;
  /** Restarts closer together than this are dropped, so a burst cannot stack. */
  minGapMs?: number;
}

export interface SoundSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

type DuckReason = "matchFound" | "searching";

const STORAGE_KEY = "sound-settings";

const DEFAULTS: SoundSettings = { master: 1, music: 1, sfx: 1, muted: false };

/** Hard cap, not a default: the bed runs hot, so the user's 100% lands at 0.6 native. */
const MUSIC_GAIN = 0.5;

const TRACKS: Record<TrackName, TrackDef> = {
  bgMusic: {
    file: "bg-music.m4a",
    bus: "music",
    gain: MUSIC_GAIN,
    loop: true,
    // Streamed rather than decoded: long-running and looped.
    html5: true,
  },
  searchingOpponent: {
    file: "searching-opponent.m4a",
    bus: "sfx",
    loop: true,
    gain: 0.15,
  },
  opponentFound: { file: "opponent-found.m4a", bus: "sfx" },
  changingTurn: { file: "changing-turn.m4a", bus: "sfx", minGapMs: 500 },
  makeMove: { file: "make-move.m4a", bus: "sfx", minGapMs: 60 },
  dimmed: { file: "dimmed.m4a", bus: "sfx", minGapMs: 150 },
  clockTicking: { file: "clock-ticking.m4a", bus: "sfx", loop: true },
  winStrikeHighlight: { file: "win-strike-highlight.m4a", bus: "sfx" },
  win: { file: "win.m4a", bus: "sfx" },
  lose: { file: "lose.m4a", bus: "sfx" },
  draw: { file: "draw.m4a", bus: "sfx" },
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      master: clamp01(stored.master ?? DEFAULTS.master),
      music: clamp01(stored.music ?? DEFAULTS.music),
      sfx: clamp01(stored.sfx ?? DEFAULTS.sfx),
      muted: stored.muted ?? DEFAULTS.muted,
    };
  } catch {
    return DEFAULTS;
  }
}

class SoundManager {
  private settings: SoundSettings = loadSettings();
  private howls = new Map<TrackName, Howl>();
  private listeners = new Set<() => void>();
  private lastPlayed = new Map<TrackName, number>();

  /** One slot per reason: a flat value would let the match-found card lift the search duck. */
  private ducks = new Map<DuckReason, number>();
  /** Survives a pause and a dispose, so the loop comes back on its own. */
  private musicWanted = false;
  private tabHidden = false;
  private unlocked = false;

  /**
   * Arrow properties, not methods: the context hands these out as bare references,
   * and a prototype method called that way runs with `this` undefined.
   */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSettings = (): SoundSettings => this.settings;

  preload = () => {
    (Object.keys(TRACKS) as TrackName[]).forEach((name) => this.howl(name));
  };

  /** 0 while the track is still loading or not yet built. */
  durationMs = (name: TrackName): number => {
    const seconds = this.howls.get(name)?.duration();
    return seconds && Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
  };

  play = (name: TrackName, opts: { rate?: number } = {}) => {
    if (this.settings.muted) return;
    if (TRACKS[name].bus === "music") return;

    const gap = TRACKS[name].minGapMs;
    if (gap) {
      const now = Date.now();
      const last = this.lastPlayed.get(name) ?? 0;
      if (now - last < gap) return;
      this.lastPlayed.set(name, now);
    }

    const howl = this.howl(name);
    howl.volume(this.volumeFor(name));
    const id = howl.play();
    if (opts.rate) howl.rate(opts.rate, id);
  };

  /** The two marks share one sample; a small rate offset keeps them distinct. */
  playMove = (mark: "X" | "O") => {
    this.play("makeMove", { rate: mark === "X" ? 1.05 : 0.95 });
  };

  /** The loop covers the whole app, so this is asserted once by the provider. */
  startMusic = () => {
    this.musicWanted = true;
    this.resumeMusic(true);
  };

  /** The loop already runs app-wide; the slider previews itself. This only covers it never having been waved in. */
  previewMusic = () => this.resumeMusic();

  duckMusic = (reason: DuckReason, to: number) => {
    this.ducks.set(reason, clamp01(to));
    this.applyVolumes();
  };

  unduckMusic = (reason: DuckReason) => {
    this.ducks.delete(reason);
    this.applyVolumes();
  };

  /** Restarts a loop from the top, for cues whose whole meaning is their position. */
  restartLoop = (name: TrackName, { volume }: { volume?: number } = {}) => {
    const howl = this.howl(name);
    howl.stop();
    howl.volume(volume || this.volumeFor(name));
    howl.play();
  };

  stopLoop = (name: TrackName) => {
    this.howls.get(name)?.stop();
  };

  setMaster = (value: number) => {
    this.commit({ ...this.settings, master: clamp01(value) });
  };

  setMusic = (value: number) => {
    this.commit({ ...this.settings, music: clamp01(value) });
  };

  setSfx = (value: number) => {
    this.commit({ ...this.settings, sfx: clamp01(value) });
  };

  setMuted = (muted: boolean) => {
    this.commit({ ...this.settings, muted });
  };

  /** Called on the first real gesture; browsers keep the audio context suspended until then. */
  unlock = () => {
    if (this.unlocked) return;
    this.unlocked = true;
    void Howler.ctx?.resume().catch(() => {});
    this.resumeMusic();
  };

  setTabHidden = (hidden: boolean) => {
    this.tabHidden = hidden;

    if (hidden) {
      const howl = this.howls.get("bgMusic");
      if (howl?.playing()) howl.pause();
      return;
    }
    this.resumeMusic();
  };

  /** Safe from a StrictMode teardown: Howls rebuild on demand and `musicWanted` survives. */
  dispose = () => {
    this.howls.forEach((howl) => howl.unload());
    this.howls.clear();
    this.lastPlayed.clear();
  };

  private resumeMusic(musicWanted: boolean = false) {
    if (!this.unlocked || this.tabHidden || !(this.musicWanted || musicWanted))
      return;

    const howl = this.howl("bgMusic");
    howl.volume(this.volumeFor("bgMusic"));
    if (!howl.playing()) howl.play();
  }

  private howl(name: TrackName): Howl {
    const existing = this.howls.get(name);
    if (existing) return existing;

    const def = TRACKS[name];
    const howl = new Howl({
      src: [`${import.meta.env.BASE_URL}sfx/${def.file}`],
      loop: def.loop ?? false,
      html5: def.html5 ?? false,
      preload: true,
      volume: this.volumeFor(name),
    });
    this.howls.set(name, howl);
    return howl;
  }

  private musicDuck(): number {
    let duck = 1;
    this.ducks.forEach((value) => {
      duck *= value;
    });
    return duck;
  }

  private volumeFor(name: TrackName): number {
    if (this.settings.muted) return 0;

    const def = TRACKS[name];
    const bus = def.bus === "music" ? this.settings.music : this.settings.sfx;
    const duck = def.bus === "music" ? this.musicDuck() : 1;
    return this.settings.master * bus * (def.gain ?? 1) * duck;
  }

  private applyVolumes() {
    this.howls.forEach((howl, name) => howl.volume(this.volumeFor(name)));
  }

  private commit(next: SoundSettings) {
    this.settings = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode or a full quota: playback still honours the change in memory.
    }
    this.applyVolumes();
    this.listeners.forEach((listener) => listener());
  }
}

export const soundManager = new SoundManager();

