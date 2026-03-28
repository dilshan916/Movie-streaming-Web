import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tmdbClient, { IMAGE_BASE_URL } from "../lib/tmdb";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bgPosters, setBgPosters] = useState<string[]>([]);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosters();
  }, []);

  const fetchPosters = async () => {
    try {
      const res = await tmdbClient.get("/trending/all/day");
      const posters = (res.data.results || [])
        .filter((m: any) => m.poster_path)
        .map((m: any) => `${IMAGE_BASE_URL}${m.poster_path}`)
        .slice(0, 24);
      setBgPosters(posters);
    } catch {
      // Silently fail
    }
  };

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
        <h1 className="nf-auth-title">Sign Up</h1>

        <form className="nf-auth-form" onSubmit={handleSignup}>
          {error && <div className="nf-auth-error">{error}</div>}

          <div className="nf-input-wrap">
            <input
              id="signup-name"
              type="text"
              className="nf-input"
              placeholder=" "
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <label htmlFor="signup-name" className="nf-input-label">Display Name</label>
          </div>

          <div className="nf-input-wrap">
            <input
              id="signup-email"
              type="email"
              className="nf-input"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label htmlFor="signup-email" className="nf-input-label">Email</label>
          </div>

          <div className="nf-input-wrap">
            <input
              id="signup-password"
              type="password"
              className="nf-input"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="signup-password" className="nf-input-label">Password</label>
          </div>

          <div className="nf-input-wrap">
            <input
              id="signup-confirm"
              type="password"
              className="nf-input"
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <label htmlFor="signup-confirm" className="nf-input-label">Confirm Password</label>
          </div>

          <button type="submit" className="nf-auth-btn" disabled={loading}>
            {loading ? <Loader2 size={20} className="spinning" /> : "Create Account"}
          </button>
        </form>

        <div className="nf-auth-footer">
          <span>Already have an account? </span>
          <Link to="/login" className="nf-auth-link">Sign in now.</Link>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 0.6s linear infinite; }
      `}</style>
    </div>
  );
}
