import { Loader2, X } from "lucide-react";
import ReactPlayer from "react-player";


const Player: any = ReactPlayer;

interface VideoPlayerProps {
  url: string;
  onClose: () => void;
}

export default function VideoPlayer({ url, onClose }: VideoPlayerProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          zIndex: 10000,
          background: "rgba(255, 255, 255, 0.2)",
          border: "none",
          borderRadius: "50%",
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          cursor: "pointer",
        }}
        title="Close Player"
      >
        <X size={28} />
      </button>

        {url.includes("vidsrc") ? (
          <iframe
            src={url}
            style={{ width: "100%", height: "100%", border: "none" }}
            allowFullScreen
            allow="autoplay; fullscreen"
          />
        ) : (
          <Player
            url={url}
            playing
            controls
            width="100%"
            height="100%"
            fallback={
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <Loader2 size={40} style={{ animation: "spin 1s linear infinite" }} color="var(--accent)" />
                <p>Loading Stream...</p>
              </div>
            }
            config={{
              file: {
                forceHLS: true,
                attributes: {
                  crossOrigin: "true",
                },
              },
            } as any}
          />
        )}
    </div>
  );
}
