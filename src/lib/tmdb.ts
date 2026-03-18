import axios from "axios";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const tmdbClient = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

tmdbClient.interceptors.request.use((config) => {
  config.params = config.params || {};
  if (!config.params.api_key) {
    config.params.api_key = TMDB_API_KEY;
  }
  return config;
});

export const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
export const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";

export default tmdbClient;
