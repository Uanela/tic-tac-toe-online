import { useFetch } from "../../../hooks/use-fetch";
import { m } from "../../../paraglide/messages.js";
import styles from "../play-page.module.css";

export default function OnlinePlayersCount() {
  const { data: { count } = { data: null } } = useFetch(
    "/players/public/online"
  );

  return (
    <div className={styles.statusBar}>
      <p className={styles.statusText}>
        {count ? m.online_count({ count }) : ""}
      </p>
    </div>
  );
}
