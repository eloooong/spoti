import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { DataUnavailableContext } from "@/lib/data-state";
import { ListMusic } from "lucide-react";
import { api, type LibrarySnapshot as SnapshotData, type Playlist, type RecentlyPlayedEntry } from "@/lib/api";
import { ChartEmpty, Panel, SkeletonLines } from "@/components/Panel";

// Counts up to the target with an ease-out cubic, like the old dashboard.
function useCountUp(value: number | undefined) {
  const [display, setDisplay] = useState("—");

  useEffect(() => {
    if (typeof value !== "number") {
      setDisplay("—");
      return;
    }

    const duration = 700;
    const start = performance.now();
    let raf = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value! * eased).toLocaleString());
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return display;
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  const display = useCountUp(value);
  return (
    <div className="py-3">
      <div className="font-display text-3xl font-semibold text-white tabular-nums">{display}</div>
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function LibrarySnapshotPanel() {
  const unavailable = useContext(DataUnavailableContext);
  const [data, setData] = useState<SnapshotData | null>(null);

  useEffect(() => {
    api.librarySnapshot().then(setData);
  }, []);

  return (
    <Panel title="Library Snapshot">
      {unavailable && !data ? <ChartEmpty icon={ListMusic}>Your library is unavailable.</ChartEmpty> : <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        <StatCard label="Followed artists" value={data?.followedArtists} />
        <StatCard label="Liked songs" value={data?.savedTracks} />
        <StatCard label="Saved albums" value={data?.savedAlbums} />
        <StatCard label="Playlists" value={data?.playlists} />
      </div>}
    </Panel>
  );
}

// ─── Most Played Playlists ────────────────────────────────────────────────────
// Spotify doesn't expose "how often you played this playlist" anywhere. The
// closest real signal is the "context" field on recently-played entries —
// what a track was played FROM. We count playlist contexts within your last
// ~50 plays and rank them.

interface PlaylistPlay {
  name: string;
  image?: string;
  url?: string;
  count: number;
}

export function MostPlayedPlaylistsPanel({ recent }: { recent: RecentlyPlayedEntry[] | null }) {
  const [plays, setPlays] = useState<PlaylistPlay[] | null>(null);

  useEffect(() => {
    if (!recent) return;

    const counts: Record<string, number> = {};
    recent.forEach((entry) => {
      if (entry.context?.type === "playlist" && entry.context.uri) {
        const id = entry.context.uri.split(":").pop()!;
        counts[id] = (counts[id] || 0) + 1;
      }
    });

    const topIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topIds.length === 0) {
      setPlays([]);
      return;
    }

    Promise.all(
      topIds.map(async ([id, count]) => {
        const meta = await api.playlistMeta(id);
        return {
          name: meta?.name || "Unknown playlist",
          image: meta?.images?.[0]?.url,
          url: meta?.external_urls?.spotify,
          count,
        };
      })
    ).then(setPlays);
  }, [recent]);

  const maxCount = plays ? Math.max(1, ...plays.map((p) => p.count)) : 1;

  return (
    <Panel note="Which playlists your last ~50 plays actually came from" title="Most Played Playlists">
      {!recent || !plays ? (
        <SkeletonLines rows={5} />
      ) : plays.length === 0 ? (
        <ChartEmpty icon={ListMusic}>
          None of your last ~50 plays came from a playlist — try playing something from a
          playlist on Spotify.
        </ChartEmpty>
      ) : (
        <ol>
          {plays.map((play, i) => (
            <li className="flex items-center gap-4 rounded-xl p-2" key={`${play.name}-${i}`}>
              <span className="w-6 shrink-0 font-mono text-xs text-white/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              {play.image ? (
                <img
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                  src={play.image}
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-primary opacity-70">
                  <ListMusic className="size-4" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {play.url ? (
                    <a
                      className="transition-colors hover:text-primary"
                      href={play.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {play.name}
                    </a>
                  ) : (
                    play.name
                  )}
                </span>
                <span className="mt-1 block h-[3px] max-w-40 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-linear-to-r from-primary/60 to-accent transition-[width] duration-700 ease-out"
                    style={{ width: `${(play.count / maxCount) * 100}%` }}
                  />
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {play.count}× played
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

// ─── Your Playlists (carousel) ──────────────────────────────────────────────

// Compact horizontal card for the scrolling carousel strip — artwork on the
// left, name + track count on the right, fits ~150px-wide slots.
function PlaylistStripCard({
  name,
  image,
  url,
}: {
  name: string;
  image?: string;
  trackCount?: number;
  url?: string;
}) {
  const inner = image ? (
    <img
      alt=""
      className="h-28 w-28 shrink-0 rounded-xl bg-white/[0.06] object-cover"
      loading="lazy"
      src={image}
    />
  ) : (
    <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-4xl text-primary opacity-50">
      <ListMusic className="size-8" aria-hidden="true" />
    </span>
  );

  const classes =
    "block w-28 shrink-0 rounded-xl text-sm transition-colors duration-200 hover:text-primary";

  return url ? (
    <a className={classes} href={url} rel="noreferrer" target="_blank" title={name}>
      {inner}
      <span className="mt-2 block truncate text-xs">{name}</span>
    </a>
  ) : (
    <div className={classes}>{inner}<span className="mt-2 block truncate text-xs">{name}</span></div>
  );
}

// Continuously spinning horizontal carousel with drag-to-scroll and momentum.
// Items are rendered twice inside one flex row; when scrollLeft crosses the
// halfway point (one copy's width), it resets — identical content makes the
// jump invisible.
const CAROUSEL_SPEED = 40;
const FRICTION = 0.95;
const MIN_VELOCITY = 0.3;
const RESUME_DELAY = 1500;

function PlaylistCarousel({ playlists }: { playlists: Playlist[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const isDragging = useRef(false);
  const paused = useRef(false);
  const velocity = useRef(0);
  const lastMoveTime = useRef(0);
  const lastPointerX = useRef(0);
  const lastPointerY = useRef(0);
  const hasMoved = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const touchStartTime = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [halfWidth, setHalfWidth] = useState(0);

  // Capture halfWidth once playlists render.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || playlists.length === 0) return;
    requestAnimationFrame(() => setHalfWidth(track.scrollWidth / 2));
  }, [playlists]);

  const clamp = useCallback(
    (v: number) => {
      if (halfWidth <= 0) return 0;
      return ((v % halfWidth) + halfWidth) % halfWidth;
    },
    [halfWidth]
  );

  useEffect(() => {
    if (halfWidth <= 0 || playlists.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (!isDragging.current && !paused.current) {
        const dt = (now - lastTime) / 1000;
        if (Math.abs(velocity.current) > MIN_VELOCITY) {
          scrollPos.current = clamp(scrollPos.current + velocity.current * dt * 60);
          velocity.current *= FRICTION;
        } else {
          velocity.current = 0;
          scrollPos.current = clamp(scrollPos.current + CAROUSEL_SPEED * dt);
        }
        if (trackRef.current) trackRef.current.scrollLeft = scrollPos.current;
      }
      lastTime = now;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [halfWidth, clamp, playlists.length]);

  useEffect(() => {
    const clearResumeTimer = () => {
      if (resumeTimer.current) {
        clearTimeout(resumeTimer.current);
        resumeTimer.current = null;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!trackRef.current?.contains(e.target as Node)) return;
      if (e.button !== 0) return;
      clearResumeTimer();
      isDragging.current = true;
      hasMoved.current = false;
      lastPointerX.current = e.clientX;
      lastPointerY.current = e.clientY;
      lastMoveTime.current = e.timeStamp;
      velocity.current = 0;
      scrollPos.current = trackRef.current?.scrollLeft ?? 0;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPointerX.current;
      const dy = e.clientY - lastPointerY.current;
      const dt = e.timeStamp - lastMoveTime.current;

      if (!hasMoved.current) {
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return;
        hasMoved.current = true;
      }

      if (trackRef.current) {
        trackRef.current.scrollLeft -= dx;
        scrollPos.current = trackRef.current.scrollLeft;
      }

      if (dt > 0) velocity.current = -(dx / dt) * 16;
      lastPointerX.current = e.clientX;
      lastPointerY.current = e.clientY;
      lastMoveTime.current = e.timeStamp;
    };

    const onPointerUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      clearResumeTimer();
      resumeTimer.current = setTimeout(() => {
        velocity.current = 0;
      }, RESUME_DELAY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!trackRef.current?.contains(e.target as Node)) return;
      isHorizontal.current = null;
      touchStartTime.current = e.timeStamp;
      if (e.touches[0]) {
        lastPointerX.current = e.touches[0].clientX;
        lastPointerY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!trackRef.current?.contains(e.target as Node) || !e.touches[0]) return;

      const dx = e.touches[0].clientX - lastPointerX.current;
      const dy = e.touches[0].clientY - lastPointerY.current;

      if (isHorizontal.current === null) {
        if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }

      if (!isHorizontal.current) return;
      e.preventDefault();

      if (!isDragging.current) {
        isDragging.current = true;
        hasMoved.current = false;
        velocity.current = 0;
        scrollPos.current = trackRef.current?.scrollLeft ?? 0;
        clearResumeTimer();
      }

      const dt = e.timeStamp - lastMoveTime.current;
      if (trackRef.current) {
        trackRef.current.scrollLeft -= dx;
        scrollPos.current = trackRef.current.scrollLeft;
      }
      if (dt > 0) velocity.current = -(dx / dt) * 16;
      lastPointerX.current = e.touches[0].clientX;
      lastPointerY.current = e.touches[0].clientY;
      lastMoveTime.current = e.timeStamp;
    };

    const onTouchEnd = () => {
      if (isDragging.current) {
        isDragging.current = false;
        clearResumeTimer();
        resumeTimer.current = setTimeout(() => {
          velocity.current = 0;
        }, RESUME_DELAY);
      }
      isHorizontal.current = null;
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    const track = trackRef.current;
    track?.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      track?.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      clearResumeTimer();
    };
  }, [halfWidth, playlists.length]);

  // Render twice for the seamless-loop trick.
  const items = [...playlists, ...playlists];

  return (
    <div className="group/carousel -mx-2 overflow-hidden px-2" role="region" aria-label="Playlist carousel">
      <div
        ref={trackRef}
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = !!trackRef.current?.contains(document.activeElement); }}
        onFocusCapture={() => { paused.current = true; }}
        onBlurCapture={(event) => { paused.current = !!event.currentTarget.contains(event.relatedTarget as Node | null); }}
        className="playlist-track flex cursor-grab gap-4 overflow-x-auto pb-3 select-none active:cursor-grabbing"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((p, i) => (
          <PlaylistStripCard
            image={p.images?.[0]?.url}
            key={`${p.id}-${i}`}
            name={p.name}
            url={p.external_urls?.spotify}
          />
        ))}
      </div>
    </div>
  );
}

export function YourPlaylistsPanel() {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    api.playlists().then((res) => {
      setPlaylists(res?.items ?? []);
      setTotalCount(typeof res?.total === "number" ? res.total : null);
    });
  }, []);

  return (
    <Panel note="Your saved playlists on Spotify — drag or let it scroll" title="Your Playlists">
      <div className="-mx-6 mt-1 px-6">
        {!playlists ? (
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                className="skeleton h-[112px] w-[112px] shrink-0 rounded-xl bg-white/[0.05]"
                key={i}
              />
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <ChartEmpty icon={ListMusic}>No playlists found.</ChartEmpty>
        ) : (
          <>
            <PlaylistCarousel playlists={playlists} />
            {totalCount !== null && totalCount > playlists.length && (
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                Showing {playlists.length} of {totalCount.toLocaleString()} playlists — click any to
                open on Spotify
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
