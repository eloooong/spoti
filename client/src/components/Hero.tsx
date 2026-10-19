import { useContext, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUpRight, AudioLines, Disc3, Pause } from "lucide-react";
import { api, formatDuration, type NowPlaying } from "@/lib/api";
import { DataUnavailableContext } from "@/lib/data-state";
import BeamsBackground from "@/components/kokonutui/beams-background";

export function Hero() {
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(() => ({ progress: 0, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  const unavailable = useContext(DataUnavailableContext);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await api.nowPlaying();
      if (!cancelled) {
        setData(next);
        setSnapshot({ progress: next?.progress_ms ?? 0, at: Date.now() });
        setNow(Date.now());
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (!data?.is_playing) return;
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [data?.is_playing]);

  const track = data?.item;
  const cover = track?.album?.images?.[0]?.url;
  const duration = track?.duration_ms ?? 0;
  const progress = Math.min(duration, snapshot.progress + (data?.is_playing ? now - snapshot.at : 0));
  const spotifyUrl = track?.id ? `https://open.spotify.com/track/${encodeURIComponent(track.id)}` : "https://open.spotify.com/";
  return (
    <section className="playback-panel relative isolate overflow-hidden rounded-2xl p-5 sm:p-6" aria-label="Current playback">
      {!reducedMotion && <BeamsBackground intensity="subtle" />}
      <div className="relative z-10 flex items-center gap-5 sm:gap-6">
        <div className="playback-cover relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:size-28">
          {cover ? <img alt={`${track?.album?.name || "Album"} cover`} className="size-full object-cover" src={cover} /> : <Disc3 className="size-11 text-primary/70 sm:size-14" strokeWidth={1} aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            {data?.is_playing ? <AudioLines className="size-3.5 text-primary" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
            {loading ? "Checking playback" : unavailable ? "Playback unavailable" : data?.is_playing ? "Now playing" : track ? "Paused" : "Not playing"}
            {data?.device?.name && <span className="hidden border-l border-white/15 pl-2 sm:inline">{data.device.name}</span>}
          </div>
          {loading ? <div className="skeleton h-7 w-3/4 max-w-64 rounded bg-white/10" /> : <h2 className="line-clamp-2 font-display text-lg font-semibold tracking-[-0.025em] sm:line-clamp-1 sm:text-2xl">{track?.name || (unavailable ? "A quiet moment for your dashboard." : "Nothing’s spinning. Yet.")}</h2>}
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{track ? track.artists.map((a) => a.name).join(", ") : unavailable ? "Your current track will appear when Spotify access is available." : "Put something on Spotify. We’ll take it from here."}</p>
          {!!duration && <div className="mt-4 flex max-w-lg items-center gap-3"><span className="font-mono text-[11px] text-muted-foreground">{formatDuration(progress)}</span><div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Track progress" aria-valuenow={Math.round(progress / 1000)} aria-valuemin={0} aria-valuemax={Math.round(duration / 1000)}><div className="h-full rounded-full bg-primary" style={{ width: `${progress / duration * 100}%` }} /></div><span className="font-mono text-[11px] text-muted-foreground">{formatDuration(duration)}</span></div>}
        </div>
        <a className="secondary-button hidden shrink-0 sm:flex" href={spotifyUrl} rel="noreferrer" target="_blank">Open Spotify <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
      </div>
      <a className="relative z-10 mt-5 flex min-h-11 items-center justify-center gap-2 border-t border-white/10 pt-4 text-sm text-primary sm:hidden" href={spotifyUrl} rel="noreferrer" target="_blank">Open Spotify <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
    </section>
  );
}
