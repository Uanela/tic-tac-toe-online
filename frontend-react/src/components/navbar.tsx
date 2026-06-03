import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/contexts/auth.context";
import styles from "./navbar.module.css";

export function Navbar() {
  const { user, player, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
    setOpen(false);
  }

  return (
    <>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <span className={styles.x}>X</span>
          <span className={styles.sep}>vs</span>
          <span className={styles.o}>O</span>
        </Link>

        <div className={styles.right}>
          {user && player && (
            <span className={styles.xp}>
              <span className={styles.xpDot} />
              {player.xp} XP
            </span>
          )}
          {user && (
            <span className={styles.nick}>
              {player?.nickname ?? user.email}
            </span>
          )}
          <button
            className={`${styles.hamburger} ${open ? styles.open : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div className={`${styles.drawer} ${open ? styles.open : ""}`}>
        <Link
          to="/ranking"
          className={styles.drawerLink}
          onClick={() => setOpen(false)}
        >
          Ranking
        </Link>
        {user && (
          <Link
            to="/play"
            className={styles.drawerLink}
            onClick={() => setOpen(false)}
          >
            Play
          </Link>
        )}
        {user ? (
          <button className={styles.drawerLogout} onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <>
            <Link
              to="/auth/login"
              className={styles.drawerLink}
              onClick={() => setOpen(false)}
            >
              Login
            </Link>
            <Link
              to="/auth/signup"
              className={styles.drawerLink}
              onClick={() => setOpen(false)}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </>
  );
}
