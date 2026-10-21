import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import { ArrowUpRight, CircleAlert, LogOut, RefreshCw } from "lucide-react";
import { api, onApiError, type ApiFailure, type Artist, type RecentlyPlayedEntry, type TimeRange, type Track } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { RangeTabs, TopArtistsPanel, TopTracksPanel } from "@/components/TopLists";
import { LibrarySnapshotPanel, MostPlayedPlaylistsPanel, YourPlaylistsPanel } from "@/components/LibraryAndPlaylists";
import { AiChatPanel, AiProfilePanel, AiRecapPanel, useAiVisibility } from "@/components/AiSections";
import MouseGridBackground from "@/components/kokonutui/mouse-grid-background";
import { LoginView } from "@/components/LoginView";
import { ChartPanelSkeleton } from "@/components/Panel";
import { DataUnavailableContext } from "@/lib/data-state";

const ListeningHeatmap = lazy(() => import("./components/Charts").then((m) => ({ default: m.ListeningHeatmap })));
const DailyTop = lazy(() => import("./components/Charts").then((m) => ({ default: m.DailyTop })));
const YourSound = lazy(() => import("./components/Charts").then((m) => ({ default: m.YourSound })));
const ObscurityPanel = lazy(() => import("./components/Charts").then((m) => ({ default: m.ObscurityPanel })));

