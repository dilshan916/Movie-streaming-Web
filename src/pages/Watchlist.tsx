import { Check, Clock, Film, ListPlus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMedia, type MediaItem } from "../context/MediaContext";
import tmdbClient, { IMAGE_BASE_URL } from "../lib/tmdb";

export default function WatchlistPage() {
  const { media, deleteMedia, toggleStatus, addMedia, loading } = useMedia();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<"All" | "Movie" | "TV Series">("All");
  const [sortBy, setSortBy] = useState<"Recent" | "Oldest" | "Title A-Z">("Recent");
  const [showAddModal, setShowAddModal] = useState(false);

  const watchlist = media.filter((item) => item.status === "Want to Watch");

  const displayData = useMemo(() => {
    return watchlist
      .filter((item) => filterType === "All" || item.type === filterType)
      .sort((a, b) => {
        if (sortBy === "Recent") return b.createdAt - a.createdAt;
        if (sortBy === "Oldest") return a.createdAt - b.createdAt;
        return a.title.localeCompare(b.title);
      });
  }, [watchlist, filterType, sortBy]);

  const handlePress = (item: MediaItem) => {
    const id = item.tmdbId || item.title;
    if (id) {
      navigate(`/movie/${id}?type=${item.type === "TV Series" ? "tv" : "movie"}`);
    }
  };

  return (
    <div className="page-padded">
      <div className="page-header">
        <div className="page-header-left">
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>What's next?</p>
          <h1>Watchlist</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <ListPlus size={18} /> Add Media
        </button>
      </div>

      <div className="filter-bar">
        {(["All", "Movie", "TV Series"] as const).map((type) => (
          <button
            key={type}
            className={`chip ${filterType === type ? "active" : ""}`}
            onClick={() => setFilterType(type)}
          >
            {type === "All" ? "All Types" : type === "Movie" ? "Movies" : "TV Shows"}
          </button>
        ))}
        <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 4px" }} />
        <button
          className="chip"
          onClick={() => {
            if (sortBy === "Recent") setSortBy("Oldest");
            else if (sortBy === "Oldest") setSortBy("Title A-Z");
            else setSortBy("Recent");
          }}
        >
          <Clock size={14} /> Sort: {sortBy}
        </button>
      </div>

      {loading && watchlist.length === 0 ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : displayData.length === 0 ? (
        <div className="empty-state">
          <Film size={56} />
          <h3>Your watchlist is empty</h3>
          <p>Add movies or shows you want to see!</p>
          <button className="btn btn-primary" onClick={() => navigate("/browse")}>
            Browse Movies
          </button>
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
                  <span className="badge badge-accent">{item.type}</span>
                  {item.genre && <span>{item.genre}</span>}
                </div>
              </div>
              <div className="media-list-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-icon"
                  title="Mark as watched"
                  onClick={() => toggleStatus(item.id)}
                >
                  <Check size={16} style={{ color: "var(--success)" }} />
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

      {showAddModal && <AddMediaModal onClose={() => setShowAddModal(false)} onAdd={addMedia} />}
    </div>
  );
}

/* ============================================
   ADD MEDIA MODAL
   ============================================ */

function AddMediaModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Omit<MediaItem, "id" | "createdAt">) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await tmdbClient.get("/search/multi", {
        params: { query, page: 1, include_adult: false, language: "en-US" },
      });
      const filtered = res.data.results.filter(
        (r: any) => r.media_type === "movie" || r.media_type === "tv"
      );
      setResults(filtered);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (item: any) => {
    try {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const details = await tmdbClient.get(`/${type}/${item.id}`, {
        params: { language: "en-US" },
      });
      const d = details.data;

      await onAdd({
        title: item.title || item.name,
        type: item.media_type === "tv" ? "TV Series" : "Movie",
        status: "Want to Watch",
        poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : undefined,
        tmdbId: item.id,
        genre: d.genres?.[0]?.name,
        runtime: d.runtime,
        numberOfEpisodes: d.number_of_episodes,
      });
    } catch {
      await onAdd({
        title: item.title || item.name,
        type: item.media_type === "tv" ? "TV Series" : "Movie",
        status: "Want to Watch",
        poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : undefined,
        tmdbId: item.id,
      });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add to Watchlist</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search movies or TV shows..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              autoFocus
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
              <Search size={16} />
            </button>
          </div>

          {searching && (
            <div style={{ textAlign: "center", padding: 24 }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {results.map((item) => (
              <div key={item.id} className="media-list-item" style={{ cursor: "pointer" }} onClick={() => handleAdd(item)}>
                <img
                  src={item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : "https://via.placeholder.com/56x80/141414/666?text=?"}
                  alt={item.title || item.name}
                  className="media-list-poster"
                />
                <div className="media-list-info">
                  <div className="media-list-title">{item.title || item.name}</div>
                  <div className="media-list-meta">
                    <span className="badge badge-accent">{item.media_type === "tv" ? "TV" : "Movie"}</span>
                    <span>{(item.release_date || item.first_air_date || "").slice(0, 4)}</span>
                    {item.vote_average > 0 && (
                      <span style={{ color: "var(--warning)" }}>★ {item.vote_average.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); handleAdd(item); }}>
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
