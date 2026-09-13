import { useEffect, useRef, useState } from "react";

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>(null);
  const [interval, setInt] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (interval) interval?.refresh?.();
    if (delay === null || delay === undefined || delay <= 0) return;

    const id = setInterval(() => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }, delay);
    setInt(id);

    return () => clearInterval(id);
  }, [delay]);

  return { interval };
}

export default useInterval;
