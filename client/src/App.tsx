import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { Hero } from "@/components/Hero";
import { RangeTabs, TopArtistsPanel, TopTracksPanel } from "@/components/TopLists";
import { LibrarySnapshotPanel, MostPlayedPlaylistsPanel, YourPlaylistsPanel } from "@/components/LibraryAndPlaylists";
import { AiChatPanel, AiProfilePanel, AiRecapPanel, useAiVisibility } from "@/components/AiSections";
import AttractButton from "@/components/kokonutui/attract-button";
import BackgroundPaths from "@/components/kokonutui/background-paths";
import MouseGridBackground from "@/components/kokonutui/mouse-grid-background";
import { ChartPanelSkeleton } from "@/components/Panel";
import type { Artist, RecentlyPlayedEntry, TimeRange, Track } from "@/lib/api";

// Charts pull in Recharts (the bulk of the bundle), so they live in their
// own chunk fetched after first paint.
const ListeningHeatmap = lazy(() =>
  import("./components/Charts").then((m) => ({ default: m.ListeningHeatmap }))
);
const DailyTop = lazy(() =>
  import("./components/Charts").then((m) => ({ default: m.DailyTop }))
);

function LoginView() {
  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden p-6">
      {/* Kokonut UI animated paths, tinted Spotify green */}
      <BackgroundPaths className="opacity-70" />

      <div className="relative z-10 max-w-2xl px-4 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-10 items-end gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span className="eq-bar eq-bar-tall" key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>
        <h1
          className="font-display font-extrabold leading-[1.02] tracking-[-0.025em] text-white"
          style={{ fontSize: "clamp(2.75rem, 7vw, 4.5rem)" }}
        >
          Your listening,
          <br />
          laid out.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/60 md:text-lg">
          Connect your Spotify account to see your top tracks, top artists, and recent plays.
        </p>
        <div className="mt-8 flex justify-center">
          <AttractButton
            className="rounded-full px-8 py-3.5 text-base font-semibold"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Connect Spotify
          </AttractButton>
        </div>
      </div>
    </section>
  );
}

function Dashboard() {
  const [range, setRange] = useState<TimeRange>("short_term");
  const [artists, setArtists] = useState<Artist[] | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [recent, setRecent] = useState<RecentlyPlayedEntry[] | null>(null);
  const aiVisible = useAiVisibility();

  useEffect(() => {
    let cancelled = false;
    setArtists(null);
    setTracks(null);
    Promise.all([api.topArtists(range), api.topTracks(range)]).then(([a, t]) => {
      if (cancelled) return;
      setArtists(a?.items ?? []);
      setTracks(t?.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    api.recent().then((res) => {
      if (!cancelled) setRecent(res?.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.main
      className="relative mx-auto flex max-w-6xl flex-col gap-6 px-5 pb-16 md:px-10"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.055 } } }}
    >
      {/* Dot grid that repels from the cursor (Kokonut physics, canvas port) */}
      <MouseGridBackground />

      <div className="relative z-10 flex flex-col gap-6">
      <Hero />

      <RangeTabs onChange={setRange} range={range} />

      <section className="grid gap-6 md:grid-cols-2">
        <TopArtistsPanel artists={artists} />
        <TopTracksPanel tracks={tracks} />
      </section>

      {aiVisible && (
        <section className="grid gap-6 md:grid-cols-2">
          <AiProfilePanel visible={aiVisible} />
          <AiRecapPanel visible={aiVisible} />
        </section>
      )}

      <Suspense fallback={<ChartPanelSkeleton title="When You Listen" />}>
        <ListeningHeatmap items={recent} />
      </Suspense>

      <section className="grid gap-6 md:grid-cols-2">
        <LibrarySnapshotPanel />
        <Suspense fallback={<ChartPanelSkeleton title="Daily Top" />}>
          <DailyTop items={recent} />
        </Suspense>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <MostPlayedPlaylistsPanel recent={recent} />
        <YourPlaylistsPanel />
      </section>

      {aiVisible && <AiChatPanel visible={aiVisible} />}
      </div>
    </motion.main>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.status().then((status) => setLoggedIn(!!status?.logged_in));
  }, []);

  // rAF-throttled scroll watch for the sticky mini-topbar.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 120);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="grain" aria-hidden="true" />

      {/* Slim fixed bar that slides in once the page header scrolls away. */}
      <div
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-md transition-all duration-300 ${
          scrolled ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5 md:px-10">
          <div className="font-display flex items-center gap-2 text-sm font-medium tracking-tight">
            <span className="text-primary">◐</span>
            <span>SpotiStats</span>
          </div>
          {loggedIn === true && (
            <a
              className="font-mono text-xs text-white/40 transition-colors hover:text-white/80"
              href="/logout"
            >
              Log out
            </a>
          )}
        </div>
      </div>

      <header className="flex items-center justify-between px-5 pt-7 pb-2 md:px-10">
        <div className="font-display flex items-center gap-2.5 text-lg font-medium tracking-tight">
          <span className="text-xl text-primary">◐</span>
          <span>SpotiStats</span>
        </div>
        <div className="font-mono text-xs text-white/40">
          {loggedIn === true && (
            <a className="transition-colors hover:text-white/80" href="/logout">
              Log out
            </a>
          )}
        </div>
      </header>

      {loggedIn === null ? null : loggedIn ? <Dashboard /> : <LoginView />}
    </>
  );
}
