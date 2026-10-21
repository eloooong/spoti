import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { Clock, Disc3 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Artist, RecentlyPlayedEntry, Track } from "@/lib/api";
import { ChartEmpty, Panel, SkeletonLines } from "@/components/Panel";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { buildSoundBreakdown } from "@/lib/your-sound";
import { buildMusicEras } from "@/lib/music-eras";
import { MusicErasDonut, SoundBubbles } from "@/components/TasteCharts";

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
  timestamp: number;
  label: string;
  artistName: string;
  trackName: string;
  artistCount: number;
  trackCount: number;
}

export function DailyTop({ items }: ClockRoutineProps) {
  const reducedMotion = useReducedMotion();
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
          timestamp: day.dateObj.getTime(),
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
     
      note="Daily counts for each day’s most-played artist and track, from your latest ~50 plays — select a point for details"
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
          <LineChart data={data} margin={{ left: -20, right: 12 }}>
            <Legend iconType="plainline" verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />
            <CartesianGrid stroke={GRID_LINE} vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={data.map(row => row.timestamp)}
              tickFormatter={(value) => formatDayLabel(new Date(value))}
              minTickGap={24}
              tick={{ fill: DIM }}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis allowDecimals={false} axisLine={false} tick={{ fill: DIM }} tickLine={false} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (!(active && payload?.length)) return null;
                const row = payload[0].payload as DayRow;
                return (
                  <div className="max-w-56 rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-xl">
                    <div className="mb-1.5 font-semibold">{row.label}</div>
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
              cursor={{ stroke: DIM, strokeDasharray: "3 3" }}
            />
            <Line type="linear" dataKey="artistCount" name="Top artist" stroke="var(--color-artistCount)" strokeWidth={2} dot={{ r: 4, fill: GREEN, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={!reducedMotion} animationDuration={450} />
            <Line type="linear" dataKey="trackCount" name="Top track" stroke="var(--color-trackCount)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={!reducedMotion} animationDuration={450} />
          </LineChart>
        </ChartContainer>
      )}
    </Panel>
  );
}

// ─── Your Sound (top genres) ──────────────────────────────────────────────────
// Prefer Spotify genre tags. When those fields are omitted, show the artist
// mix in the same range's top tracks, with the different measure labeled.
export function YourSound({ artists, tracks }: { artists: Artist[] | null; tracks: Track[] | null }) {
  const breakdown = buildSoundBreakdown(artists, tracks);
  const artistMix = breakdown?.source === "artists";

  return (
    <Panel
      note={artistMix ? "Artists represented in your top tracks for this range — collaborations count for each credited artist" : "Most common genres across your top artists in this range — switch the range tabs above to compare"}
      title="Your Sound"
    >
      {breakdown === null ? (
        <div className="h-72 pt-6">
          <SkeletonLines rows={6} />
        </div>
      ) : breakdown.rows.length === 0 ? (
        <ChartEmpty icon={Disc3}>
          {artists?.length ? "Spotify returned your artists without genre tags, and no top tracks were available for an artist mix. Try another time range." : "No top artists or tracks were returned for this time range. Try another range."}
        </ChartEmpty>
      ) : (
        <>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{artistMix ? "Genre tags weren’t returned by Spotify. Showing your artist mix instead." : `Genre tags available for ${breakdown.taggedArtists} of ${breakdown.totalArtists} top artists.`}</p>
        <SoundBubbles rows={breakdown.rows} unit={artistMix ? "top track" : "artist"} />
        </>
      )}
    </Panel>
  );
}

// ─── Your Music Eras ──────────────────────────────────────────────────────────
// Album release decades across the selected top tracks, not listening dates
// or a claim about the original recording year of a reissued track.
export function MusicErasPanel({ tracks }: { tracks: Track[] | null }) {
  const summary = buildMusicEras(tracks);

  return (
    <Panel
      note="Your top tracks grouped by album release decade — switch the time range above to compare"
      title="Your Music Eras"
    >
      {summary === null ? (
        <div className="h-72 pt-6">
          <SkeletonLines rows={6} />
        </div>
      ) : summary.eras.length === 0 ? (
        <ChartEmpty icon={Disc3}>
          {summary.totalTracks === 0 ? "No top tracks were returned for this time range. Try another range." : "Spotify didn’t return usable album release dates for these tracks. Try another time range."}
        </ChartEmpty>
      ) : (
        <>
          <p className="text-sm leading-relaxed"><span className="font-semibold text-primary">{summary.leadingDecades.join(" / ")}</span>{summary.leadingDecades.length === 1 ? " leads your mix." : " are tied for the most tracks."}</p>
          <MusicErasDonut eras={summary.eras} total={summary.datedTracks} />
          {summary.oldest && summary.newest && (
            <dl className="mt-4 grid grid-cols-2 gap-5 border-t border-white/10 pt-4">
              {[{ label: "Oldest release", item: summary.oldest }, { label: "Newest release", item: summary.newest }].map(({ label, item }) => (
                <div className="min-w-0" key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1">
                    <span className="font-display text-lg font-semibold tabular-nums">{item.year}</span>
                    <a className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground hover:text-white hover:underline" href={`https://open.spotify.com/track/${encodeURIComponent(item.track.id)}`} target="_blank" rel="noreferrer">{item.track.name}</a>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{summary.datedTracks} of {summary.totalTracks} top tracks have usable dates. Album release dates can reflect reissues.</p>
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
