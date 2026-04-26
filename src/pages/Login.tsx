import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tmdbClient, { IMAGE_BASE_URL } from "../lib/tmdb";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bgPosters, setBgPosters] = useState<string[]>([]);
  const [rememberMe, setRememberMe] = useState(true);
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
        .slice(0, 30);
      setBgPosters(posters);
    } catch {
      // Silently fail — the background is decorative
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
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
      {/* Animated poster grid background */}
      <div className="nf-auth-bg">
        <div className="nf-auth-bg-track">
          {[...bgPosters, ...bgPosters].map((src, i) => (
            <img key={i} src={src} alt="" className="nf-auth-bg-poster" loading="lazy" />
          ))}
        </div>
      </div>
      <div className="nf-auth-bg-overlay" />

      {/* Top bar with logo */}
      <header className="nf-auth-header">
        <div className="nf-auth-logo">
          <span className="nf-auth-logo-icon">M</span>
          <span className="nf-auth-logo-text">MATTA</span>
        </div>
      </header>

      {/* Form Card */}
      <div className="nf-auth-card">
        <h1 className="nf-auth-title">Sign In</h1>

        <form className="nf-auth-form" onSubmit={handleLogin}>
          {error && (
            <div className="nf-auth-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

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
            <label htmlFor="login-email" className="nf-input-label">
              Email or phone number
            </label>
            <Mail size={18} className="nf-input-icon" />
          </div>

          <div className="nf-input-wrap">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="nf-input"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <label htmlFor="login-password" className="nf-input-label">
              Password
            </label>
            <button
              type="button"
              className="nf-input-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button id="login-submit" type="submit" className="nf-auth-btn" disabled={loading}>
            {loading ? <Loader2 size={20} className="nf-spinning" /> : "Sign In"}
          </button>

          <div className="nf-auth-options">
            <label className="nf-checkbox-label">
              <input
                type="checkbox"
                className="nf-checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <span className="nf-checkbox-custom" />
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

        <div className="nf-auth-divider">
          <span>OR</span>
        </div>

        <div className="nf-auth-social">
          <button type="button" className="nf-social-btn nf-social-google">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
            Sign in with Google
          </button>
        </div>

        <div className="nf-auth-footer">
          <span>New to Matta?</span>{" "}
          <Link to="/signup" className="nf-auth-link">
            Sign up now.
          </Link>
        </div>

        <p className="nf-auth-disclaimer">
          This page is protected by Google reCAPTCHA to ensure you're not a bot.{" "}
          <button type="button" className="nf-learn-more">Learn more.</button>
        </p>
      </div>

      <style>{`
        .nf-spinning { animation: nfSpin 0.6s linear infinite; }
        @keyframes nfSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
