import { BarChart3, Clock, Film, LogOut, Star, Tv } from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useMedia } from "../context/MediaContext";

export default function ProfilePage() {
  const { user, signOutUser } = useAuth();
  const { media } = useMedia();

  const stats = useMemo(() => {
    const watched = media.filter((m) => m.status === "Watched");
    const watchlist = media.filter((m) => m.status === "Want to Watch");
    const movies = watched.filter((m) => m.type === "Movie");
    const shows = watched.filter((m) => m.type === "TV Series");
    const rated = watched.filter((m) => m.rating);
    const avgRating = rated.length > 0
      ? (rated.reduce((a, m) => a + (m.rating || 0), 0) / rated.length).toFixed(1)
      : "—";
    const totalRuntime = watched.reduce((a, m) => a + (m.runtime || 0), 0);
    const runtimeHours = Math.floor(totalRuntime / 60);
    const totalEpisodes = watched.reduce((a, m) => a + (m.numberOfEpisodes || 0), 0);

    // Genre distribution
    const genreCounts: Record<string, number> = {};
    watched.forEach((m) => {
      if (m.genre) genreCounts[m.genre] = (genreCounts[m.genre] || 0) + 1;
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { watched: watched.length, watchlist: watchlist.length, movies: movies.length, shows: shows.length, avgRating, runtimeHours, totalEpisodes, topGenres };
  }, [media]);

  const getInitial = () => {
    if (user?.displayName) return user.displayName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "?";
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Profile</h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card" style={{ padding: 32, marginBottom: 32, display: "flex", alignItems: "center", gap: 24, border: "1px solid var(--border)" }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #ff6b6b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 800, overflow: "hidden", flexShrink: 0,
        }}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            getInitial()
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            {user?.displayName || "User"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{user?.email}</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
            Member since {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={signOutUser}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Stats Grid */}
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
        <BarChart3 size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
        Your Stats
      </h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Film size={22} style={{ color: "var(--accent)" }} />
            {stats.movies}
          </div>
          <div className="stat-card-label">Movies Watched</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tv size={22} style={{ color: "var(--accent)" }} />
            {stats.shows}
          </div>
          <div className="stat-card-label">TV Shows Watched</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={22} style={{ color: "var(--warning)" }} />
            {stats.avgRating}
          </div>
          <div className="stat-card-label">Average Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={22} style={{ color: "var(--success)" }} />
            {stats.runtimeHours}h
          </div>
          <div className="stat-card-label">Total Watch Time</div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ marginTop: 0 }}>
        <div className="stat-card">
          <div className="stat-card-value">{stats.watched}</div>
          <div className="stat-card-label">Total Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{stats.watchlist}</div>
          <div className="stat-card-label">In Watchlist</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{stats.totalEpisodes}</div>
          <div className="stat-card-label">Episodes Watched</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{media.length}</div>
          <div className="stat-card-label">Total in Library</div>
        </div>
      </div>

      {/* Top Genres */}
      {stats.topGenres.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Favorite Genres</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stats.topGenres.map(([genre, count]) => {
              const maxCount = stats.topGenres[0][1] as number;
              const percentage = (count as number / maxCount) * 100;
              return (
                <div key={genre} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ width: 100, fontSize: 14, fontWeight: 500, flexShrink: 0 }}>{genre}</span>
                  <div style={{ flex: 1, height: 28, background: "var(--bg-card)", borderRadius: "var(--radius-full)", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <div style={{
                      height: "100%",
                      width: `${percentage}%`,
                      background: "linear-gradient(90deg, var(--accent), #ff4d56)",
                      borderRadius: "var(--radius-full)",
                      transition: "width 0.8s ease",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 12,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{count as number}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
