// Typed wrappers around the backend's endpoints. The backend talks to
// Spotify and Groq; the browser only ever talks to the backend.

export type TimeRange = "short_term" | "medium_term" | "long_term";

export interface Image {
  url: string;
}

export interface Artist {
  id: string;
  name: string;
  genres?: string[];
  images?: Image[];
  popularity?: number;
}

export interface Track {
  id: string;
  name: string;
  artists: Artist[];
  album?: { name?: string; images?: Image[] };
  duration_ms?: number;
  popularity?: number;
}

export interface Paged<T> {
  items: T[];
  total?: number;
}

export interface RecentlyPlayedEntry {
  track: Track;
  played_at: string;
  context?: { type?: string; uri?: string };
}

export interface NowPlaying {
  is_playing: boolean;
  progress_ms?: number | null;
  item?: Track | null;
  device?: { name?: string; volume_percent?: number };
  shuffle_state?: boolean;
  repeat_state?: "off" | "track" | "context";
}

export interface SpotifyLink {
  spotify?: string;
}

export interface Playlist {
  id: string;
  name: string;
  images?: Image[];
  external_urls?: SpotifyLink;
  items?: { total: number };
  tracks?: { total: number };
}

export interface LibrarySnapshot {
  followedArtists: number;
  savedTracks: number;
  savedAlbums: number;
  playlists: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// AI endpoints need richer error reporting than fetchJSON's collapse-to-null:
// 501 means "feature not configured" (hide the panels), while other failures
// (500/429/network) are transient and should surface a retry state instead.
export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null };

async function fetchAi<T>(url: string): Promise<AiResult<T>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: null };
  }
}

export type ApiFailure = "premium_required" | "not_logged_in" | "unavailable";
const errorListeners = new Set<(failure: ApiFailure) => void>();

export function onApiError(listener: (failure: ApiFailure) => void) {
  errorListeners.add(listener);
  return () => { errorListeners.delete(listener); };
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const failure: ApiFailure = body?.error === "premium_required" ? "premium_required" : res.status === 401 ? "not_logged_in" : "unavailable";
      if (url !== "/api/status") errorListeners.forEach((listener) => listener(failure));
      return null;
    }
    return (await res.json()) as T;
  } catch {
    if (url !== "/api/status") errorListeners.forEach((listener) => listener("unavailable"));
    return null;
  }
}

export const api = {
  status: () => fetchJSON<{ logged_in: boolean }>("/api/status"),

  topArtists: (range: TimeRange) =>
    fetchJSON<Paged<Artist>>(`/api/top-artists?range=${range}`),

  topTracks: (range: TimeRange) =>
    fetchJSON<Paged<Track>>(`/api/top-tracks?range=${range}`),

  recent: () => fetchJSON<Paged<RecentlyPlayedEntry>>("/api/recent"),

  nowPlaying: () => fetchJSON<NowPlaying | null>("/api/now-playing"),

  playlists: () => fetchJSON<Paged<Playlist>>("/api/playlists"),

  playlistMeta: (id: string) =>
    fetchJSON<{ name?: string; images?: Image[]; external_urls?: SpotifyLink }>(
      `/api/playlist-meta?id=${encodeURIComponent(id)}`
    ),

  librarySnapshot: () => fetchJSON<LibrarySnapshot>("/api/library-snapshot"),

  aiTasteProfile: (refresh = false) =>
    fetchAi<{ profile?: string; cached?: boolean; error?: string }>(
      `/api/ai-taste-profile${refresh ? "?refresh=1" : ""}`
    ),

  aiRecap: (refresh = false) =>
    fetchAi<{ recap?: string; cached?: boolean; error?: string }>(
      `/api/ai-recap${refresh ? "?refresh=1" : ""}`
    ),

  aiChat: async (
    message: string,
    history: ChatTurn[]
  ): Promise<AiResult<{ reply?: string; error?: string }>> => {
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) return { ok: false, status: res.status };
      return { ok: true, data: (await res.json()) as { reply?: string; error?: string } };
    } catch {
      return { ok: false, status: null };
    }
  },
};

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
