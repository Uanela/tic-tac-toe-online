import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { m } from "../../paraglide/messages.js";
import { Button } from "../../components/button";
import { Link } from "../../components/link";
import { RichText } from "../../components/rich-text";
import styles from "./auth.module.css";

const OTP_LENGTH = 6;

type Stage = "request" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The resend button calls this without an event, so the optional argument is what
  // lets one handler serve both sends.
  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setStage("reset");
    } catch (err: any) {
      setError(err.message || m.auth_forgot_failed());
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      setStage("done");
    } catch (err: any) {
      setError(err.message || m.auth_reset_failed());
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setOtp("");
    setNewPassword("");
    setError("");
    setStage("request");
  }

  if (stage === "done") {
    return (
      <div className={ styles.page }>
        <div className={ styles.card }>
          <div className={ styles.heading }>
            <h1>{ m.auth_reset_done_title() }</h1>
            <p>{ m.auth_reset_done_sub() }</p>
          </div>

          <Link to="/auth/login" className="btn">
            { m.nav_login() }
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "reset") {
    return (
      <div className={ styles.page }>
        <div className={ styles.card }>
          <div className={ styles.heading }>
            <h1>{ m.auth_reset_title() }</h1>
            <p>{ m.auth_reset_sub() }</p>
          </div>

          <form onSubmit={ resetPassword } className={ styles.form }>
            <p className={ styles.hint }>{ m.auth_forgot_sent({ email }) }</p>

            <div className={ styles.field }>
              <label>{ m.auth_reset_otp() }</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={ OTP_LENGTH }
                value={ otp }
                onChange={ (e) => setOtp(e.target.value.replace(/\D/g, "")) }
                required
              />
            </div>

            <div className={ styles.field }>
              <label>{ m.auth_reset_new_password() }</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={ newPassword }
                onChange={ (e) => setNewPassword(e.target.value) }
                required
              />
            </div>

            { error && <p className="error-msg">{ error }</p> }

            <Button className="btn" type="submit" disabled={ loading }>
              { loading ? m.auth_reset_loading() : m.auth_reset_submit() }
            </Button>

            <button
              type="button"
              className={ styles.link }
              disabled={ loading }
              onClick={ () => requestCode() }
            >
              { m.auth_reset_resend() }
            </button>
          </form>

          <p className={ styles.footer }>
            <button
              type="button"
              className={ styles.link }
              onClick={ changeEmail }
            >
              { m.auth_reset_back() }
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={ styles.page }>
      <div className={ styles.card }>
        <div className={ styles.heading }>
          <h1>{ m.auth_forgot_title() }</h1>
          <p>{ m.auth_forgot_sub() }</p>
        </div>

        <form onSubmit={ requestCode } className={ styles.form }>
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

          { error && <p className="error-msg">{ error }</p> }

          <Button className="btn" type="submit" disabled={ loading }>
            { loading ? m.auth_forgot_loading() : m.auth_forgot_submit() }
          </Button>
        </form>

        <p className={ styles.footer }>
          <RichText parts={ m.auth_forgot_footer.parts({}) } />
        </p>
      </div>
    </div>
  );
}
