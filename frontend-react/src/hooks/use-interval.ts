import { useEffect, useRef, useState } from "react";

/**
 * Custom hook for setting up an interval that properly cleans up on unmount
 * @param {Function} callback - Function to be called on each interval
 * @param {number | null} delay - Interval delay in milliseconds, null to pause
 */
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>(null);
  const [interval, setInt] = useState<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // Don't schedule if no delay is specified or if it's null
    if (interval) interval?.refresh?.();
    if (delay === null || delay === undefined || delay <= 0) return;

    const id = setInterval(() => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }, delay);
    setInt(id);

    // Cleanup on unmount or when delay changes
    return () => clearInterval(id);
  }, [delay]);

  return { interval };
}

export default useInterval;
