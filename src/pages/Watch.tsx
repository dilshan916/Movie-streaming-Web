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
  Subtitles,
  Upload,
  Search,
  Plus,
  Minus,
  Settings2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import tmdbClient, { IMAGE_BASE_URL } from "../lib/tmdb";
import { getDirectStreamUrl } from "../lib/stream";
import Hls from "hls.js";





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
  const [imdbId, setImdbId] = useState<string | null>(null);
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
  
  // HLS.js Quality state
  const hlsRef = useRef<Hls | null>(null);
  const [qualities, setQualities] = useState<{ height: number; bitrate: number; index: number; name?: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const showSettingsMenuRef = useRef(showSettingsMenu);
  useEffect(() => { showSettingsMenuRef.current = showSettingsMenu; }, [showSettingsMenu]);

  // Subtitle state
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [cues, setCues] = useState<any[]>([]);
  const [subtitleSettings, setSubtitleSettings] = useState({ size: 24, bottom: 80, color: '#ffffff' });
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0); // in seconds
  const [rawSubtitleText, setRawSubtitleText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use a ref for showSubtitleMenu to access its latest value inside timeouts
  const showSubtitleMenuRef = useRef(showSubtitleMenu);
  useEffect(() => {
    showSubtitleMenuRef.current = showSubtitleMenu;
  }, [showSubtitleMenu]);

  // Parse Subtitles into Cues
  useEffect(() => {
    if (!rawSubtitleText) {
      setCues([]);
      return;
    }

    const timeRegex = /(\d{2,}:\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2,}:\d{2}:\d{2}[\.,]\d{3})/;
    const parseMs = (timeStr: string) => {
      const parts = timeStr.replace(',', '.').split(':');
      const secParts = parts[parts.length - 1].split('.');
      const h = parseInt(parts.length > 2 ? parts[0] : '0');
      const m = parseInt(parts.length > 2 ? parts[1] : parts[0]);
      const s = parseInt(secParts[0]);
      const ms = parseInt(secParts[1]);
      return (h * 3600000 + m * 60000 + s * 1000 + ms) / 1000; // seconds
    };

    const lines = rawSubtitleText.split('\n');
    const parsedCues: any[] = [];
    let currentCue: any = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line && currentCue && currentCue.text) {
        parsedCues.push(currentCue);
        currentCue = null;
        continue;
      }
      
      const match = timeRegex.exec(line);
      if (match) {
        if (currentCue && currentCue.text) parsedCues.push(currentCue);
        currentCue = {
          id: parsedCues.length.toString(),
          start: parseMs(match[1]),
          end: parseMs(match[2]),
          text: ''
        };
      } else if (currentCue && line && !line.includes('WEBVTT')) {
        currentCue.text = currentCue.text ? currentCue.text + '\n' + line : line;
      }
    }
    if (currentCue && currentCue.text) parsedCues.push(currentCue);
    setCues(parsedCues);

  }, [rawSubtitleText]);

  const activeCues = cues.filter(c => 
    currentTime >= (c.start + subtitleOffset) && 
    currentTime <= (c.end + subtitleOffset)
  );

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      if (!text.startsWith("WEBVTT")) {
        text = "WEBVTT\n\n" + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
      }
      setRawSubtitleText(text);
      setSubtitleOffset(0);
      setShowSubtitleMenu(false);
    };
    reader.readAsText(file);
  };

  // Setup HLS.js for .m3u8 streams
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    
    if (Hls.isSupported() && streamUrl.includes(".m3u8")) {
      const PROXY_BASE = (import.meta.env.VITE_STREAM_API_URL || "http://localhost:8000") + "/proxy";
      const hls = new Hls({
        maxMaxBufferLength: 60,
        xhrSetup: (xhr: XMLHttpRequest, url: string) => {
          // Route ALL HLS requests through our Python proxy to bypass CORS
          const proxiedUrl = `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
          xhr.open('GET', proxiedUrl, true);
          xhr.setRequestHeader("ngrok-skip-browser-warning", "true");
        },
      });
      hlsRef.current = hls;
      
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      // Log errors so we can debug playback failures
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("[HLS] Error:", data.type, data.details, data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("[HLS] Fatal network error, trying to recover...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("[HLS] Fatal media error, trying to recover...");
              hls.recoverMediaError();
              break;
            default:
              console.error("[HLS] Fatal error, cannot recover");
              hls.destroy();
              break;
          }
        }
      });
      
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        // Extract available qualities
        const availableQualities = data.levels.map((level, index) => ({
          height: level.height,
          bitrate: level.bitrate,
          name: level.name,
          index: index
        })).sort((a, b) => b.height - a.height); // Highest quality first
        
        // Only show quality selector if there are multiple qualities available
        if (data.levels.length > 1) {
          setQualities(availableQualities);
        } else {
          setQualities([]);
        }
        
        setCurrentQuality(-1); // Start on Auto
        
        video.play().catch(e => console.error("Auto-play prevented", e));
        setIsPlaying(true);
      });

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari Native support (no manual quality control natively without complicated MSE)
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error("Auto-play prevented", e));
        setIsPlaying(true);
      });
    } else {
      video.src = streamUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  // Fetch title info
  useEffect(() => {
    if (!id) return;
    const mediaType = isTv ? "tv" : "movie";
    tmdbClient
      .get(`/${mediaType}/${id}`, { params: { language: "en-US", append_to_response: "external_ids" } })
      .then((res) => {
        setMovieTitle(res.data.title || res.data.name || "");
        if (res.data.external_ids?.imdb_id) {
          setImdbId(res.data.external_ids.imdb_id);
        }
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
      name: "Server 1 (VidLink - Recommended)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidlink.pro/movie/${id}?primaryColor=e50914&autoplay=false` 
          : `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e50914&autoplay=false`,
    },
    {
      name: "Server 2 (AutoEmbed)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://autoembed.co/movie/tmdb/${id}` 
          : `https://autoembed.co/tv/tmdb/${id}-${s}-${e}`,
    },
    {
      name: "Server 2 (VidSrc.net)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidsrc.net/embed/movie?tmdb=${id}` 
          : `https://vidsrc.net/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      name: "Server 3 (VidSrc.xyz)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidsrc.xyz/embed/movie?tmdb=${id}` 
          : `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    },
    {
      name: "Server 4 (VidSrc.cc)",
      getUrl: (media: string, id: string, s?: number | null, e?: number | null) =>
        media === "movie" 
          ? `https://vidsrc.cc/v2/embed/movie/${id}` 
          : `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
    },
  ];

  const [selectedServer, setSelectedServer] = useState(0);

  // Update iframe URL when server changes
  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSubtitleMenuRef.current && !showSettingsMenuRef.current) {
          setShowControls(false);
          setShowSubtitleMenu(false);
          setShowSettingsMenu(false);
        }
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showControls, isPlaying]);

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

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showSubtitleMenuRef.current && !showSettingsMenuRef.current) {
        setShowControls(false);
        setShowSubtitleMenu(false);
        setShowSettingsMenu(false);
      }
    }, 3000);
  }, []);

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
        className={`watch-player-container ${!showControls ? 'hide-cursor' : ''}`}
        onMouseMove={resetControlsTimeout}
        onMouseLeave={() => {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          setShowControls(false);
          setShowSubtitleMenu(false);
          setShowSettingsMenu(false);
        }}
        onClick={() => {
          setShowControls(!showControls);
          setShowSubtitleMenu(false);
          setShowSettingsMenu(false);
        }}
      >
        <video
          ref={videoRef}
          className="watch-video"
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
            setShowSubtitleMenu(false);
          }}
        />

        {/* Custom Subtitles Overlay */}
        {activeCues.length > 0 && (
          <div 
            className={`watch-custom-subtitles ${showControls ? 'controls-visible' : ''}`}
            style={{
              bottom: `${showControls ? subtitleSettings.bottom + 80 : subtitleSettings.bottom}px`,
              fontSize: `${subtitleSettings.size}px`,
              color: subtitleSettings.color
            }}
          >
            {activeCues.map((c, i) => (
              <div key={i} className="watch-subtitle-line" dangerouslySetInnerHTML={{ __html: c.text.replace(/\n/g, '<br/>') }} />
            ))}
          </div>
        )}

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

              {/* Subtitles Menu */}
              <div style={{ position: 'relative' }}>
                <button 
                  className={`watch-icon-btn ${cues.length > 0 ? 'active' : ''}`} 
                  onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                >
                  <Subtitles size={20} color={cues.length > 0 ? "#e50914" : "white"} />
                </button>
                
                {showSubtitleMenu && (
                  <div className="watch-subtitle-menu" onClick={e => e.stopPropagation()}>
                    <h4>Subtitles</h4>
                    <div className="subtitle-menu-divider" />
                    
                    <button className="subtitle-menu-btn" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={16} />
                      Upload Local (.srt / .vtt)
                    </button>
                    <button 
                      className="subtitle-menu-btn" 
                      onClick={async () => {
                        try {
                          if (!imdbId) throw new Error("No IMDB ID");
                          setRawSubtitleText("WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nSearching for subtitles online...");
                          const url = `${import.meta.env.VITE_STREAM_API_URL || 'http://localhost:8000'}/subtitle/${imdbId}${isTv && selectedSeason ? `?s=${selectedSeason}&e=${currentEpisodeInfo ? parseInt(currentEpisodeInfo.split("E")[1]) : 1}` : ''}`;
                          const res = await fetch(url, {
                            headers: {
                              "ngrok-skip-browser-warning": "true"
                            }
                          });
                          if (!res.ok) throw new Error("Not found");
                          const data = await res.json();
                          
                          let text = data.text;
                          if (!text.startsWith("WEBVTT")) {
                            text = "WEBVTT\n\n" + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
                          }
                          setRawSubtitleText(text);
                          setSubtitleOffset(0);
                        } catch (err) {
                          setRawSubtitleText("WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nCould not find English subtitles for this title.");
                          setTimeout(() => setRawSubtitleText(""), 5000);
                        }
                      }}
                    >
                      <Search size={16} />
                      Search Online (English)
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept=".srt,.vtt" 
                      style={{ display: 'none' }} 
                      onChange={handleSubtitleUpload}
                    />

                    {cues.length > 0 && (
                      <>
                        <div className="subtitle-menu-divider" />
                        
                        <div className="subtitle-sync-control">
                          <span style={{ fontSize: 13, color: '#aaa' }}>Sync Delay</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <button className="sync-btn" onClick={() => setSubtitleOffset(prev => prev - 0.5)}><Minus size={14} /></button>
                            <span style={{ fontSize: 13, minWidth: 40, textAlign: 'center' }}>{subtitleOffset > 0 ? '+' : ''}{subtitleOffset.toFixed(1)}s</span>
                            <button className="sync-btn" onClick={() => setSubtitleOffset(prev => prev + 0.5)}><Plus size={14} /></button>
                          </div>
                        </div>

                        <div className="subtitle-sync-control" style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 13, color: '#aaa' }}>Text Size</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <button className="sync-btn" onClick={() => setSubtitleSettings(s => ({ ...s, size: Math.max(12, s.size - 2) }))}><Minus size={14} /></button>
                            <span style={{ fontSize: 13, minWidth: 40, textAlign: 'center' }}>{subtitleSettings.size}px</span>
                            <button className="sync-btn" onClick={() => setSubtitleSettings(s => ({ ...s, size: Math.min(60, s.size + 2) }))}><Plus size={14} /></button>
                          </div>
                        </div>

                        <div className="subtitle-sync-control" style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 13, color: '#aaa' }}>Vertical Position</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <button className="sync-btn" onClick={() => setSubtitleSettings(s => ({ ...s, bottom: Math.max(20, s.bottom - 10) }))}><Minus size={14} /></button>
                            <span style={{ fontSize: 13, minWidth: 40, textAlign: 'center' }}>{subtitleSettings.bottom}px</span>
                            <button className="sync-btn" onClick={() => setSubtitleSettings(s => ({ ...s, bottom: Math.min(500, s.bottom + 10) }))}><Plus size={14} /></button>
                          </div>
                        </div>

                        <button className="subtitle-menu-btn" onClick={() => {
                          setRawSubtitleText("");
                          setSubtitleOffset(0);
                        }} style={{ color: '#ff4444', marginTop: 12 }}>
                          Remove Subtitle
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Settings Menu (Quality) */}
              {qualities.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button 
                    className={`watch-icon-btn ${showSettingsMenu ? 'active' : ''}`} 
                    onClick={() => {
                      setShowSettingsMenu(!showSettingsMenu);
                      setShowSubtitleMenu(false);
                    }}
                  >
                    <Settings2 size={20} />
                  </button>
                  
                  {showSettingsMenu && (
                    <div className="watch-subtitle-menu" onClick={e => e.stopPropagation()}>
                      <h4>Video Quality</h4>
                      <div className="subtitle-menu-divider" />
                      
                      <button 
                        className="subtitle-menu-btn" 
                        style={{ color: currentQuality === -1 ? '#e50914' : 'white', fontWeight: currentQuality === -1 ? 600 : 400 }}
                        onClick={() => {
                          if (hlsRef.current) {
                            hlsRef.current.currentLevel = -1;
                            setCurrentQuality(-1);
                          }
                          setShowSettingsMenu(false);
                        }}
                      >
                        Auto
                      </button>

                      {qualities.map((q) => (
                        <button 
                          key={q.index}
                          className="subtitle-menu-btn" 
                          style={{ color: currentQuality === q.index ? '#e50914' : 'white', fontWeight: currentQuality === q.index ? 600 : 400 }}
                          onClick={() => {
                            if (hlsRef.current) {
                              hlsRef.current.currentLevel = q.index;
                              setCurrentQuality(q.index);
                            }
                            setShowSettingsMenu(false);
                          }}
                        >
                          {q.height > 0 ? `${q.height}p` : (q.name || `Quality ${q.index + 1}`)}
                          {q.bitrate ? ` (${(q.bitrate / 1000000).toFixed(1)} Mbps)` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