function Dashboard() {
  const reducedMotion = useReducedMotion();
  const [range, setRange] = useState<TimeRange>("short_term");
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [recent, setRecent] = useState<RecentlyPlayedEntry[] | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const aiVisible = useAiVisibility();

  useEffect(() => onApiError((next) => setFailure((current) => current === "premium_required" ? current : next)), []);
  useEffect(() => {
    let cancelled = false;
    setArtists(null);
    setTracks(null);
    Promise.all([api.topArtists(range), api.topTracks(range)]).then(([a, t]) => {
      if (!cancelled) { setArtists(a?.items ?? []); setTracks(t?.items ?? []); }
    });
    return () => { cancelled = true; };
  }, [range]);
  useEffect(() => {
    let cancelled = false;
    api.recent().then((res) => { if (!cancelled) setRecent(res?.items ?? []); });
    return () => { cancelled = true; };
  }, []);

  return (
    <DataUnavailableContext value={failure !== null}>
      {!reducedMotion && <MouseGridBackground />}
      <main id="main-content" className="relative z-10 mx-auto max-w-6xl px-5 pt-10 pb-16 sm:px-8 lg:pt-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-[clamp(1.9rem,4vw,2.75rem)] font-semibold leading-tight tracking-[-0.035em]">Your listening, in focus.</h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">The songs, artists, and habits that make your sound.</p>
          </div>
          <button className="secondary-button" onClick={() => window.location.reload()} type="button"><RefreshCw className="size-3.5" aria-hidden="true" />Refresh stats</button>
        </div>

        {failure && <div className="access-notice mb-6 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center" role="alert">
          <CircleAlert className="size-5 shrink-0 text-[#edc587]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#f5d6a7]">{failure === "premium_required" ? "Connected to Spotify. Waiting for data access." : failure === "not_logged_in" ? "Reconnect to bring your stats back." : "We couldn’t load your Spotify data."}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#d2baa0]">{failure === "premium_required" ? "Spotify requires the developer app’s owner to have Premium. Once it’s active, refresh your stats." : failure === "not_logged_in" ? "Your Spotify session has expired. Connect again to continue." : "Spotify may be unavailable, or the local server may have stopped. Try refreshing in a moment."}</p>
          </div>
          {failure === "not_logged_in" ? <a className="notice-link" href="/login">Reconnect <ArrowUpRight className="size-3.5" aria-hidden="true" /></a> : failure === "premium_required" ? <a className="notice-link" href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes" rel="noreferrer" target="_blank">View requirements <ArrowUpRight className="size-3.5" aria-hidden="true" /></a> : <button className="notice-link" onClick={() => window.location.reload()} type="button">Try again <RefreshCw className="size-3.5" aria-hidden="true" /></button>}
        </div>}

        <Hero />

        <section id="favorites" className="dashboard-section scroll-mt-24" aria-labelledby="favorites-title">
          <div className="section-toolbar">
            <div><h2 id="favorites-title" className="section-title">On repeat</h2><p className="section-description">Your favorites, over time.</p></div>
            <RangeTabs onChange={setRange} range={range} />
          </div>
          <div className="grid gap-5 md:grid-cols-2"><TopArtistsPanel artists={artists} /><TopTracksPanel tracks={tracks} /></div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Suspense fallback={<ChartPanelSkeleton title="Your Sound" />}><YourSound artists={artists} tracks={tracks} /></Suspense>
            <Suspense fallback={<ChartPanelSkeleton title="Obscurity Score" />}><ObscurityPanel artists={artists} tracks={tracks} /></Suspense>
          </div>
        </section>

        <section id="listening" className="dashboard-section scroll-mt-24" aria-labelledby="listening-title">
          <div className="section-toolbar"><div><h2 id="listening-title" className="section-title">Your listening rhythm</h2><p className="section-description">A snapshot of your latest 50 plays.</p></div><span className="data-note">Recent activity</span></div>
          <Suspense fallback={<ChartPanelSkeleton title="When You Listen" />}><ListeningHeatmap items={recent} /></Suspense>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Suspense fallback={<ChartPanelSkeleton title="Daily Top" />}><DailyTop items={recent} /></Suspense>
            <MostPlayedPlaylistsPanel recent={recent} />
          </div>
        </section>

        <section id="library" className="dashboard-section scroll-mt-24" aria-labelledby="library-title">
          <div className="section-toolbar"><div><h2 id="library-title" className="section-title">Collected by you</h2><p className="section-description">The music you keep coming back to.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2"><LibrarySnapshotPanel /><YourPlaylistsPanel /></div>
        </section>

        {aiVisible && <section className="dashboard-section" aria-labelledby="insights-title">
          <div className="section-toolbar"><div><h2 id="insights-title" className="section-title">A different take on your taste</h2><p className="section-description">AI insights drawn from your listening data.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2"><AiProfilePanel visible={aiVisible} /><AiRecapPanel visible={aiVisible} /></div>
          <div className="mt-5"><AiChatPanel visible={aiVisible} /></div>
        </section>}
      </main>
    </DataUnavailableContext>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => { api.status().then((status) => setLoggedIn(!!status?.logged_in)); }, []);
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main-content">Skip to content</a>
      {loggedIn && <header className="site-header sticky top-0 z-50 border-b border-white/[0.08]">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
          <a className="flex shrink-0 items-center gap-2.5" href="/" aria-label="SpotiStats home"><img src="/brand/spotistats-logo.svg" alt="SpotiStats" width={907} height={256} className="h-11 w-auto" /><span className="ml-1 hidden border-l border-white/15 pl-4 text-xs text-muted-foreground xl:inline">Your music, closer.</span></a>
          {loggedIn && <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Dashboard sections"><a className="nav-link" href="#favorites">Favorites</a><a className="nav-link" href="#listening">Listening</a><a className="nav-link" href="#library">Library</a></nav>}
          {loggedIn && <div className="flex items-center gap-4"><span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" />Spotify connected</span><a className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-white" href="/logout"><LogOut className="size-3.5" aria-hidden="true" /><span>Log out</span></a></div>}
        </div>
      </header>}
      {loggedIn === null ? <main id="main-content" className="mx-auto max-w-6xl px-5 py-16" role="status"><div className="skeleton h-10 w-64 rounded bg-white/10" /><p className="mt-4 text-sm text-muted-foreground">Connecting to your dashboard…</p></main> : loggedIn ? <Dashboard /> : <LoginView />}
      <footer className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] px-5 py-7 text-xs text-muted-foreground sm:px-8"><span className="flex items-center gap-2"><img src="/brand/spotistats-symbol.svg" alt="" width={20} height={20} />Made for the way you listen.</span><span>Listening data from Spotify</span></footer>
    </MotionConfig>
  );
}
