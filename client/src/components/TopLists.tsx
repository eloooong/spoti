import { motion } from "motion/react";
import { Music2 } from "lucide-react";
import type { Artist, TimeRange, Track } from "@/lib/api";
import { ChartEmpty, Panel, SkeletonLines } from "@/components/Panel";

import { useLayoutEffect, useRef, useState } from "react";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "short_term", label: "Last 4 weeks" },
  { value: "medium_term", label: "Last 6 months" },
  { value: "long_term", label: "All time" },
];

// Sliding-indicator tab strip, adapted from Kokonut UI's SmoothTab
// mechanics: the active pill is measured from the selected button's rect
// and springs between tabs. Controlled — range state lives in Dashboard.
export function RangeTabs({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
}) {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, left: 0 });

  useLayoutEffect(() => {
    const updateDimensions = () => {
      const selectedButton = buttonRefs.current.get(range);
      const container = containerRef.current;

      if (selectedButton && container) {
        const rect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setDimensions({
          width: rect.width,
          left: rect.left - containerRect.left,
        });
      }
    };

    // Initial measure after first paint.
    const raf = requestAnimationFrame(updateDimensions);
    window.addEventListener("resize", updateDimensions);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [range]);

  return (
    <div
      aria-label="Time range"
      className="relative mx-auto flex w-full max-w-md items-center rounded-xl border border-white/10 bg-white/[0.03] py-1 backdrop-blur-sm"
      ref={containerRef}
      role="tablist"
    >
      {/* Sliding active pill */}
      <motion.div
        animate={{
          width: dimensions.width - 8,
          x: dimensions.left + 4,
          opacity: 1,
        }}
        className="absolute z-[1] rounded-lg bg-primary shadow-[0_4px_16px_rgba(29,185,84,0.35)]"
        initial={false}
        style={{ height: "calc(100% - 8px)", top: "4px" }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      />

      <div className="relative z-[2] grid w-full grid-cols-3 gap-1">
        {RANGES.map(({ value, label }) => {
          const isSelected = range === value;
          return (
            <button
              aria-selected={isSelected}
              className={`flex items-center justify-center rounded-lg px-2 py-2 text-sm font-medium truncate transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "text-black"
                  : "text-white/60 hover:text-white focus-visible:text-white"
              }`}
              key={value}
              onClick={() => onChange(value)}
              ref={(el) => {
                if (el) buttonRefs.current.set(value, el);
                else buttonRefs.current.delete(value);
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
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
          <span className="w-6 shrink-0 font-mono text-xs text-white/40 group-hover:text-primary">
            {String(item.rank).padStart(2, "0")}
          </span>
          <img
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg bg-white/[0.06] object-cover"
            loading="lazy"
            src={item.image}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{item.name}</span>
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
