import { useFetch } from "../../../hooks/use-fetch";
import styles from "../play-page.module.css";

export default function OnlinePlayersCount() {
  const { data: { data: onlineCount } = { data: null } } = useFetch(
    "/players/public/online-count"
  );
  return (
    <div className={styles.statusBar}>
      <p className={styles.statusText}>
        {onlineCount
          ? `${onlineCount.count} Online Player${onlineCount.count > 1 ? "s" : ""}`
          : ""}
      </p>
    </div>
  );
}
