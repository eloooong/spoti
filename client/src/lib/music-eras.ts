import type { Track } from "./api";

export interface MusicEra {
  decade: string;
  count: number;
}

export interface DatedTrack {
  track: Track;
  year: number;
}

export interface MusicErasSummary {
  eras: MusicEra[];
  leadingDecades: string[];
  oldest: DatedTrack | null;
  newest: DatedTrack | null;
  datedTracks: number;
  totalTracks: number;
}

// Spotify dates may have year, month, or day precision. Keep the supplied year;
// never interpret an absent date as the current year or the Unix epoch.
function releaseYear(value: string | undefined, currentYear: number): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1 || year > currentYear) return null;
  if (match[2]) {
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    if (match[3]) {
      const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const day = Number(match[3]);
      if (day < 1 || day > days[month - 1]) return null;
    }
  }
  return year;
}

export function buildMusicEras(tracks: Track[] | null, currentYear = new Date().getFullYear()): MusicErasSummary | null {
  if (tracks === null) return null;
  const counts = new Map<number, number>();
  const dated: DatedTrack[] = [];
  for (const track of tracks) {
    const year = releaseYear(track.album?.release_date, currentYear);
    if (year === null) continue;
    dated.push({ track, year });
    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  const eras = [...counts].sort(([a], [b]) => a - b).map(([decade, count]) => ({ decade: `${decade}s`, count }));
  const leadingCount = Math.max(0, ...eras.map(era => era.count));
  dated.sort((a, b) => a.year - b.year);
  return {
    eras,
    leadingDecades: eras.filter(era => era.count === leadingCount).map(era => era.decade),
    oldest: dated[0] ?? null,
    newest: dated.at(-1) ?? null,
    datedTracks: dated.length,
    totalTracks: tracks.length,
  };
}
