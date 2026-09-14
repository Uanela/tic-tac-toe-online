import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { soundManager, type SoundSettings } from "../../lib/sound-manager";

interface SoundContextValue extends SoundSettings {
  setMaster: (value: number) => void;
  setMusic: (value: number) => void;
  setSfx: (value: number) => void;
  setMuted: (muted: boolean) => void;
  play: typeof soundManager.play;
  playMove: typeof soundManager.playMove;
  startMusic: typeof soundManager.startMusic;
  previewMusic: typeof soundManager.previewMusic;
  duckMusic: typeof soundManager.duckMusic;
  unduckMusic: typeof soundManager.unduckMusic;
  restartLoop: typeof soundManager.restartLoop;
  stopLoop: typeof soundManager.stopLoop;
  durationMs: typeof soundManager.durationMs;
}

const SoundContext = createContext<SoundContextValue | null>(null);

/** Owns the audio lifecycle; playback itself lives in `soundManager`. */
export function SoundProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(
    soundManager.subscribe,
    soundManager.getSettings,
    soundManager.getSettings,
  );

  useEffect(() => {
    const onGesture = () => {
      soundManager.unlock();
      soundManager.startMusic();
    };

    const onVisibility = () => soundManager.setTabHidden(document.hidden);

    document.addEventListener("pointerdown", onGesture);
    document.addEventListener("keydown", onGesture);
    document.addEventListener("touchstart", onGesture);

    document.addEventListener("visibilitychange", onVisibility);

    soundManager.preload();
    soundManager.startMusic();

    soundManager.setTabHidden(document.hidden);

    return () => {
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("keydown", onGesture);
      document.removeEventListener("touchstart", onGesture);
      document.removeEventListener("visibilitychange", onVisibility);
      soundManager.dispose();
    };
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      ...settings,
      setMaster: soundManager.setMaster,
      setMusic: soundManager.setMusic,
      setSfx: soundManager.setSfx,
      setMuted: soundManager.setMuted,
      play: soundManager.play,
      playMove: soundManager.playMove,
      startMusic: soundManager.startMusic,
      previewMusic: soundManager.previewMusic,
      duckMusic: soundManager.duckMusic,
      unduckMusic: soundManager.unduckMusic,
      restartLoop: soundManager.restartLoop,
      stopLoop: soundManager.stopLoop,
      durationMs: soundManager.durationMs,
    }),
    [settings],
  );

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound() {
  const value = useContext(SoundContext);
  if (!value) throw new Error("useSound must be used inside <SoundProvider>");
  return value;
}

