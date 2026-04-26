import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Film,
  Loader2,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Tv,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import tmdbClient, { IMAGE_BASE_URL } from "../lib/tmdb";
import { getDirectStreamUrl } from "../lib/stream";



export default function WatchPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "movie";
  const navigate = useNavigate();

  const isTv = type === "tv" || type === "TV Series";

  // Stream state
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TV series state
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [showSelection, setShowSelection] = useState(isTv);
  const [movieTitle, setMovieTitle] = useState("");
  const [currentEpisodeInfo, setCurrentEpisodeInfo] = useState<string>("");

  // Video player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch title info
  useEffect(() => {
    if (!id) return;
    const mediaType = isTv ? "tv" : "movie";
    tmdbClient
      .get(`/${mediaType}/${id}`, { params: { language: "en-US" } })
      .then((res) => {
        setMovieTitle(res.data.title || res.data.name || "");
      })
      .catch(() => {});
  }, [id, isTv]);

  // Initialize
  useEffect(() => {
    if (!id) return;
    if (isTv) {
      fetchSeasons();
    } else {
      fetchStreamUrl();
    }
  }, [id]);

  // Servers for iframe fallback
  const fallbackServers = [
    {
      name: "Server 1 (MultiEmbed)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1` 
          : `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    },
    {
      name: "Server 2 (AutoEmbed)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://autoembed.co/movie/tmdb/${id}` 
          : `https://autoembed.co/tv/tmdb/${id}-${s}-${e}`,
    },
    {
      name: "Server 3 (VidSrc.net)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidsrc.net/embed/movie?tmdb=${id}` 
          : `https://vidsrc.net/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      name: "Server 4 (VidSrc.xyz)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidsrc.xyz/embed/movie?tmdb=${id}` 
          : `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      name: "Server 5 (VidSrc.cc)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidsrc.cc/v2/embed/movie/${id}` 
          : `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
    },
  ];

  const [selectedServer, setSelectedServer] = useState(0);

  // Update iframe URL when server changes
  useEffect(() => {
    if (iframeUrl && !streamUrl) {
      const mediaType = isTv ? "tv" : "movie";
      setIframeUrl(fallbackServers[selectedServer].getUrl(mediaType, id!, selectedSeason, currentEpisodeInfo ? parseInt(currentEpisodeInfo.split("E")[1]) : null));
    }
  }, [selectedServer]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying && streamUrl) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showControls, isPlaying, streamUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!streamUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBackward();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekForward();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen?.();
          }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [streamUrl, isPlaying, isFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const fetchSeasons = async () => {
    setLoading(true);
    try {
      const res = await tmdbClient.get(`/tv/${id}`, { params: { language: "en-US" } });
      const data = res.data;
      setMovieTitle(data.name || data.title || "");
      if (data.seasons) {
        setSeasons(data.seasons.filter((s: any) => s.season_number > 0));
      }
    } catch (err) {
      console.error("[Watch] Error fetching seasons:", err);
      setError("Failed to load seasons.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEpisodes = async (seasonNumber: number) => {
    setLoading(true);
    setSelectedSeason(seasonNumber);
    try {
      const res = await tmdbClient.get(`/tv/${id}/season/${seasonNumber}`, {
        params: { language: "en-US" },
      });
      const data = res.data;
      if (data.episodes) {
        setEpisodes(data.episodes);
      }
    } catch (err) {
      console.error("[Watch] Error fetching episodes:", err);
      setError("Failed to load episodes.");
    } finally {
      setLoading(false);
    }
  };

  const handleEpisodeSelect = (episodeNumber: number, episodeName?: string) => {
    setCurrentEpisodeInfo(`S${selectedSeason} E${episodeNumber}${episodeName ? ` — ${episodeName}` : ""}`);
    fetchStreamUrl(selectedSeason, episodeNumber);
  };

  const fetchStreamUrl = async (season?: number | null, episode?: number | null) => {
    setLoading(true);
    setError(null);
    setStreamUrl(null);
    setIframeUrl(null);

    const mediaType = isTv ? "tv" : "movie";
    console.log(`[Watch] Fetching stream for ${mediaType} ${id} ${season ? `S${season}E${episode}` : ""}`);

    try {
      const url = await getDirectStreamUrl(
        id!,
        mediaType,
        season || undefined,
        episode || undefined
      );

      if (url) {
        setStreamUrl(url);
        setShowSelection(false);
      } else {
        console.log("[Watch] Native stream not found, falling back to iframe embed");
        const fallbackUrl = fallbackServers[selectedServer].getUrl(mediaType, id!, season, episode);
        setIframeUrl(fallbackUrl);
        setShowSelection(false);
      }
    } catch (err) {
      console.error("[Watch] Stream fetch error:", err);
      setError("Stream Not Found — This title may not be available for streaming yet.");
    } finally {
      setLoading(false);
    }
  };

  // Video player controls
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  }, []);

  const seekBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 10);
    resetControlsTimeout();
  }, []);

  const seekForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
    resetControlsTimeout();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = playerContainerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    video.currentTime = percentage * video.duration;
    resetControlsTimeout();
  }, []);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleGoBack = () => {
    if (streamUrl || iframeUrl) {
      // If we're watching, go back to selection (for TV) or go back
      if (isTv) {
        setStreamUrl(null);
        setIframeUrl(null);
        setShowSelection(true);
        return;
      }
    }
    navigate(-1);
  };

  // ========== RENDER: Native Video Player ==========
  if (streamUrl) {
    return (
      <div
        ref={playerContainerRef}
        className="watch-player-container"
        onMouseMove={resetControlsTimeout}
        onClick={() => setShowControls(!showControls)}
      >
        <video
          ref={videoRef}
          className="watch-video"
          src={streamUrl}
          autoPlay
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            const video = videoRef.current;
            if (video) setCurrentTime(video.currentTime);
          }}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video) setDuration(video.duration);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
        />

        {/* Buffering indicator */}
        {isBuffering && (
          <div className="watch-buffering">
            <Loader2 size={48} className="watch-spinner" />
          </div>
        )}

        {/* Controls overlay */}
        <div className={`watch-controls-overlay ${showControls ? "visible" : ""}`} onClick={(e) => e.stopPropagation()}>
          {/* Top gradient + back button */}
          <div className="watch-controls-top">
            <button className="watch-back-btn" onClick={handleGoBack}>
              <ArrowLeft size={24} />
              <span>Back</span>
            </button>
            <div className="watch-title-info">
              <span className="watch-movie-title">{movieTitle}</span>
              {currentEpisodeInfo && (
                <span className="watch-episode-info">{currentEpisodeInfo}</span>
              )}
            </div>
          </div>

          {/* Center play/pause + seek */}
          <div className="watch-controls-center">
            <button className="watch-seek-btn" onClick={seekBackward}>
              <SkipBack size={28} />
              <span className="watch-seek-label">10s</span>
            </button>
            <button className="watch-play-btn" onClick={togglePlayPause}>
              {isPlaying ? <Pause size={40} /> : <Play size={40} style={{ marginLeft: 4 }} />}
            </button>
            <button className="watch-seek-btn" onClick={seekForward}>
              <SkipForward size={28} />
              <span className="watch-seek-label">10s</span>
            </button>
          </div>

          {/* Bottom progress + volume */}
          <div className="watch-controls-bottom">
            <div className="watch-progress-row">
              <span className="watch-time">{formatTime(currentTime)}</span>
              <div className="watch-progress-bar" onClick={handleProgressClick}>
                <div className="watch-progress-bg" />
                <div
                  className="watch-progress-fill"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                <div
                  className="watch-progress-thumb"
                  style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="watch-time">{formatTime(duration)}</span>
            </div>
            <div className="watch-bottom-actions">
              <div className="watch-volume-group">
                <button className="watch-icon-btn" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  className="watch-volume-slider"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                />
              </div>
              <button className="watch-icon-btn" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== RENDER: Iframe Fallback ==========
  if (iframeUrl) {
    return (
      <div className="watch-iframe-container">
        <div className="watch-iframe-header" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button className="watch-back-btn" onClick={handleGoBack}>
              <ArrowLeft size={24} />
              <span>Back</span>
            </button>
            <div className="watch-title-info">
              <span className="watch-movie-title">{movieTitle}</span>
              {currentEpisodeInfo && (
                <span className="watch-episode-info">{currentEpisodeInfo}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
             <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)"}}>Too many ads? Try another server:</span>
             <select 
               style={{ background: "#222", color: "#fff", border: "1px solid #444", padding: "6px 12px", borderRadius: 4, outline: "none", cursor: "pointer" }}
               value={selectedServer}
               onChange={(e) => setSelectedServer(Number(e.target.value))}
             >
               {fallbackServers.map((server, idx) => (
                 <option key={idx} value={idx}>{server.name}</option>
               ))}
             </select>
          </div>
        </div>
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          className="watch-iframe"
          allowFullScreen
          allow="autoplay; fullscreen; encrypted-media"
        />
      </div>
    );
  }

  // ========== RENDER: Season/Episode Selection or Loading ==========
  return (
    <div className="watch-selection-page">
      {/* Header */}
      <div className="watch-selection-header">
        <button
          className="watch-back-btn"
          onClick={() => {
            if (selectedSeason) {
              setSelectedSeason(null);
              setEpisodes([]);
            } else {
              navigate(-1);
            }
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="watch-selection-title-group">
          <h1 className="watch-selection-title">
            {selectedSeason
              ? `Season ${selectedSeason}`
              : isTv
              ? "Select Season"
              : movieTitle || "Loading..."}
          </h1>
          {movieTitle && (
            <span className="watch-selection-subtitle">{movieTitle}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="watch-selection-content">
        {loading ? (
          <div className="watch-loading">
            <div className="watch-loading-logo">
              <Film size={48} />
            </div>
            <Loader2 size={32} className="watch-spinner" />
            <p className="watch-loading-text">Fetching Stream...</p>
          </div>
        ) : error ? (
          <div className="watch-error">
            <AlertCircle size={56} />
            <h3>{error}</h3>
            <button
              className="watch-retry-btn"
              onClick={() => (isTv ? fetchSeasons() : fetchStreamUrl())}
            >
              <RotateCcw size={18} />
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Season list */}
            {showSelection && !selectedSeason && (
              <div className="watch-card-list">
                {seasons.map((season: any) => (
                  <div
                    key={season.id}
                    className="watch-card"
                    onClick={() => fetchEpisodes(season.season_number)}
                  >
                    <div className="watch-card-poster-wrap">
                      {season.poster_path ? (
                        <img
                          src={`${IMAGE_BASE_URL}${season.poster_path}`}
                          alt={season.name}
                          className="watch-card-poster"
                        />
                      ) : (
                        <div className="watch-card-poster-placeholder">
                          <Tv size={32} />
                        </div>
                      )}
                    </div>
                    <div className="watch-card-info">
                      <h3 className="watch-card-title">{season.name}</h3>
                      <p className="watch-card-meta">
                        {season.episode_count} Episodes
                        {season.air_date ? ` • ${season.air_date.split("-")[0]}` : ""}
                      </p>
                    </div>
                    <ChevronRight size={22} className="watch-card-chevron" />
                  </div>
                ))}
              </div>
            )}

            {/* Episode list */}
            {showSelection && selectedSeason && (
              <div className="watch-card-list">
                {episodes.map((ep: any) => (
                  <div
                    key={ep.id}
                    className="watch-card"
                    onClick={() => handleEpisodeSelect(ep.episode_number, ep.name)}
                  >
                    <div className="watch-card-thumb-wrap">
                      {ep.still_path ? (
                        <img
                          src={`${IMAGE_BASE_URL}${ep.still_path}`}
                          alt={ep.name}
                          className="watch-card-thumb"
                        />
                      ) : (
                        <div className="watch-card-thumb-placeholder">
                          <Monitor size={24} />
                        </div>
                      )}
                      <div className="watch-card-play-overlay">
                        <Play size={24} fill="white" />
                      </div>
                    </div>
                    <div className="watch-card-info">
                      <h3 className="watch-card-title">
                        {ep.episode_number}. {ep.name}
                      </h3>
                      <p className="watch-card-desc">{ep.overview}</p>
                      {ep.runtime && (
                        <span className="watch-card-runtime">{ep.runtime} min</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
