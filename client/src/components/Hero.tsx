import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api, formatDuration, type NowPlaying as NowPlayingData } from "@/lib/api";
import { panelVariants } from "@/components/Panel";
import BeamsBackground from "@/components/kokonutui/beams-background";

// Animated equalizer bars — heights jitter via CSS animation when playing.
function EqualizerBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          className={active ? "eq-bar" : "eq-bar eq-bar-idle"}
          key={i}
          style={active ? { animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
    </div>
  );
}

export function Hero() {
  const [data, setData] = useState<NowPlayingData | null>(null);
  // Progress snapshot from the last poll; advanced client-side every second
  // so the bar sweeps smoothly instead of jumping every 15 seconds.
  const [progressBase, setProgressBase] = useState<{ ms: number; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await api.nowPlaying();
      if (!cancelled) {
        setData(next);
        setProgressBase(
          typeof next?.progress_ms === "number"
            ? { ms: next.progress_ms, at: Date.now() }
            : null
        );
        setNow(Date.now());
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Advance the interpolated progress once a second while playing. Paused
  // tracks stay frozen at their polled position.
  useEffect(() => {
    if (!data?.is_playing) return;
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [data?.is_playing]);

  const track = data?.item ?? null;
  const coverUrl = track?.album?.images?.[0]?.url;
  const isPlaying = !!data?.is_playing;

  const durationMs = typeof track?.duration_ms === "number" ? track.duration_ms : null;
  let liveProgress: number | null = null;
  if (progressBase && durationMs) {
    liveProgress = isPlaying
      ? Math.min(durationMs, progressBase.ms + (now - progressBase.at))
      : Math.min(progressBase.ms, durationMs);
  }
  const pct = liveProgress !== null ? (liveProgress / durationMs!) * 100 : 0;

  const badges: string[] = [];
  if (data?.device?.name) badges.push(data.device.name);
  if (data?.shuffle_state) badges.push("Shuffle on");
  if (data?.repeat_state && data.repeat_state !== "off")
    badges.push(`Repeat ${data.repeat_state === "track" ? "one" : "all"}`);
  if (typeof data?.device?.volume_percent === "number")
    badges.push(`Vol ${data.device.volume_percent}%`);

  return (
    <motion.section
      className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card p-8 md:p-12"
      variants={panelVariants}
    >
      {/* Kokonut UI animated beams backdrop */}
      <BeamsBackground intensity="subtle" />

      {/* First-load skeleton: mirrors the hero layout while /api/now-playing
          resolves, so the panel never shows an empty "nothing" state only to
          replace it with content moments later. */}
      {!data ? (
        <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row">
          <div className="skeleton h-48 w-48 shrink-0 rounded-2xl bg-white/[0.06] md:h-56 md:w-56" />
          <div className="min-w-0 flex-1">
            <div className="skeleton h-2.5 w-20 rounded-full bg-white/10" />
            <div className="skeleton mt-4 h-8 w-3/5 rounded-lg bg-white/10" />
            <div className="skeleton mt-3 h-4 w-2/5 rounded-full bg-white/10" />
            <div className="skeleton mt-6 h-1.5 w-full max-w-md rounded-full bg-white/10" />
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-8 md:flex-row">
        <div className="relative shrink-0">
          {coverUrl ? (
            <img
              alt={`${track?.album?.name || "Album"} cover art`}
              className="h-48 w-48 rounded-2xl object-cover shadow-2xl md:h-56 md:w-56"
              src={coverUrl}
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-6xl opacity-60 md:h-56 md:w-56">
              ◐
            </div>
          )}
          <div className="absolute -bottom-3 -right-3 rounded-xl bg-black/80 px-3 py-2 backdrop-blur">
            <EqualizerBars active={isPlaying} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">
            {!track ? "Right now" : isPlaying ? "Now playing" : "Paused"}
          </p>
          <h1
            className="font-display mt-2 truncate font-extrabold tracking-[-0.02em] text-white"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", lineHeight: 1.15 }}
          >
            {track ? (
              track.name
            ) : (
              <span className="text-muted-foreground">Nothing's spinning</span>
            )}
          </h1>
          <p className="mt-2 truncate text-lg text-white/70">
            {track ? track.artists.map((a) => a.name).join(", ") : "Press play on Spotify to see it here."}
          </p>

          {liveProgress !== null && (
            <div className="mt-5 max-w-md">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-xs text-white/50">
                <span>{formatDuration(liveProgress)}</span>
                <span>{formatDuration(durationMs!)}</span>
              </div>
            </div>
          )}

          {badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-xs text-white/70"
                  key={badge}
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {/* Ambient glow tinted by the artwork */}
      {coverUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-25 blur-3xl"
          style={{ backgroundImage: `url("${coverUrl}")`, backgroundSize: "cover" }}
        />
      )}
    </motion.section>
  );
}
