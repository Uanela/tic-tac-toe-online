import { Flag } from "lucide-react";
import { Button } from "../../../components/button";
import styles from "./leave-match-modal.module.css";

interface LeaveMatchModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The one confirmation between a live match and giving it up, whichever reason asks. */
export function LeaveMatchModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: LeaveMatchModalProps) {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.icon}>
          <Flag size={32} color="var(--error)" />
        </div>
        <div className={styles.title}>{title}</div>
        <p className={styles.body}>{body}</p>
        <div className={styles.menu}>
          <Button className="btn" onClick={onConfirm} disabled={busy}>
            <Flag size={17} />
            {confirmLabel}
          </Button>
          <Button className="btn ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
