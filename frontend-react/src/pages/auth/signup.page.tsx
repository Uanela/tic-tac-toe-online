import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/contexts/auth.context";
import { m } from "../../paraglide/messages.js";
import { RichText } from "../../components/rich-text";
import styles from "./auth.module.css";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup({ email, password, player: { nickname } });
      navigate("/play");
    } catch (err: any) {
      setError(err.message || m.auth_signup_failed());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={ styles.page }>
      <div className={ styles.card }>
        <div className={ styles.heading }>
          <h1>{ m.auth_signup_title() }</h1>
          <p>{ m.auth_signup_sub() }</p>
        </div>

        <form onSubmit={ handleSubmit } className={styles.form}>
          <div className={ styles.field }>
            <label>{ m.auth_nickname() }</label>
            <input
              className="input"
              type="text"
              placeholder="ShadowKnight"
              maxLength={ 20 }
              value={ nickname }
              onChange={ (e) => setNickname(e.target.value) }
              required
            />
          </div>

          <div className={ styles.field }>
            <label>{ m.auth_email() }</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={ email }
              onChange={ (e) => setEmail(e.target.value) }
              required
            />
          </div>

          <div className={ styles.field }>
            <label>{ m.auth_password() }</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={ password }
              onChange={ (e) => setPassword(e.target.value) }
              required
            />
          </div>

          { error && <p className="error-msg">{ error }</p> }

          <button className="btn" type="submit" disabled={ loading }>
            { loading ? m.auth_signup_loading() : m.auth_signup_submit() }
          </button>
        </form>

        <p className={ styles.footer }>
          <RichText parts={ m.auth_signup_footer.parts({}) } />
        </p>
      </div>
    </div>
  );
}
