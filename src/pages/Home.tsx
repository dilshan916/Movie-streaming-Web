import { Check, ChevronRight, Info, Plus, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMedia } from "../context/MediaContext";
import tmdbClient, { BACKDROP_BASE_URL, IMAGE_BASE_URL } from "../lib/tmdb";

interface MovieRow {
  title: string;
  items: any[];
}

export default function HomePage() {
  const navigate = useNavigate();
  const { addMedia } = useMedia();
  const [heroItems, setHeroItems] = useState<any[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [rows, setRows] = useState<MovieRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroLoaded, setHeroLoaded] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-rotate hero
  useEffect(() => {
    if (heroItems.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroItems.length);
      setHeroLoaded(false);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroItems]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendingRes, popularRes, topRatedRes, upcomingRes, nowPlayingRes, trendingTvRes] =
        await Promise.all([
          tmdbClient.get("/trending/all/day"),
          tmdbClient.get("/movie/popular", { params: { language: "en-US", page: 1 } }),
          tmdbClient.get("/movie/top_rated", { params: { language: "en-US", page: 1 } }),
          tmdbClient.get("/movie/upcoming", { params: { language: "en-US", page: 1 } }),
          tmdbClient.get("/movie/now_playing", { params: { language: "en-US", page: 1 } }),
          tmdbClient.get("/tv/popular", { params: { language: "en-US", page: 1 } }),
        ]);

      const trendingAll = (trendingRes.data.results || []).filter(
        (m: any) => m.backdrop_path && m.overview
      );
      setHeroItems(trendingAll.slice(0, 8));

      setRows([
        {
          title: "Trending Now",
          items: trendingAll.slice(0, 20),
        },
        {
          title: "Popular Movies",
          items: (popularRes.data.results || [])
            .filter((m: any) => m.poster_path)
            .map((m: any) => ({ ...m, media_type: "movie" })),
        },
        {
          title: "New Releases",
          items: (nowPlayingRes.data.results || [])
            .filter((m: any) => m.poster_path)
            .map((m: any) => ({ ...m, media_type: "movie" })),
        },
        {
          title: "Coming Soon",
          items: (upcomingRes.data.results || [])
            .filter((m: any) => m.poster_path)
            .map((m: any) => ({ ...m, media_type: "movie" })),
        },
        {
          title: "Top Rated",
          items: (topRatedRes.data.results || [])
            .filter((m: any) => m.poster_path)
            .map((m: any) => ({ ...m, media_type: "movie" })),
        },
        {
          title: "Popular TV Shows",
          items: (trendingTvRes.data.results || [])
            .filter((m: any) => m.poster_path)
            .map((m: any) => ({ ...m, media_type: "tv" })),
        },
      ]);
    } catch (e) {
      console.error("Error fetching home data:", e);
    } finally {
      setLoading(false);
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

  const quickWatched = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await addMedia({
      title: item.title || item.name,
      type: item.media_type === "tv" ? "TV Series" : "Movie",
      status: "Watched",
      poster: item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : undefined,
      tmdbId: item.id,
    });
  };

  const hero = heroItems[heroIndex];

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="netflix-home">
      {/* ===== HERO BANNER ===== */}
      {hero && (
        <div className="hero-banner">
          <div className="hero-banner-bg">
            <img
              key={hero.id}
              src={`${BACKDROP_BASE_URL}${hero.backdrop_path}`}
              alt=""
              className={`hero-banner-img ${heroLoaded ? "loaded" : ""}`}
              onLoad={() => setHeroLoaded(true)}
            />
          </div>
          <div className="hero-banner-gradient" />
          <div className="hero-banner-gradient-bottom" />

          <div className="hero-banner-content">
            {hero.media_type === "tv" && (
              <div className="hero-series-badge">
                <span className="hero-n">N</span>
                <span className="hero-series-text">S E R I E S</span>
              </div>
            )}
            {hero.media_type === "movie" && (
              <div className="hero-series-badge">
                <span className="hero-n">M</span>
                <span className="hero-series-text">M O V I E</span>
              </div>
            )}

            <h1 className="hero-banner-title">{hero.title || hero.name}</h1>

            <div className="hero-meta-row">
              {hero.vote_average > 0 && (
                <span className="hero-imdb">
                  <span className="imdb-badge">IMDb</span>
                  {hero.vote_average.toFixed(1)}/10
                </span>
              )}
              <span className="hero-views">
                {Math.floor(Math.random() * 9 + 1)}B+ Streams
              </span>
            </div>

            <p className="hero-banner-overview">{hero.overview}</p>

            <div className="hero-banner-actions">
              <button
                className="hero-btn hero-btn-play"
                onClick={(e) => quickWatched(hero, e)}
              >
                <Check size={20} /> Watched
              </button>
              <button
                className="hero-btn hero-btn-trailer"
                onClick={(e) => quickAdd(hero, e)}
              >
                <Plus size={20} /> Watchlist
              </button>
              <button
                className="hero-btn hero-btn-info"
                onClick={() => navigateToDetails(hero)}
              >
                <Info size={20} />
              </button>
            </div>
          </div>

          {/* Hero dots */}
          <div className="hero-dots">
            {heroItems.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setHeroIndex(i);
                  setHeroLoaded(false);
                }}
                className={`hero-dot ${i === heroIndex ? "active" : ""}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== MOVIE ROWS ===== */}
      {rows.map((row, rowIdx) => (
        <MovieRowComponent
          key={rowIdx}
          title={row.title}
          items={row.items}
          onItemClick={navigateToDetails}
          onQuickAdd={quickAdd}
          onWatched={quickWatched}
        />
      ))}
    </div>
  );
}

/* ============================================
   MOVIE ROW COMPONENT
   ============================================ */

function MovieRowComponent({
  title,
  items,
  onItemClick,
  onQuickAdd,
  onWatched,
}: {
  title: string;
  items: any[];
  onItemClick: (item: any) => void;
  onQuickAdd: (item: any, e: React.MouseEvent) => void;
  onWatched: (item: any, e: React.MouseEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  return (
    <div className="movie-row-section">
      <div className="movie-row-header">
        <h2 className="movie-row-title">{title}</h2>
        <ChevronRight size={20} className="movie-row-arrow" />
      </div>

      <div className="movie-row-wrapper">
        {canScrollLeft && (
          <button className="row-scroll-btn row-scroll-left" onClick={() => scroll("left")}>
            <ChevronRight size={28} style={{ transform: "rotate(180deg)" }} />
          </button>
        )}

        <div className="movie-row-scroll" ref={scrollRef}>
          {items.map((item, i) => (
            <div
              key={`${item.id}-${i}`}
              className="row-card"
              onClick={() => onItemClick(item)}
            >
              <img
                src={`${IMAGE_BASE_URL}${item.poster_path}`}
                alt={item.title || item.name}
                className="row-card-poster"
                loading="lazy"
              />
              <div className="row-card-hover">
                <div className="row-card-hover-info">
                  <span className="row-card-hover-title">{item.title || item.name}</span>
                  <div className="row-card-hover-meta">
                    {item.vote_average > 0 && (
                      <span className="row-card-rating">
                        <Star size={12} fill="#f1c40f" stroke="#f1c40f" />
                        {item.vote_average.toFixed(1)}
                      </span>
                    )}
                    <span className="row-card-year">
                      {(item.release_date || item.first_air_date || "").slice(0, 4)}
                    </span>
                  </div>
                </div>
                <div className="row-card-hover-actions">
                  <button className="row-card-btn play" title="Mark as Watched" onClick={(e) => onWatched(item, e)}>
                    <Check size={14} color="#000" strokeWidth={3} />
                  </button>
                  <button className="row-card-btn add" onClick={(e) => onQuickAdd(item, e)}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button className="row-scroll-btn row-scroll-right" onClick={() => scroll("right")}>
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  );
}
