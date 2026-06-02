import { useEffect } from "react";
import styles from "./toast.module.css";

interface ToastProps {
  message: string;
  onDone: () => void;
  duration?: number;
}

export function Toast({ message, onDone, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message]);

  return <div className={styles.toast}>{message}</div>;
}
