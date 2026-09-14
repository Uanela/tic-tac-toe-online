import { useFetch } from "../../../hooks/use-fetch";
import styles from "../play-page.module.css";

export default function OnlinePlayersCount() {
  const { data: { count } = { data: null } } = useFetch(
    "/players/public/online",
  );

  return (
    <div className={styles.statusBar}>
      <p className={styles.statusText}>
        {count ? "Diversos Jogadores Online" : ""}
      </p>
    </div>
  );
}

