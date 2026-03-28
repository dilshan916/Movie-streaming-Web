import { BookmarkCheck, Calendar, Clock, Edit2, Eye, Film, LogOut, Star, Tv, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMedia } from "../context/MediaContext";

export default function ProfilePage() {
  const { user, signOutUser } = useAuth();
  const { media } = useMedia();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const watched = media.filter((m) => m.status === "Watched");
    const watchlist = media.filter((m) => m.status === "Want to Watch");
    const movies = watched.filter((m) => m.type === "Movie");
    const shows = watched.filter((m) => m.type === "TV Series");
    const rated = watched.filter((m) => m.rating);
    const avgRating = rated.length > 0
      ? (rated.reduce((a, m) => a + (m.rating || 0), 0) / rated.length).toFixed(1)
      : "—";
    const totalMinutes = watched.reduce((acc, item) => {
      if (item.type === "TV Series" && item.numberOfEpisodes) {
        return acc + ((item.runtime || 0) * item.numberOfEpisodes);
      }
      return acc + (item.runtime || 0);
    }, 0);

    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const watchTimeString = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

    const totalEpisodes = watched.reduce((a, m) => a + (m.numberOfEpisodes || 0), 0);

    // Genre distribution
    const genreCounts: Record<string, number> = {};
    watched.forEach((m) => {
      if (m.genre) genreCounts[m.genre] = (genreCounts[m.genre] || 0) + 1;
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Recently watched (last 6)
    const recentlyWatched = watched
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6);

    return {
      watched: watched.length,
      watchlist: watchlist.length,
      movies: movies.length,
      shows: shows.length,
      avgRating,
      watchTimeString,
      totalEpisodes,
      topGenres,
      recentlyWatched,
      totalLibrary: media.length,
    };
  }, [media]);

  const getInitial = () => {
    if (user?.displayName) return user.displayName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "?";
  };

  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="nf-profile">
      {/* Profile Hero Banner */}
      <div className="nf-profile-hero">
        <div className="nf-profile-hero-gradient" />
        <div className="nf-profile-hero-content">
          <div className="nf-profile-avatar-section">
            <div className="nf-profile-avatar">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <span>{getInitial()}</span>
              )}
              <button className="nf-profile-avatar-edit" title="Edit profile">
                <Edit2 size={14} />
              </button>
            </div>
            <div className="nf-profile-info">
              <h1 className="nf-profile-name">{user?.displayName || "User"}</h1>
              <p className="nf-profile-email">{user?.email}</p>
              <div className="nf-profile-meta">
                <span className="nf-profile-meta-item">
                  <Calendar size={14} /> Member since {memberSince}
                </span>
                <span className="nf-profile-meta-item">
                  <Film size={14} /> {stats.totalLibrary} titles in library
                </span>
              </div>
            </div>
          </div>
          <div className="nf-profile-hero-actions">
            <button className="nf-profile-btn-manage" onClick={() => navigate("/watchlist")}>
              <BookmarkCheck size={18} /> My List
            </button>
            <button className="nf-profile-btn-signout" onClick={signOutUser}>
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="nf-profile-body">
        <div className="nf-profile-stats-grid">
          <div className="nf-stat-card nf-stat-movies">
            <div className="nf-stat-icon"><Film size={24} /></div>
            <div className="nf-stat-value">{stats.movies}</div>
            <div className="nf-stat-label">Movies Watched</div>
            <div className="nf-stat-glow" />
          </div>
          <div className="nf-stat-card nf-stat-shows">
            <div className="nf-stat-icon"><Tv size={24} /></div>
            <div className="nf-stat-value">{stats.shows}</div>
            <div className="nf-stat-label">TV Shows</div>
            <div className="nf-stat-glow" />
          </div>
          <div className="nf-stat-card nf-stat-rating">
            <div className="nf-stat-icon"><Star size={24} /></div>
            <div className="nf-stat-value">{stats.avgRating}</div>
            <div className="nf-stat-label">Avg Rating</div>
            <div className="nf-stat-glow" />
          </div>
          <div className="nf-stat-card nf-stat-time">
            <div className="nf-stat-icon"><Clock size={24} /></div>
            <div className="nf-stat-value">{stats.watchTimeString}</div>
            <div className="nf-stat-label">Watch Time</div>
            <div className="nf-stat-glow" />
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="nf-quick-stats">
          <div className="nf-quick-stat">
            <span className="nf-quick-stat-num">{stats.watched}</span>
            <span className="nf-quick-stat-text">Completed</span>
          </div>
          <div className="nf-quick-divider" />
          <div className="nf-quick-stat">
            <span className="nf-quick-stat-num">{stats.watchlist}</span>
            <span className="nf-quick-stat-text">In Watchlist</span>
          </div>
          <div className="nf-quick-divider" />
          <div className="nf-quick-stat">
            <span className="nf-quick-stat-num">{stats.totalEpisodes}</span>
            <span className="nf-quick-stat-text">Episodes</span>
          </div>
          <div className="nf-quick-divider" />
          <div className="nf-quick-stat">
            <span className="nf-quick-stat-num">{stats.totalLibrary}</span>
            <span className="nf-quick-stat-text">In Library</span>
          </div>
        </div>

        {/* Two column layout */}
        <div className="nf-profile-columns">
          {/* Favorite Genres */}
          <div className="nf-profile-section">
            <h2 className="nf-section-heading">
              <TrendingUp size={20} /> Favorite Genres
            </h2>
            {stats.topGenres.length > 0 ? (
              <div className="nf-genre-bars">
                {stats.topGenres.map(([genre, count], idx) => {
                  const maxCount = stats.topGenres[0][1] as number;
                  const percentage = (count as number / maxCount) * 100;
                  const colors = [
                    "linear-gradient(90deg, #E50914, #ff4d56)",
                    "linear-gradient(90deg, #b20710, #E50914)",
                    "linear-gradient(90deg, #831010, #b20710)",
                    "linear-gradient(90deg, #5c0a0a, #831010)",
                    "linear-gradient(90deg, #3d0707, #5c0a0a)",
                  ];
                  return (
                    <div key={genre} className="nf-genre-row">
                      <span className="nf-genre-rank">#{idx + 1}</span>
                      <span className="nf-genre-name">{genre}</span>
                      <div className="nf-genre-bar-track">
                        <div
                          className="nf-genre-bar-fill"
                          style={{ width: `${percentage}%`, background: colors[idx] || colors[4] }}
                        >
                          <span className="nf-genre-count">{count as number}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="nf-empty-text">Start watching to discover your genres!</p>
            )}
          </div>

          {/* Recently Watched */}
          <div className="nf-profile-section">
            <h2 className="nf-section-heading">
              <Clock size={20} /> Recently Watched
            </h2>
            {stats.recentlyWatched.length > 0 ? (
              <div className="nf-recent-grid">
                {stats.recentlyWatched.map((item) => (
                  <div
                    key={item.id}
                    className="nf-recent-card"
                    onClick={() => {
                      const id = item.tmdbId || item.title;
                      navigate(`/movie/${id}?type=${item.type === "TV Series" ? "tv" : "movie"}`);
                    }}
                  >
                    <img
                      src={item.poster || "https://via.placeholder.com/120x180/141414/666?text=?"}
                      alt={item.title}
                      className="nf-recent-poster"
                    />
                    <div className="nf-recent-overlay">
                      <Eye size={20} color="#fff" />
                    </div>
                    <div className="nf-recent-info">
                      <span className="nf-recent-title">{item.title}</span>
                      {item.rating && (
                        <span className="nf-recent-rating">★ {item.rating}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="nf-empty-text">Nothing watched yet — time to binge!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
