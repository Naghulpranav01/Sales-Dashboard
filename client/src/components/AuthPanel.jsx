import { useState } from "react";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { api } from "../lib/api";

export default function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = await api(`/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      onAuthenticated(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="account" className="auth-panel" aria-label="Account access">
      <div className="panel-heading">
        <Lock size={18} />
        <span>Secure access</span>
      </div>

      <div className="segmented">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          Login
        </button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
          Signup
        </button>
      </div>

      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && (
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              autoComplete="name"
              required
            />
          </label>
        )}
        <label>
          Email
          <input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            type="password"
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy}>
          {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
          {busy ? "Please wait" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </section>
  );
}
