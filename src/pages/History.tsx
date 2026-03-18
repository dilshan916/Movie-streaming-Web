import { Check, Eye, Trash2, Undo } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMedia, type MediaItem } from "../context/MediaContext";

export default function HistoryPage() {
  const { media, deleteMedia, toggleStatus, updateMedia, loading } = useMedia();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<"All" | "Movie" | "TV Series">("All");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const watched = media.filter((item) => item.status === "Watched");

  const displayData = useMemo(() => {
    return watched
      .filter((item) => filterType === "All" || item.type === filterType)
      .filter((item) => ratingFilter === null || (item.rating && item.rating >= ratingFilter))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [watched, filterType, ratingFilter]);

  const handlePress = (item: MediaItem) => {
    const id = item.tmdbId || item.title;
    if (id) navigate(`/movie/${id}?type=${item.type === "TV Series" ? "tv" : "movie"}`);
  };

  const handleRate = async (itemId: string, rating: number) => {
    await updateMedia(itemId, { rating });
  };

  // Stats
  const totalWatched = watched.length;
  const totalMovies = watched.filter((m) => m.type === "Movie").length;
  const totalShows = watched.filter((m) => m.type === "TV Series").length;
  const avgRating = watched.filter((m) => m.rating).length > 0
    ? (watched.reduce((acc, m) => acc + (m.rating || 0), 0) / watched.filter((m) => m.rating).length).toFixed(1)
    : "—";

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Watch History</h1>
          <p>Everything you've completed</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-value">{totalWatched}</div>
          <div className="stat-card-label">Total Watched</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{totalMovies}</div>
          <div className="stat-card-label">Movies</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{totalShows}</div>
          <div className="stat-card-label">TV Shows</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: "var(--warning)" }}>
            ★ {avgRating}
          </div>
          <div className="stat-card-label">Avg Rating</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {(["All", "Movie", "TV Series"] as const).map((type) => (
          <button
            key={type}
            className={`chip ${filterType === type ? "active" : ""}`}
            onClick={() => setFilterType(type)}
          >
            {type === "All" ? "All" : type === "Movie" ? "Movies" : "TV Shows"}
          </button>
        ))}
        <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 4px" }} />
        {[5, 4, 3].map((r) => (
          <button
            key={r}
            className={`chip ${ratingFilter === r ? "active" : ""}`}
            onClick={() => setRatingFilter(ratingFilter === r ? null : r)}
          >
            ★ {r}+
          </button>
        ))}
      </div>

      {loading && watched.length === 0 ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : displayData.length === 0 ? (
        <div className="empty-state">
          <Eye size={56} />
          <h3>No watched items</h3>
          <p>Movies and shows you mark as watched will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayData.map((item) => (
            <div key={item.id} className="media-list-item" onClick={() => handlePress(item)}>
              <img
                src={item.poster || "https://via.placeholder.com/56x80/141414/666?text=?"}
                alt={item.title}
                className="media-list-poster"
              />
              <div className="media-list-info">
                <div className="media-list-title">{item.title}</div>
                <div className="media-list-meta">
                  <span className="badge badge-success">
                    <Check size={10} style={{ marginRight: 4 }} /> Watched
                  </span>
                  {item.genre && <span>{item.genre}</span>}
                </div>
                {/* Rating Stars */}
                <div
                  style={{ display: "flex", gap: 4, marginTop: 6 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRate(item.id, star)}
                      style={{
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                        color: (item.rating || 0) >= star ? "var(--warning)" : "var(--text-muted)",
                        fontSize: 16, transition: "transform 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="media-list-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-icon"
                  title="Move back to watchlist"
                  onClick={() => toggleStatus(item.id)}
                >
                  <Undo size={16} style={{ color: "var(--accent)" }} />
                </button>
                <button
                  className="btn-icon"
                  title="Delete"
                  onClick={() => deleteMedia(item.id)}
                >
                  <Trash2 size={16} style={{ color: "var(--danger)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
