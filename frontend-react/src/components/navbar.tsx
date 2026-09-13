import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/contexts/auth.context";
import { m } from "../paraglide/messages.js";
import { LocaleSwitcher } from "./locale-switcher";
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

        {/* desktop links */}
        <div className={styles.links}>
          <Link to="/ranking" className={styles.link}>
            { m.nav_ranking() }
          </Link>
          { user && (
            <Link to="/play" className={styles.link}>
              { m.nav_play() }
            </Link>
          ) }
        </div>

        <div className={styles.right}>
          <LocaleSwitcher />

          { user ? (
            <>
              { player && (
                <span className={styles.xp}>
                  <span className={styles.xpDot} />
                  { player.xp } XP
                </span>
              ) }
              <span className={styles.nick}>
                { player?.nickname ?? user.email }
              </span>
              {/* desktop only */}
              <button className="btn ghost" onClick={ handleLogout }>
                { m.nav_logout() }
              </button>
            </>
          ) : (
            <>
              {/* desktop only */}
              <Link to="/auth/login" className="btn ghost">
                { m.nav_login() }
              </Link>
              <Link to="/auth/signup" className="btn">
                { m.nav_signup() }
              </Link>
            </>
          ) }

          <button
            className={ `${styles.hamburger} ${open ? styles.open : ""}` }
            onClick={ () => setOpen((v) => !v) }
            aria-label={ m.nav_menu() }
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* mobile drawer */}
      <div className={ `${styles.drawer} ${open ? styles.open : ""}` }>
        <Link
          to="/ranking"
          className={styles.drawerLink}
          onClick={ () => setOpen(false) }
        >
          { m.nav_ranking() }
        </Link>
        { user && (
          <Link
            to="/play"
            className={styles.drawerLink}
            onClick={ () => setOpen(false) }
          >
            { m.nav_play() }
          </Link>
        ) }
        { user ? (
          <button className={styles.drawerLogout} onClick={ handleLogout }>
            { m.nav_logout() }
          </button>
        ) : (
          <>
            <Link
              to="/auth/login"
              className={styles.drawerLink}
              onClick={ () => setOpen(false) }
            >
              { m.nav_login() }
            </Link>
            <Link
              to="/auth/signup"
              className={styles.drawerLink}
              onClick={ () => setOpen(false) }
            >
              { m.nav_signup() }
            </Link>
          </>
        ) }
      </div>
    </>
  );
}
