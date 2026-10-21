import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import AttractButton from "@/components/kokonutui/attract-button";
import BackgroundPaths from "@/components/kokonutui/background-paths";
import { RangeTabs } from "@/components/TopLists";
import type { TimeRange } from "@/lib/api";

// Illustrative content only: the login page never fetches personal Spotify data.
const SAMPLE_TRACKS = [
  { title: "Night Drive", artist: "The Daydreams", color: "sage", duration: "3:42" },
  { title: "Blue Hour", artist: "Paper Satellites", color: "blue", duration: "4:08" },
  { title: "Stay a Little", artist: "Quiet Company", color: "clay", duration: "2:56" },
];
const SAMPLE_ORDER: Record<TimeRange, number[]> = {
  short_term: [0, 1, 2],
  medium_term: [1, 2, 0],
  long_term: [2, 0, 1],
};
const SAMPLE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SAMPLE_PEAK_HOURS = [19, 20, 19, 21, 22, 15, 17];

function SampleCover({ color }: { color: string }) {
  return (
    <svg className={`login-track-cover login-track-cover-${color}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" fill="currentColor" />
      {color === "sage" ? <g stroke="#d7e7bd"><circle cx="24" cy="24" r="15" /><circle cx="24" cy="24" r="9" /><path d="M7 41 41 7" /><circle cx="24" cy="24" r="3" fill="#d7e7bd" /></g>
        : color === "blue" ? <g stroke="#c4e3ed"><path d="M0 12h48M0 20h48M0 28h48M0 36h48" /><circle cx="24" cy="24" r="14" fill="#c4e3ed" /><circle cx="24" cy="24" r="7" fill="currentColor" /></g>
          : <g stroke="#f4d8c3"><path d="M7 41V7l34 34V7M15 41V15l18 18V7" /><circle cx="24" cy="24" r="18" /></g>}
    </svg>
  );
}

function ListeningPreview() {
  const [range, setRange] = useState<TimeRange>("short_term");
  return (
    <figure className="login-preview" id="listening-preview" aria-labelledby="preview-caption">
      <figcaption id="preview-caption" className="login-preview-caption">
        <div><h2>On repeat</h2><p>Your favorites, over time.</p></div>
        <span className="login-sample-label">Sample data</span>
      </figcaption>
      <div className="login-preview-body">
        <RangeTabs range={range} onChange={setRange} appearance="preview" />
        <div className="login-preview-list-heading"><h3>Top tracks</h3><span>Duration</span></div>
        <ol className="login-track-list" aria-live="polite" aria-atomic="true">
          {SAMPLE_ORDER[range].map((trackIndex, rank) => {
            const track = SAMPLE_TRACKS[trackIndex];
            return (
              <li key={track.title} className={rank === 0 ? "login-top-track" : undefined}>
                <span className="login-track-rank" aria-hidden="true">{String(rank + 1).padStart(2, "0")}</span>
                <SampleCover color={track.color} />
                <span className="login-track-name"><strong>{track.title}</strong><span>{track.artist}</span></span>
                <span className="login-track-duration" aria-label={`Duration ${track.duration}`}>{track.duration}</span>
              </li>
            );
          })}
        </ol>
        <div className="login-activity">
          <div className="login-activity-title"><h3>Your listening rhythm</h3><span>A sample week</span></div>
          <div role="img" aria-label="Sample weekly listening activity: mostly weekday evenings and weekend afternoons.">
          <div className="login-heatmap" aria-hidden="true">
            {Array.from({ length: 7 }, (_, day) => (
              <div className="login-heatmap-row" key={day}>
                <span>{SAMPLE_DAYS[day]}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const intensity = Math.max(0, 4 - Math.abs(hour - SAMPLE_PEAK_HOURS[day]));
                  return <span className={`login-heatmap-cell activity-${intensity}`} key={hour} />;
                })}
              </div>
            ))}
          </div>
          <div className="login-heatmap-times" aria-hidden="true"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span></div>
          </div>
          <div className="login-heatmap-legend" aria-hidden="true"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <span className={`login-legend-cell activity-${level}`} key={level} />)}<span>More</span></div>
        </div>
      </div>
      <p className="login-preview-note">A little preview. Connect to see your own listening.</p>
    </figure>
  );
}

export function LoginView() {
  const reducedMotion = useReducedMotion();
  return (
    <main id="main-content" className="login-view">
      <div className="login-paths" aria-hidden="true">{!reducedMotion && <BackgroundPaths />}</div>
      <div className="login-content">
        <section className="login-hero" aria-labelledby="login-title">
          <div className="login-intro">
            <a className="login-brand" href="/" aria-label="SpotiStats home"><img src="/brand/spotistats-logo.svg" alt="SpotiStats" width={907} height={256} /></a>
            <h1 id="login-title">Your listening,<br /><span>laid out.</span></h1>
            <p className="login-description">Connect your Spotify account to see your top tracks, top artists, and recent plays.</p>
            <div className="login-actions">
              {reducedMotion ? (
                <a className="login-connect" href="/login">Connect Spotify<ArrowUpRight className="size-4" aria-hidden="true" /></a>
              ) : (
                <AttractButton className="login-connect touch-pan-y" onClick={() => { window.location.href = "/login"; }} type="button"><span>Connect Spotify</span><ArrowUpRight className="size-4" aria-hidden="true" /></AttractButton>
              )}
            </div>
            <p className="login-connection-note">You’ll continue to Spotify to connect your account.</p>
          </div>
          <ListeningPreview />
        </section>
        <section className="login-features" aria-label="What you can explore">
          <div><h2>Top artists &amp; tracks</h2><p>The favorites you keep coming back to, across different time ranges.</p></div>
          <div><h2>Listening patterns</h2><p>A closer look at when you listen and what’s been on repeat.</p></div>
          <div><h2>Your library</h2><p>Your liked songs, saved albums, and playlists, in one place.</p></div>
        </section>
      </div>
    </main>
  );
}
