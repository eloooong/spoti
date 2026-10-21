import type { Artist, Track } from "./api";

export interface SoundRow {
  label: string;
  count: number;
}

export interface SoundBreakdown {
  source: "genres" | "artists";
  rows: SoundRow[];
  taggedArtists: number;
  totalArtists: number;
}

// Genre metadata can be absent even when listening history is available.
// Use actual track credits as a fallback; never guess an artist's genre.
export function buildSoundBreakdown(artists: Artist[] | null, tracks: Track[] | null): SoundBreakdown | null {
  if (artists === null) return null;
  const counts = new Map<string, SoundRow>();
  let taggedArtists = 0;
  const add = (key: string, label: string) => {
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { label, count: 1 });
  };

  for (const artist of artists) {
    const tags = new Map<string, string>();
    for (const genre of artist.genres ?? []) {
      const label = genre.trim();
      if (label) tags.set(label.toLowerCase(), label);
    }
    if (tags.size) taggedArtists += 1;
    for (const [key, label] of tags) add(key, label);
  }

  const source = counts.size ? "genres" : "artists";
  if (source === "artists") {
    if (tracks === null) return null;
    for (const track of tracks) {
      const credited = new Set<string>();
      for (const artist of track.artists) {
        const label = artist.name.trim();
        const key = artist.id || label.toLowerCase();
        if (!label || credited.has(key)) continue;
        credited.add(key);
        add(key, label);
      }
    }
  }

  return {
    source,
    rows: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    taggedArtists,
    totalArtists: artists.length,
  };
}
