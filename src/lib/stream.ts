/**
 * Stream Helper Service for Web
 * Ports the streaming logic from the mobile APK.
 */

const CONSUMET_URL = import.meta.env.VITE_CONSUMET_URL || "https://api.consumet.org";

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
    // Step 0: Get basic metadata (Title) from TMDB via Consumet
    const tmdbInfoUrl = `${CONSUMET_URL}/meta/tmdb/info/${id}?type=${type === "tv" ? "tv" : "movie"}`;
    console.log(`[StreamService] Fetching TMDB Info: ${tmdbInfoUrl}`);

    const tmdbRes = await fetchWithCors(tmdbInfoUrl);
    const tmdbData = tmdbRes.ok ? await tmdbRes.json() : null;

    let episodeId: string | undefined;

    // STRATEGY A: Try direct TMDB mapping first
    if (tmdbData) {
      if (type === "movie") {
        if (tmdbData.episodes && tmdbData.episodes.length > 0) {
          episodeId = tmdbData.episodes[0].id;
        }
      } else if (type === "tv" && season && episode) {
        const targetEp = tmdbData.episodes?.find(
          (ep: any) => ep.season === season && ep.number === episode
        );
        if (targetEp) {
          episodeId = targetEp.id;
        }
      }
    }

    // STRATEGY B: Search via FlixHQ (Fallback)
    if (!episodeId && tmdbData?.title) {
      const queryRaw = tmdbData.title;
      const query = encodeURIComponent(queryRaw);
      console.log(`[StreamService] Strategy A failed. Searching FlixHQ for: ${queryRaw}`);

      const searchUrl = `${CONSUMET_URL}/movies/flixhq/${query}`;
      const searchRes = await fetchWithCors(searchUrl);
      const searchData = searchRes.ok ? await searchRes.json() : null;

      if (searchData && searchData.results && searchData.results.length > 0) {
        const bestMatch = searchData.results[0];
        console.log(`[StreamService] FlixHQ Match Found: ${bestMatch.id} (${bestMatch.title})`);

        const flixHqInfoUrl = `${CONSUMET_URL}/movies/flixhq/info?id=${bestMatch.id}`;
        const flixInfoRes = await fetchWithCors(flixHqInfoUrl);
        const flixInfoData = flixInfoRes.ok ? await flixInfoRes.json() : null;

        if (flixInfoData) {
          if (type === "movie") {
            episodeId = flixInfoData.episodes?.[0]?.id;
          } else if (type === "tv" && season && episode) {
            const targetEp = flixInfoData.episodes?.find(
              (ep: any) => ep.season === season && ep.number === episode
            );
            if (targetEp) {
              episodeId = targetEp.id;
            }
          }
        }
      }
    }

    if (!episodeId) {
      console.error("[StreamService] No matching episode ID found after all strategies.");
      return null;
    }

    // 3. Fetch Stream Sources
    let watchUrl = "";
    if (episodeId.includes("flixhq") || !tmdbData) {
      watchUrl = `${CONSUMET_URL}/movies/flixhq/watch?episodeId=${episodeId}`;
    } else {
      watchUrl = `${CONSUMET_URL}/meta/tmdb/watch/${episodeId}`;
    }

    console.log(`[StreamService] Fetching Stream from: ${watchUrl}`);

    const watchRes = await fetchWithCors(watchUrl);
    if (!watchRes.ok) {
      console.error("[StreamService] Stream fetch failed with status:", watchRes.status);
      return null;
    }

    const watchData = await watchRes.json();

    // 4. Extract best .m3u8 source
    if (watchData.sources && Array.isArray(watchData.sources)) {
      const m3u8Source =
        watchData.sources.find((s: any) => s.quality === "auto") ||
        watchData.sources.find((s: any) => s.quality === "1080p") ||
        watchData.sources[0];

      if (m3u8Source?.url) {
        console.log("[StreamService] Stream URL found:", m3u8Source.url);
        return m3u8Source.url;
      }
    }

    return null;
  } catch (error) {
    console.error("[StreamService] Error fetching stream:", error);
    return null;
  }
};
