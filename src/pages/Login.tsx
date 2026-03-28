import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tmdbClient, { IMAGE_BASE_URL } from "../lib/tmdb";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bgPosters, setBgPosters] = useState<string[]>([]);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosters();
  }, []);

  const fetchPosters = async () => {
    try {
      const res = await tmdbClient.get("/movie/popular", {
        params: { language: "en-US", page: 1 },
      });
      const posters = (res.data.results || [])
        .filter((m: any) => m.poster_path)
        .map((m: any) => `${IMAGE_BASE_URL}${m.poster_path}`)
        .slice(0, 24);
      setBgPosters(posters);
    } catch {
      // Silently fail — the background is decorative
    }
  };

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
    <div className="nf-auth-page">
      {/* Background poster grid */}
      <div className="nf-auth-bg">
        {bgPosters.map((src, i) => (
          <img key={i} src={src} alt="" className="nf-auth-bg-poster" loading="lazy" />
        ))}
      </div>
      <div className="nf-auth-bg-overlay" />

      {/* Logo */}
      <div className="nf-auth-logo">
        <span className="nf-auth-logo-icon">W</span>
        <span className="nf-auth-logo-text">MY WATCHLIST</span>
      </div>

      {/* Form Card */}
      <div className="nf-auth-card">
        <h1 className="nf-auth-title">Sign In</h1>

        <form className="nf-auth-form" onSubmit={handleLogin}>
          {error && <div className="nf-auth-error">{error}</div>}

          <div className="nf-input-wrap">
            <input
              id="login-email"
              type="email"
              className="nf-input"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label htmlFor="login-email" className="nf-input-label">Email</label>
          </div>

          <div className="nf-input-wrap">
            <input
              id="login-password"
              type="password"
              className="nf-input"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <label htmlFor="login-password" className="nf-input-label">Password</label>
          </div>

          <button type="submit" className="nf-auth-btn" disabled={loading}>
            {loading ? <Loader2 size={20} className="spinning" /> : "Sign In"}
          </button>

          <div className="nf-auth-options">
            <label className="nf-checkbox-label">
              <input type="checkbox" className="nf-checkbox" defaultChecked />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="nf-forgot-link"
            >
              Need help?
            </button>
          </div>
        </form>

        <div className="nf-auth-footer">
          <span>New to My Watchlist? </span>
          <Link to="/signup" className="nf-auth-link">Sign up now.</Link>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
