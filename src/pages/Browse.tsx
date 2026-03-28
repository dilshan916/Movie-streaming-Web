import { Info, Loader2, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMedia } from "../context/MediaContext";
import tmdbClient, { BACKDROP_BASE_URL, IMAGE_BASE_URL } from "../lib/tmdb";

export default function BrowsePage() {
  const navigate = useNavigate();
  const { addMedia, media } = useMedia();
  const [trending, setTrending] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Auto-rotate hero
  useEffect(() => {
    if (trending.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % trending.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [trending]);

  // Search debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.length > 0) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Recommendations
  useEffect(() => {
    fetchRecommendations();
  }, [media]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [trendingRes, popularRes] = await Promise.all([
        tmdbClient.get("/trending/all/day"),
        tmdbClient.get("/movie/popular", { params: { language: "en-US", page: 1 } }),
      ]);
      setTrending(trendingRes.data.results?.slice(0, 5) || []);
      setMovies(
        (popularRes.data.results || []).map((m: any) => ({ ...m, media_type: m.media_type || "movie" }))
      );
    } catch (e) {
      console.error("Error fetching browse data:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const [movieRes, tvRes] = await Promise.all([
        tmdbClient.get("/movie/top_rated", { params: { language: "en-US", page: 1 } }),
        tmdbClient.get("/tv/top_rated", { params: { language: "en-US", page: 1 } }),
      ]);
      const combined = [
        ...(movieRes.data.results || []).map((r: any) => ({ ...r, media_type: "movie" })),
        ...(tvRes.data.results || []).map((r: any) => ({ ...r, media_type: "tv" })),
      ];
      const libraryIds = new Set(media.map((m) => m.tmdbId));
      const clean = combined.filter((r: any) => r.poster_path && !libraryIds.has(r.id));
      const unique = Array.from(new Map(clean.map((i) => [i.id, i])).values());
      const shuffled = unique.sort(() => Math.random() - 0.5);
      setRecommendations(shuffled.slice(0, 12));
    } catch (e) {
      console.error("Error fetching recommendations:", e);
    }
  };

  const performSearch = async (text: string) => {
    setIsSearching(true);
    try {
      const res = await tmdbClient.get("/search/multi", {
        params: { query: text, page: 1, include_adult: false, language: "en-US" },
      });
      setSearchResults(
        res.data.results.filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
      );
    } catch (e) {
      console.error("Search error:", e);
    }
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const res = await tmdbClient.get("/movie/popular", {
        params: { language: "en-US", page: next },
      });
      const results = (res.data.results || []).map((m: any) => ({ ...m, media_type: m.media_type || "movie" }));
      setMovies((prev) => [...prev, ...results]);
      setPage(next);
    } catch (e) {
      console.error("Load more error:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const navigateToDetails = (item: any) => {
    navigate(`/movie/${item.id}?type=${item.media_type || "movie"}`);
  };

  const quickAdd = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await addMedia({
      title: item.title || item.name,
      type: item.media_type === "tv" ? "TV Series" : "Movie",
      status: "Want to Watch",
      poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : undefined,
      tmdbId: item.id,
    });
  };

  const heroItem = trending[heroIndex];
  const displayItems = isSearching ? searchResults : movies;

  if (loading) {
    return (
      <div className="page-loading"><div className="spinner" /></div>
    );
  }

  return (
    <div className="page-padded">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Browse Movies</h1>
        </div>
        <div style={{ zIndex: 9999, display: 'flex', alignItems: 'center', background: '#222', border: '2px solid #555', borderRadius: 9999, padding: '10px 16px', gap: 12, minWidth: 350, boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
          <svg style={{ width: 22, height: 22, color: '#ff4d56', flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: 16, outline: 'none', minWidth: 0 }}
            placeholder="Search movies & TV..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Hero Section */}
      {!isSearching && heroItem && (
        <div className="hero-section">
          <img
            src={heroItem.backdrop_path ? `${BACKDROP_BASE_URL}${heroItem.backdrop_path}` : ""}
            alt=""
            className="hero-backdrop"
            style={{ transition: "opacity 0.6s ease" }}
          />
          <div className="hero-gradient" />
          <div className="hero-content">
            <span className="hero-label">🔥 Featured Today</span>
            <h2 className="hero-title">{heroItem.title || heroItem.name}</h2>
            <p className="hero-overview">{heroItem.overview}</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigateToDetails(heroItem)}>
                <Info size={16} /> More Info
              </button>
              <button className="btn btn-secondary" onClick={(e) => quickAdd(heroItem, e)}>
                <Plus size={16} /> Watchlist
              </button>
            </div>
          </div>
          {/* Hero dots */}
          <div style={{
            position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: 8
          }}>
            {trending.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroIndex(i)}
                style={{
                  width: i === heroIndex ? 24 : 8, height: 8,
                  borderRadius: 4, border: "none", cursor: "pointer",
                  background: i === heroIndex ? "var(--accent)" : "rgba(255,255,255,0.4)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Row */}
      {!isSearching && recommendations.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-header">
            <h3 className="section-title">Top Picks for You</h3>
          </div>
          <div className="horizontal-scroll">
            {recommendations.map((item) => (
              <div
                key={item.id}
                className="movie-card"
                style={{ width: 150 }}
                onClick={() => navigateToDetails(item)}
              >
                <img
                  src={item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : ""}
                  alt={item.title || item.name}
                  className="movie-card-poster"
                />
                <div className="movie-card-overlay">
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ marginBottom: 8 }}
                    onClick={(e) => quickAdd(item, e)}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                <div className="movie-card-info">
                  <div className="movie-card-title">{item.title || item.name}</div>
                  {item.vote_average > 0 && (
                    <div className="movie-card-rating"><Star size={12} /> {item.vote_average.toFixed(1)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="section-header">
        <h3 className="section-title">{isSearching ? `Search Results` : "Popular Movies"}</h3>
      </div>

      <div className="movie-grid">
        {displayItems.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="movie-card"
            onClick={() => navigateToDetails(item)}
          >
            <img
              src={item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : ""}
              alt={item.title || item.name}
              className="movie-card-poster"
            />
            <div className="movie-card-overlay">
              <button
                className="btn btn-sm btn-primary"
                style={{ marginBottom: 8 }}
                onClick={(e) => quickAdd(item, e)}
              >
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="movie-card-info">
              <div className="movie-card-title">{item.title || item.name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="movie-card-year">
                  {(item.release_date || item.first_air_date || "").slice(0, 4) || "N/A"}
                </span>
                {item.vote_average > 0 && (
                  <span className="movie-card-rating"><Star size={12} /> {item.vote_average.toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isSearching && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 size={16} className="spinning" /> : "Load More"}
          </button>
        </div>
      )}

      <style>{`
        .spinning { animation: spin 0.6s linear infinite; }
      `}</style>
    </div>
  );
}
