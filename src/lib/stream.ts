/**
 * Stream Helper Service for Web
 * Ports the streaming logic from the mobile APK.
 */

const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || "https://api.consumet.org";
import tmdbClient from "./tmdb";

const fetchWithCors = async (url: string) => {
  return fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
};

export const getDirectStreamUrl = async (
  id: string | number,
  type: string,
  season?: number,
  episode?: number
): Promise<string | null> => {
  console.log(`[StreamService] Fetching stream for: Type=${type}, ID=${id}, S=${season}, E=${episode}`);

  try {
    const mediaType = type === "tv" ? "tv" : "movie";
    
    // The Python API has been updated to expect TMDB IDs for vidsrc.to
    let pythonApiUrl = `http://localhost:8000/stream/${id}?type=${mediaType}`;
    if (mediaType === "tv" && season && episode) {
      pythonApiUrl += `&s=${season}&e=${episode}`;
    }

    console.log(`[StreamService] Calling local Python API: ${pythonApiUrl}`);
    const res = await fetch(pythonApiUrl);
    
    if (!res.ok) {
      console.error("[StreamService] Python API failed with status:", res.status);
      return null;
    }

    const data = await res.json();
    if (data.url) {
      console.log("[StreamService] Stream loaded successfully via Python API!");
      return data.url;
    }
    return null;
  } catch (error) {
    console.error("[StreamService] Error fetching stream:", error);
    return null;
  }
};
