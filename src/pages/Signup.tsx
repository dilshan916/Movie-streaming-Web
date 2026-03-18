import { Film, Loader2, Lock, Mail, User } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signUp(email, password, displayName);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Film size={32} color="#fff" />
          </div>
          <h1>Create Account</h1>
          <p>Join My Watchlist today</p>
        </div>

        <form className="auth-form" onSubmit={handleSignup}>
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="signup-name">Display Name</label>
            <div style={{ position: "relative" }}>
              <User size={18} className="input-icon" style={{ top: "50%", transform: "translateY(-50%)" }} />
              <input
                id="signup-name"
                type="text"
                className="input-field input-with-icon"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="signup-email">Email</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} className="input-icon" style={{ top: "50%", transform: "translateY(-50%)" }} />
              <input
                id="signup-email"
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
            <label htmlFor="signup-password">Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} className="input-icon" style={{ top: "50%", transform: "translateY(-50%)" }} />
              <input
                id="signup-password"
                type="password"
                className="input-field input-with-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="signup-confirm">Confirm Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} className="input-icon" style={{ top: "50%", transform: "translateY(-50%)" }} />
              <input
                id="signup-confirm"
                type="password"
                className="input-field input-with-icon"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? <Loader2 size={20} className="spinning" /> : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">Sign In</Link>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 0.6s linear infinite; }
      `}</style>
    </div>
  );
}
