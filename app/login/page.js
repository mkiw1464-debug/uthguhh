"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Login failed");
      localStorage.setItem("ffex_token", d.token);
      localStorage.setItem("ffex_role", d.role);
      localStorage.setItem("ffex_username", username);
      if (d.role === "developer") router.push("/developer");
      else if (d.role === "admin") router.push("/admin");
      else router.push("/reseller");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="login-shell">
      <div className="login-theme-btn">
        <ThemeToggle />
      </div>

      <div className="login-box">
        <div className="login-logo">
          <div className="mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h11M4 18h8" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="wordmark">FFEX</div>
            <div className="sub">License Control</div>
          </div>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Access your license dashboard.</p>

        <form onSubmit={submit}>
          <div className="login-field">
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <div className="login-err">⚠ {error}</div>}
        </form>
      </div>
    </div>
  );
}
