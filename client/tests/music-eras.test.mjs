import assert from "node:assert/strict";
import test from "node:test";
import { buildMusicEras } from "../src/lib/music-eras.ts";

const track = (release_date, name = release_date) => ({ id: `track-${name}`, name, artists: [], album: { release_date } });
const summarize = tracks => buildMusicEras(tracks, 2026);

test("groups album releases chronologically and identifies the leading decade and release years", () => {
  const result = summarize([track("2021-04-01"), track("1999"), track("2014-05"), track("2018")]);
  assert.deepEqual(result.eras, [{ decade: "1990s", count: 1 }, { decade: "2010s", count: 2 }, { decade: "2020s", count: 1 }]);
  assert.deepEqual(result.leadingDecades, ["2010s"]);
  assert.equal(result.oldest.year, 1999);
  assert.equal(result.newest.year, 2021);
  assert.equal(result.datedTracks, 4);
});

test("year, month and full-date precision retain the supplied release year", () => {
  const result = summarize([track("1981"), track("1981-12"), track("1981-12-03")]);
  assert.deepEqual(result.eras, [{ decade: "1980s", count: 3 }]);
});

test("missing and malformed dates are skipped and reported through coverage", () => {
  const invalid = [undefined, null, "", "unknown", "0000", "2024-13", "2023-02-29", "2026-04-31", "2026-00", "2026-01-00", "2027"];
  const result = summarize([...invalid.map(value => track(value)), { id: "no-album", name: "No album", artists: [] }, track("2024-02-29")]);
  assert.equal(result.datedTracks, 1);
  assert.equal(result.totalTracks, 13);
  assert.equal(result.oldest.year, 2024);
  assert.deepEqual(result.eras, [{ decade: "2020s", count: 1 }]);
});

test("tied leading decades are preserved rather than choosing an arbitrary winner", () => {
  const result = summarize([track("1991"), track("2011"), track("2012"), track("1999")]);
  assert.deepEqual(result.leadingDecades, ["1990s", "2010s"]);
});

test("loading, no tracks and unavailable dates are distinct states", () => {
  assert.equal(summarize(null), null);
  assert.equal(summarize([]).totalTracks, 0);
  const missing = summarize([track(undefined), track("")]);
  assert.equal(missing.totalTracks, 2);
  assert.equal(missing.datedTracks, 0);
  assert.equal(missing.oldest, null);
  assert.equal(missing.newest, null);
  assert.deepEqual(missing.leadingDecades, []);
});

test("a single dated track works and supplies both release extremes", () => {
  const result = summarize([track("2004", "Only track")]);
  assert.equal(result.oldest.track.name, "Only track");
  assert.equal(result.newest.track.name, "Only track");
  assert.deepEqual(result.leadingDecades, ["2000s"]);
});

test("decade boundaries and century leap-year rules are respected", () => {
  const result = summarize([track("1999"), track("2000-02-29"), track("2009"), track("2010"), track("1900-02-29")]);
  assert.deepEqual(result.eras, [{ decade: "1990s", count: 1 }, { decade: "2000s", count: 2 }, { decade: "2010s", count: 1 }]);
  assert.equal(result.datedTracks, 4);
});

test("uses album edition dates without guessing the original song year or changing the input", () => {
  const tracks = [track("2020", "Remastered older song"), track("1990", "Older edition")];
  const copy = structuredClone(tracks);
  const result = summarize(tracks);
  assert.equal(result.newest.track.name, "Remastered older song");
  assert.deepEqual(tracks, copy);
});
