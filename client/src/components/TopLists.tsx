import { Music2, UserRound } from "lucide-react";
import { motion } from "motion/react";
import type { Artist, TimeRange, Track } from "@/lib/api";
import { ChartEmpty, Panel, SkeletonLines } from "@/components/Panel";


const RANGES: { value: TimeRange; label: string }[] = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

// Native buttons keep every range reachable by keyboard and touch.
export function RangeTabs({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  return (
    <div
      aria-label="Time range"
      className="grid w-full grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1 sm:w-auto"
      role="group"
    >
        {RANGES.map(({ value, label }) => {
          const isSelected = range === value;
          return (
            <button
              aria-pressed={isSelected}
              className={`relative flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:px-4 ${
                isSelected
                  ? "text-black"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              }`}
              key={value}
              onClick={() => onChange(value)}
              type="button"
            >
              {isSelected && <motion.span aria-hidden="true" layoutId="time-range-indicator" className="absolute inset-0 rounded-lg bg-primary shadow-[0_4px_16px_rgba(29,185,84,0.25)]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative z-10 truncate">{label}</span>
            </button>
          );
        })}
    </div>
  );
}

function RankedList({
  items,
}: {
  items: { rank: number; image?: string; name: string; sub: string; popularity?: number }[];
}) {
  if (items.length === 0) {
    return <ChartEmpty icon={Music2}>Not enough listening history yet for this range.</ChartEmpty>;
  }

  return (
    <ol>
      {items.map((item) => (
        <li
          className="group flex items-center gap-4 rounded-xl p-2 transition-colors duration-200 hover:bg-white/[0.05]"
          key={`${item.rank}-${item.name}`}
        >
          <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground group-hover:text-primary">
            {String(item.rank).padStart(2, "0")}
          </span>
          {item.image ? <img
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg bg-white/[0.06] object-cover"
            loading="lazy"
            src={item.image}
          /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5"><UserRound className="size-4 text-muted-foreground" aria-hidden="true" /></span>}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white" title={item.name}>{item.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>
            {typeof item.popularity === "number" && (
              <span
                aria-label={`Popularity ${item.popularity} out of 100`}
                className="mt-1.5 block h-[3px] max-w-28 overflow-hidden rounded-full bg-white/10"
              >
                <span
                  className="block h-full rounded-full bg-linear-to-r from-primary/60 to-accent transition-[width] duration-700 ease-out"
                  style={{ width: `${item.popularity}%` }}
                />
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Data is fetched once in Dashboard (shared with the charts) and passed
// down — these panels no longer fetch independently.
export function TopArtistsPanel({ artists }: { artists: Artist[] | null }) {
  const items = (artists ?? []).map((a, i) => ({
    rank: i + 1,
    image: a.images?.[2]?.url || a.images?.[0]?.url,
    name: a.name,
    sub: a.genres?.slice(0, 2).join(", ") || "Artist",
    popularity: a.popularity,
  }));

  return (
    <Panel title="Top Artists">
      {artists === null ? <SkeletonLines rows={6} /> : <RankedList items={items} />}
    </Panel>
  );
}

export function TopTracksPanel({ tracks }: { tracks: Track[] | null }) {
  const items = (tracks ?? []).map((t, i) => ({
    rank: i + 1,
    image: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url,
    name: t.name,
    sub: t.artists.map((a) => a.name).join(", "),
    popularity: t.popularity,
  }));

  return (
    <Panel title="Top Tracks">
      {tracks === null ? <SkeletonLines rows={6} /> : <RankedList items={items} />}
    </Panel>
  );
}
