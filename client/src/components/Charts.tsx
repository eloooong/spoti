import { useState } from "react";
import { Clock, Disc3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Artist, RecentlyPlayedEntry, Track } from "@/lib/api";
import { ChartEmpty, Panel, SkeletonLines } from "@/components/Panel";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

const GREEN = "#1db954";
const BRIGHT_GREEN = "#1ed760";
const DIM = "#b3b3b3";
const GRID_LINE = "#282828";

interface ClockRoutineProps {
  items: RecentlyPlayedEntry[] | null;
}

// ─── When You Listen (day × hour heatmap) ────────────────────────────────────
// Merges the old Listening Clock and Weekly Routine panels: one grid answers
// both "which days" and "which hours". Pure CSS cells — no chart library.

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_TICKS = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];

interface HeatCell {
  day: number;
  hour: number;
  plays: number;
}

function buildHeatmap(items: RecentlyPlayedEntry[]): HeatCell[] {
  const counts = new Array(7 * 24).fill(0);
  items.forEach((entry) => {
    const d = new Date(entry.played_at);
    counts[d.getDay() * 24 + d.getHours()] += 1;
  });

  const cells: HeatCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, plays: counts[day * 24 + hour] });
    }
  }
  return cells;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

export function ListeningHeatmap({ items }: ClockRoutineProps) {
  const [hovered, setHovered] = useState<HeatCell | null>(null);

  let cells: HeatCell[] | null = null;
  let maxPlays = 1;
  if (items && items.length > 0) {
    cells = buildHeatmap(items);
    maxPlays = Math.max(1, ...cells.map((c) => c.plays));
  }

  return (
    <Panel
     
      note="When you stream most across the week, from your last ~50 plays — hover a cell for details"
      title="When You Listen"
      wide
    >
      {!items ? (
        <div className="h-56 pt-6">
          <SkeletonLines rows={5} />
        </div>
      ) : items.length === 0 ? (
        <ChartEmpty icon={Clock}>Not enough recent plays yet.</ChartEmpty>
      ) : (
        <div>
          {/* Hour tick labels */}
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: "34px repeat(24, 1fr)" }}>
            <span />
            {Array.from({ length: 24 }).map((_, hour) => (
              <span
                className={`text-center font-mono text-[9px] text-muted-foreground ${
                  hour % 3 === 0 ? "" : "opacity-0"
                }`}
                key={hour}
              >
                {HOUR_TICKS[hour / 3]}
              </span>
            ))}
          </div>

          {/* Grid rows */}
          <div className="mt-1 flex flex-col gap-[3px]">
            {DAY_LABELS.map((dayLabel, day) => (
              <div
                className="grid gap-[3px]"
                key={dayLabel}
                style={{ gridTemplateColumns: "34px repeat(24, 1fr)" }}
              >
                <span className="font-mono text-[10px] leading-5 text-muted-foreground">
                  {dayLabel}
                </span>
                {cells!.slice(day * 24, day * 24 + 24).map((cell) => {
                  const intensity = cell.plays / maxPlays;
                  const isHovered =
                    hovered?.day === cell.day && hovered?.hour === cell.hour;
                  return (
                    <button
                      aria-label={`${dayLabel} ${formatHour(cell.hour)} — ${cell.plays} ${
                        cell.plays === 1 ? "play" : "plays"
                      }`}
                      className="h-5 rounded-[3px] outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring"
                      key={cell.hour}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() =>
                        setHovered((current) => (current === cell ? null : current))
                      }
                      style={{
                        backgroundColor:
                          cell.plays === 0
                            ? "rgba(255,255,255,0.04)"
                            : `rgba(30, 215, 96, ${0.15 + intensity * 0.75})`,
                        transform: isHovered ? "scale(1.18)" : undefined,
                      }}
                      type="button"
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Tooltip + legend row */}
          <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-white/70" role="status">
              {hovered
                ? `${DAY_LABELS[hovered.day]} · ${formatHour(hovered.hour)} — ${hovered.plays} ${
                    hovered.plays === 1 ? "play" : "plays"
                  }`
                : ""}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              Less
              {[0.06, 0.25, 0.45, 0.65, 0.9].map((alpha) => (
                <span
                  className="size-2.5 rounded-[2px]"
                  key={alpha}
                  style={{ backgroundColor: `rgba(30, 215, 96, ${alpha})` }}
                />
              ))}
              More
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── Daily Top ────────────────────────────────────────────────────────────────

const dailyTopConfig = {
  artistCount: { color: GREEN, label: "Top artist" },
  trackCount: { color: BRIGHT_GREEN, label: "Top track" },
} satisfies ChartConfig;

interface DayRow {
  label: string;
  artistName: string;
  trackName: string;
  artistCount: number;
  trackCount: number;
}

export function DailyTop({ items }: ClockRoutineProps) {
  const empty = items !== null && items.length === 0;
  let data: DayRow[] = [];

  if (items && items.length > 0) {
    interface DayBucket {
      dateObj: Date;
      artists: Record<string, { name: string; count: number }>;
      tracks: Record<string, { name: string; count: number }>;
    }
    const dayMap: Record<string, DayBucket> = {};

    items.forEach((entry) => {
      const track = entry.track;
      const playedAt = new Date(entry.played_at);
      const dayKey = `${playedAt.getFullYear()}-${String(playedAt.getMonth() + 1).padStart(2, "0")}-${String(
        playedAt.getDate()
      ).padStart(2, "0")}`;

      if (!dayMap[dayKey]) {
        dayMap[dayKey] = {
          dateObj: new Date(playedAt.getFullYear(), playedAt.getMonth(), playedAt.getDate()),
          artists: {},
          tracks: {},
        };
      }

      const day = dayMap[dayKey];
      const primaryArtist = track.artists[0];

      if (primaryArtist) {
        if (!day.artists[primaryArtist.id]) {
          day.artists[primaryArtist.id] = { name: primaryArtist.name, count: 0 };
        }
        day.artists[primaryArtist.id].count += 1;
      }

      if (!day.tracks[track.id]) {
        day.tracks[track.id] = { name: track.name, count: 0 };
      }
      day.tracks[track.id].count += 1;
    });

    // Chronological order reads more naturally as a chart.
    data = Object.keys(dayMap)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => {
        const day = dayMap[key];
        const topArtist = Object.values(day.artists).sort((a, b) => b.count - a.count)[0];
        const topTrack = Object.values(day.tracks).sort((a, b) => b.count - a.count)[0];
        return {
          label: formatDayLabel(day.dateObj),
          artistName: topArtist?.name ?? "",
          trackName: topTrack?.name ?? "",
          artistCount: topArtist?.count ?? 0,
          trackCount: topTrack?.count ?? 0,
        };
      })
      .filter((d) => d.artistName && d.trackName);
  }

  return (
    <Panel
     
      note="Most-played artist & track each day, from your last ~50 plays — hover a bar for details"
      title="Daily Top"
    >
      {items === null ? (
        <div className="h-72 pt-6">
          <SkeletonLines rows={6} />
        </div>
      ) : empty || data.length === 0 ? (
        <ChartEmpty icon={Clock}>Not enough recent plays yet to build a daily breakdown.</ChartEmpty>
      ) : (
        <ChartContainer className="aspect-auto h-72 w-full" config={dailyTopConfig}>
          <BarChart data={data} margin={{ left: -20, right: 12 }}>
            <CartesianGrid stroke={GRID_LINE} vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tick={{ fill: DIM }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} axisLine={false} tick={{ fill: DIM }} tickLine={false} />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (!(active && payload?.length)) return null;
                const row = payload[0].payload as DayRow;
                return (
                  <div className="max-w-56 rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-xl">
                    <div className="mb-1.5 font-semibold">{label}</div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: GREEN }} />
                      <span className="truncate">
                        <span className="text-muted-foreground">Artist:</span> {row.artistName}
                      </span>
                      <span className="ml-auto font-medium">{row.artistCount}×</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: BRIGHT_GREEN }}
                      />
                      <span className="truncate">
                        <span className="text-muted-foreground">Track:</span> {row.trackName}
                      </span>
                      <span className="ml-auto font-medium">{row.trackCount}×</span>
                    </div>
                  </div>
                );
              }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar barSize={12} dataKey="artistCount" fill="var(--color-artistCount)" radius={4} />
            <Bar barSize={12} dataKey="trackCount" fill="var(--color-trackCount)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  );
}

// ─── Your Sound (top genres) ──────────────────────────────────────────────────
// Genre frequency across your top artists in the selected range — pure
// Spotify genre tags, no audio-features inference. Counts are per artist
// appearance, not per play.

const yourSoundConfig = {
  count: { color: GREEN, label: "Artists" },
} satisfies ChartConfig;

interface GenreRow {
  genre: string;
  count: number;
}

function buildGenreCounts(artists: Artist[]): GenreRow[] {
  const counts = new Map<string, { label: string; count: number }>();
  artists.forEach((a) => {
    (a.genres ?? []).forEach((raw) => {
      const key = raw.toLowerCase().trim();
      if (!key) return;
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label: raw.trim(), count: 1 });
    });
  });
  return [...counts.values()]
    .map(({ label, count }) => ({ genre: label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function YourSound({ artists }: { artists: Artist[] | null }) {
  const data = artists ? buildGenreCounts(artists) : null;

  return (
    <Panel
      note="Most common genres across your top artists in this range — switch the range tabs above to compare"
      title="Your Sound"
    >
      {data === null ? (
        <div className="h-72 pt-6">
          <SkeletonLines rows={6} />
        </div>
      ) : data.length === 0 ? (
        <ChartEmpty icon={Disc3}>
          Not enough genre data yet — Spotify doesn't tag every artist with a genre.
        </ChartEmpty>
      ) : (
        <ChartContainer className="aspect-auto h-72 w-full" config={yourSoundConfig}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
            <CartesianGrid stroke={GRID_LINE} horizontal={false} />
            <XAxis allowDecimals={false} tick={{ fill: DIM }} tickLine={false} type="number" />
            <YAxis
              axisLine={false}
              dataKey="genre"
              tick={{ fill: DIM }}
              tickLine={false}
              type="category"
              width={110}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!(active && payload?.length)) return null;
                const row = payload[0].payload as GenreRow;
                return (
                  <div className="max-w-56 rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-xl">
                    <div className="mb-1 font-semibold">{row.genre}</div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: GREEN }} />
                      <span className="text-muted-foreground">Artists</span>
                      <span className="ml-auto font-medium">{row.count}×</span>
                    </div>
                  </div>
                );
              }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar barSize={14} dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  );
}

// ─── Obscurity Score ──────────────────────────────────────────────────────────
// Average Spotify 0–100 popularity across your top artists + tracks,
// inverted so higher = more niche. Histogram shows where your taste
// clusters; extremes call out your deepest cut and biggest crowd-pleaser.

const obscurityConfig = {
  artists: { color: GREEN, label: "Artists" },
  tracks: { color: BRIGHT_GREEN, label: "Tracks" },
} satisfies ChartConfig;

const OBSCURITY_BUCKETS = ["0–20", "21–40", "41–60", "61–80", "81–100"];

interface ObscurityBucket {
  bucket: string;
  artists: number;
  tracks: number;
}

function obscurityLabel(score: number): string {
  if (score >= 81) return "Deep-Cut Diver";
  if (score >= 61) return "Explorer";
  if (score >= 41) return "Balanced";
  if (score >= 21) return "Crowd Pleaser";
  return "Mainstream";
}

export function ObscurityPanel({
  artists,
  tracks,
}: {
  artists: Artist[] | null;
  tracks: Track[] | null;
}) {
  const loading = artists === null || tracks === null;

  let score: number | null = null;
  let buckets: ObscurityBucket[] | null = null;
  let mostObscure: string | null = null;
  let mostMainstream: string | null = null;

  if (!loading) {
    const artistPops = (artists ?? []).filter(
      (a): a is Artist & { popularity: number } => typeof a.popularity === "number"
    );
    const trackPops = (tracks ?? []).filter(
      (t): t is Track & { popularity: number } => typeof t.popularity === "number"
    );
    const all = [...artistPops.map((a) => a.popularity), ...trackPops.map((t) => t.popularity)];

    if (all.length > 0) {
      const avg = all.reduce((sum, p) => sum + p, 0) / all.length;
      score = Math.round(100 - avg);

      const bucketCounts = (pops: number[]): number[] => {
        const counts = [0, 0, 0, 0, 0];
        pops.forEach((p) => {
          const idx = p <= 20 ? 0 : p <= 40 ? 1 : p <= 60 ? 2 : p <= 80 ? 3 : 4;
          counts[idx] += 1;
        });
        return counts;
      };
      const artistBuckets = bucketCounts(artistPops.map((a) => a.popularity));
      const trackBuckets = bucketCounts(trackPops.map((t) => t.popularity));
      buckets = OBSCURITY_BUCKETS.map((bucket, i) => ({
        bucket,
        artists: artistBuckets[i],
        tracks: trackBuckets[i],
      }));

      const named = [
        ...artistPops.map((a) => ({ name: a.name, pop: a.popularity })),
        ...trackPops.map((t) => ({ name: t.name, pop: t.popularity })),
      ].sort((a, b) => a.pop - b.pop);
      mostObscure = named[0] ? `${named[0].name} (${named[0].pop})` : null;
      const top = named[named.length - 1];
      mostMainstream = top ? `${top.name} (${top.pop})` : null;
    }
  }

  return (
    <Panel
      note="From Spotify's 0–100 popularity scores across your top artists & tracks in this range — higher means more niche"
      title="Obscurity Score"
    >
      {loading ? (
        <div className="h-72 pt-6">
          <SkeletonLines rows={6} />
        </div>
      ) : score === null || !buckets ? (
        <ChartEmpty icon={Disc3}>
          Not enough popularity data yet for this range.
        </ChartEmpty>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl font-extrabold text-white">{score}</span>
            <span className="text-sm font-medium text-primary">{obscurityLabel(score)}</span>
          </div>
          <ChartContainer className="aspect-auto h-60 w-full" config={obscurityConfig}>
            <BarChart data={buckets} margin={{ left: -20, right: 12 }}>
              <CartesianGrid stroke={GRID_LINE} vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="bucket"
                tick={{ fill: DIM }}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis allowDecimals={false} axisLine={false} tick={{ fill: DIM }} tickLine={false} />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!(active && payload?.length)) return null;
                  return (
                    <div className="max-w-56 rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-xl">
                      <div className="mb-1.5 font-semibold">Popularity {label}</div>
                      <div className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: GREEN }} />
                        <span className="text-muted-foreground">Artists</span>
                        <span className="ml-auto font-medium">
                          {(payload.find((p) => p.dataKey === "artists")?.value as number) ?? 0}×
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: BRIGHT_GREEN }}
                        />
                        <span className="text-muted-foreground">Tracks</span>
                        <span className="ml-auto font-medium">
                          {(payload.find((p) => p.dataKey === "tracks")?.value as number) ?? 0}×
                        </span>
                      </div>
                    </div>
                  );
                }}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Bar barSize={12} dataKey="artists" fill="var(--color-artists)" radius={4} />
              <Bar barSize={12} dataKey="tracks" fill="var(--color-tracks)" radius={4} />
            </BarChart>
          </ChartContainer>
          {mostObscure && mostMainstream && (
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
              Deepest cut: <span className="text-white/70">{mostObscure}</span>
              {" · "}Biggest crowd-pleaser: <span className="text-white/70">{mostMainstream}</span>
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatDayLabel(dateObj: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateObj.getTime() === today.getTime()) return "Today";
  if (dateObj.getTime() === yesterday.getTime()) return "Yesterday";
  return dateObj.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
