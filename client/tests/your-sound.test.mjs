import assert from "node:assert/strict";
import test from "node:test";
import { buildSoundBreakdown } from "../src/lib/your-sound.ts";

const artist = (id, genres) => ({ id, name: `Artist ${id}`, ...(genres === undefined ? {} : { genres }) });
const track = (...artists) => ({ id: "track", name: "Track", artists, duration_ms: 180000 });

test("missing Spotify genre fields still produce an artist mix from available tracks", () => {
  const a = artist("a"), b = artist("b");
  const result = buildSoundBreakdown([a, b], [track(a), track(a), track(b)]);
  assert.equal(result.source, "artists");
  assert.deepEqual(result.rows, [{ label: "Artist a", count: 2 }, { label: "Artist b", count: 1 }]);
});

test("empty genre arrays behave like omitted genre fields", () => {
  const a = artist("a", []);
  assert.deepEqual(buildSoundBreakdown([a], [track(a)]).rows, [{ label: "Artist a", count: 1 }]);
});

test("one tagged artist is enough for genres, normalized and counted once per artist", () => {
  const result = buildSoundBreakdown([artist("a", [" Indie Pop ", "indie pop", ""]), artist("b")], null);
  assert.equal(result.source, "genres");
  assert.deepEqual(result.rows, [{ label: "indie pop", count: 1 }]);
  assert.equal(result.taggedArtists, 1);
  assert.equal(result.totalArtists, 2);
});

test("genre counts combine tags across artists without mixing in track credits", () => {
  const result = buildSoundBreakdown([artist("a", ["pop", "rock"]), artist("b", ["POP"])], [track(artist("c"))]);
  assert.equal(result.source, "genres");
  assert.deepEqual(result.rows, [{ label: "pop", count: 2 }, { label: "rock", count: 1 }]);
});

test("collaborations count each credited artist once per track", () => {
  const a = artist("a"), b = artist("b");
  const result = buildSoundBreakdown([a, b], [track(a, a, b), track(b)]);
  assert.deepEqual(result.rows, [{ label: "Artist b", count: 2 }, { label: "Artist a", count: 1 }]);
});

test("artist names are used when an ID is absent, without inventing anonymous artists", () => {
  const result = buildSoundBreakdown([], [track({ name: " Same artist " }, { name: "same artist" }, { name: " " })]);
  assert.deepEqual(result.rows, [{ label: "Same artist", count: 1 }]);
});

test("wait for artist metadata and for fallback tracks to finish loading", () => {
  assert.equal(buildSoundBreakdown(null, [track(artist("a"))]), null);
  assert.equal(buildSoundBreakdown([artist("a")], null), null);
});

test("genuinely empty responses stay empty, and breakdowns are capped at eight rows", () => {
  assert.deepEqual(buildSoundBreakdown([], []).rows, []);
  const artists = Array.from({ length: 10 }, (_, i) => artist(String(i)));
  assert.equal(buildSoundBreakdown(artists, artists.map(a => track(a))).rows.length, 8);
});
