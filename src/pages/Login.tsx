import { Film, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    try {
      await resetPassword(email);
      setError("");
      alert("Reset link sent! Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Film size={32} color="#fff" />
          </div>
          <h1>My Watchlist</h1>
          <p>Sign in to continue</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="login-email">Email</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} className="input-icon" style={{ top: "50%", transform: "translateY(-50%)" }} />
              <input
                id="login-email"
                type="email"
                className="input-field input-with-icon"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="login-password">Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} className="input-icon" style={{ top: "50%", transform: "translateY(-50%)" }} />
              <input
                id="login-password"
                type="password"
                className="input-field input-with-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <Loader2 size={20} className="spinning" /> : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{" "}
          <Link to="/signup">Sign Up</Link>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
