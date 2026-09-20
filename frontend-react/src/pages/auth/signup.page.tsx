import { useState, type FormEvent } from "react";
import { useAuth } from "../../utils/contexts/auth.context";
import { m } from "../../paraglide/messages.js";
import { Button } from "../../components/button";
import { errorMessage } from "../../lib/api";
import { RichText } from "../../components/rich-text";
import {
  NICKNAME_MAX_LENGTH,
  NicknameSchema,
  normalizeNickname,
} from "../../lib/nickname";
import styles from "./auth.module.css";

export default function SignupPage() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = NicknameSchema.safeParse(nickname);
    if (!parsed.success) {
      setError(m.auth_nickname_invalid());
      return;
    }

    setLoading(true);
    try {
      // The parsed value, not the raw one: it is the normalized spelling the
      // backend stores, so what the form showed is what the player gets.
      await signup({ email, password, player: { nickname: parsed.data } });
      window.location.href = "/play";
    } catch (err) {
      setError(errorMessage(err, m.auth_signup_failed()));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.heading}>
          <h1>{m.auth_signup_title()}</h1>
          <p>{m.auth_signup_sub()}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>{m.auth_nickname()}</label>
            <input
              className="input"
              type="text"
              placeholder="shadow_knight"
              maxLength={NICKNAME_MAX_LENGTH}
              value={nickname}
              onChange={(e) => setNickname(normalizeNickname(e.target.value))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <p className={styles.hint}>{m.auth_nickname_hint()}</p>
          </div>

          <div className={styles.field}>
            <label>{m.auth_email()}</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label>{m.auth_password()}</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <Button className="btn" type="submit" disabled={loading}>
            {loading ? m.auth_signup_loading() : m.auth_signup_submit()}
          </Button>
        </form>

        <p className={styles.footer}>
          <RichText parts={m.auth_signup_footer.parts({})} />
        </p>
      </div>
    </div>
  );
}

