import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/contexts/auth.context";
import styles from "./navbar.module.css";

export function Navbar() {
  const { user, player, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className={styles.nav}>
      <Link to="/" className={styles.logo}>
        <span className={styles.x}>X</span>
        <span className={styles.sep}>vs</span>
        <span className={styles.o}>O</span>
      </Link>

      <div className={styles.links}>
        <Link to="/ranking" className={styles.link}>
          Ranking
        </Link>
        {user && (
          <Link to="/play" className={styles.link}>
            Play
          </Link>
        )}
      </div>

      <div className={styles.right}>
        {user ? (
          <>
            {player && (
              <span className={styles.xp}>
                <span className={styles.xpDot} />
                {player.xp} XP
              </span>
            )}
            <span className={styles.nick}>
              {player?.nickname ?? user.email}
            </span>
            <button className="btn ghost" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/auth/login" className="btn ghost">
              Login
            </Link>
            <Link to="/auth/signup" className="btn">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
