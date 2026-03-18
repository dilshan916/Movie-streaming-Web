import { ArrowLeft, Clock, Plus, Star, Tv } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMedia } from "../context/MediaContext";
import tmdbClient, { BACKDROP_BASE_URL, IMAGE_BASE_URL } from "../lib/tmdb";

export default function MovieDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "movie";
  const navigate = useNavigate();
  const { addMedia, media } = useMedia();

  const [details, setDetails] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isInLibrary = media.some((m) => m.tmdbId === Number(id));

  useEffect(() => {
    fetchDetails();
  }, [id, type]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [detailsRes, creditsRes, similarRes] = await Promise.all([
        tmdbClient.get(`/${type}/${id}`, { params: { language: "en-US" } }),
        tmdbClient.get(`/${type}/${id}/credits`, { params: { language: "en-US" } }),
        tmdbClient.get(`/${type}/${id}/similar`, { params: { language: "en-US", page: 1 } }),
      ]);
      setDetails(detailsRes.data);
      setCredits(creditsRes.data);
      setSimilar(
        (similarRes.data.results || [])
          .filter((r: any) => r.poster_path)
          .slice(0, 12)
          .map((r: any) => ({ ...r, media_type: type }))
      );
    } catch (e) {
      console.error("Error fetching details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!details) return;
    await addMedia({
      title: details.title || details.name,
      type: type === "tv" ? "TV Series" : "Movie",
      status: "Want to Watch",
      poster: details.poster_path ? `${IMAGE_BASE_URL}${details.poster_path}` : undefined,
      tmdbId: details.id,
      genre: details.genres?.[0]?.name,
      runtime: details.runtime,
      numberOfEpisodes: details.number_of_episodes,
    });
  };

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  if (!details) {
    return (
      <div className="empty-state">
        <h3>Not Found</h3>
        <p>Could not find this title.</p>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const year = (details.release_date || details.first_air_date || "").slice(0, 4);
  const runtime = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : null;
  const cast = credits?.cast?.slice(0, 8) || [];

  return (
    <div>
      {/* Back button */}
      <button
        className="btn btn-ghost"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      {/* Backdrop hero */}
      <div style={{
        position: "relative",
        width: "100%",
        height: 400,
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        marginBottom: 32,
      }}>
        <img
          src={details.backdrop_path ? `${BACKDROP_BASE_URL}${details.backdrop_path}` : ""}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, var(--bg-primary) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)",
        }} />
      </div>

      {/* Content */}
      <div style={{ display: "flex", gap: 32, marginTop: -120, position: "relative", zIndex: 1 }}>
        {/* Poster */}
        <img
          src={details.poster_path ? `${IMAGE_BASE_URL}${details.poster_path}` : ""}
          alt={details.title || details.name}
          style={{
            width: 200, height: 300,
            borderRadius: "var(--radius-lg)",
            objectFit: "cover",
            boxShadow: "var(--shadow-lg)",
            flexShrink: 0,
          }}
        />

        {/* Info */}
        <div style={{ flex: 1, paddingTop: 16 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            {details.title || details.name}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {year && <span className="badge badge-accent">{year}</span>}
            {runtime && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: 14 }}>
                <Clock size={14} /> {runtime}
              </span>
            )}
            {details.number_of_seasons && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: 14 }}>
                <Tv size={14} /> {details.number_of_seasons} Season{details.number_of_seasons > 1 ? "s" : ""}
              </span>
            )}
            {details.vote_average > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--warning)", fontWeight: 600, fontSize: 14 }}>
                <Star size={14} /> {details.vote_average.toFixed(1)}
              </span>
            )}
          </div>

          {/* Genres */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {details.genres?.map((g: any) => (
              <span key={g.id} className="chip" style={{ cursor: "default" }}>{g.name}</span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {!isInLibrary ? (
              <button className="btn btn-secondary btn-lg" onClick={handleAdd}>
                <Plus size={18} /> Add to Watchlist
              </button>
            ) : (
              <button className="btn btn-secondary btn-lg" disabled>
                ✓ In Your Library
              </button>
            )}
          </div>

          {/* Overview */}
          {details.overview && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Overview</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8 }}>
                {details.overview}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cast */}
      {cast.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className="section-header">
            <h3 className="section-title">Cast</h3>
          </div>
          <div className="horizontal-scroll">
            {cast.map((person: any) => (
              <div
                key={person.id}
                style={{
                  width: 120, textAlign: "center",
                  background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
                  padding: 12, border: "1px solid var(--border)",
                }}
              >
                <img
                  src={person.profile_path ? `${IMAGE_BASE_URL}${person.profile_path}` : "https://via.placeholder.com/96x96/141414/666?text=?"}
                  alt={person.name}
                  style={{
                    width: 80, height: 80, borderRadius: "50%",
                    objectFit: "cover", margin: "0 auto 8px",
                    background: "var(--bg-elevated)",
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {person.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {person.character}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar */}
      {similar.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className="section-header">
            <h3 className="section-title">Similar Titles</h3>
          </div>
          <div className="movie-grid">
            {similar.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="movie-card"
                onClick={() => navigate(`/movie/${item.id}?type=${item.media_type || "movie"}`)}
              >
                <img
                  src={item.poster_path ? `${IMAGE_BASE_URL}${item.poster_path}` : ""}
                  alt={item.title || item.name}
                  className="movie-card-poster"
                />
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
        </div>
      )}
    </div>
  );
}
