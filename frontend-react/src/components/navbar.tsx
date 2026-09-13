import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGateway } from "@arkosjs/react-websockets";
import { useAuth } from "../utils/contexts/auth.context";
import { m } from "../paraglide/messages.js";
import { Button } from "./button";
import { Link } from "./link";
import { LocaleSwitcher } from "./locale-switcher";
import styles from "./navbar.module.css";

export function Navbar() {
  const { user, player, logout } = useAuth();
  const navigate = useNavigate();
  const game = useGateway("/tic-tac-toe");
  const [open, setOpen] = useState(false);
  const nickname = player?.nickname ?? user?.email;
  const online = game.status === "connected";

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
          <Link to="/" className={styles.link}>
            { m.nav_home() }
          </Link>
          <Link to="/ranking" className={styles.link}>
            { m.nav_ranking() }
          </Link>
          { user && (
            <Link to="/play" className={styles.link}>
              { m.nav_play() }
            </Link>
          ) }
          <Link to="/settings" className={styles.link}>
            { m.nav_settings() }
          </Link>
        </div>

        <div className={styles.right}>
          <div className={styles.barLocale}>
            <LocaleSwitcher />
          </div>

          { user ? (
            <>
              { player && (
                <span className={styles.xp}>
                  <span className={styles.xpDot} />
                  { player.xp } XP
                </span>
              ) }
              <span className={`${styles.conn} ${online ? styles.connOn : styles.connOff}`}>
                <span className={styles.connDot} />
                { online ? m.nav_conn_on() : m.nav_conn_off() }
              </span>
              <span className={styles.nick}>
                { nickname }
              </span>
              {/* desktop only */}
              <Button className="btn ghost" onClick={ handleLogout }>
                { m.nav_logout() }
              </Button>
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

          <Button
            className={ `${styles.hamburger} ${open ? styles.open : ""}` }
            onClick={ () => setOpen((v) => !v) }
            aria-label={ m.nav_menu() }
          >
            <span />
            <span />
            <span />
          </Button>
        </div>
      </nav>

      {/* mobile drawer */}
      <div className={ `${styles.drawer} ${open ? styles.open : ""}` }>
        <Link
          to="/"
          className={styles.drawerLink}
          onClick={ () => setOpen(false) }
        >
          { m.nav_home() }
        </Link>
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
        <Link
          to="/settings"
          className={styles.drawerLink}
          onClick={ () => setOpen(false) }
        >
          { m.nav_settings() }
        </Link>
        <div className={styles.drawerAccount}>
          { user && <span className={styles.drawerNick}>{ nickname }</span> }
          <LocaleSwitcher />
        </div>
        { user ? (
          <Button className={styles.drawerLogout} onClick={ handleLogout }>
            { m.nav_logout() }
          </Button>
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
