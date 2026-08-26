// server.js
//
// This is the "backend" of SpotiStats.
// Its two jobs:
//   1. Handle the Spotify login (OAuth) so we get permission to read each
//      visitor's data.
//   2. Fetch stats from Spotify and hand them to the frontend (the webpage).
//
// MULTI-USER SESSIONS
// Each visitor gets a random session ID stored in a secure cookie in their
// browser. The server maps session IDs to that person's Spotify tokens, so
// different visitors never see each other's data. Sessions are persisted in
// PostgreSQL (DATABASE_URL) so they survive restarts — on Render, add a
// PostgreSQL add-on and set DATABASE_URL. Without DATABASE_URL, the server
// runs in local-dev mode with in-memory sessions (lost on restart).

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { Pool } = require("pg");

const app = express();

// Render (and most hosts) sit behind a proxy that terminates HTTPS and
// forwards plain HTTP internally. This tells Express to trust the
// "X-Forwarded-Proto" header from that proxy, so it correctly detects
// whether the original request was secure (needed for secure cookies).
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "20kb" }));

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  GROQ_API_KEY,
  GROQ_MODEL,
  PORT,
} = process.env;

// --- Database (PostgreSQL when DATABASE_URL is set) -----------------------
// Add a PostgreSQL add-on in Render and set DATABASE_URL to persist sessions
// across restarts. Without it the server still works — sessions are stored
// in memory and lost on restart (fine for local dev).
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    })
  : null;

const sessions = pool ? null : new Map(); // fallback for local dev

async function initDatabase() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid           TEXT PRIMARY KEY,
        access_token  TEXT NOT NULL,
        refresh_token TEXT,
        expires_at    BIGINT NOT NULL
      );
    `);
    console.log("Database initialized — sessions table ready");
  } finally {
    client.release();
  }
}

async function getSession(sid) {
  if (!sid) return undefined;
  if (!pool) return sessions.get(sid);
  const { rows } = await pool.query("SELECT * FROM sessions WHERE sid = $1", [sid]);
  return rows[0] || undefined;
}

async function setSession(sid, tokens) {
  if (!pool) { sessions.set(sid, tokens); return; }
  await pool.query(
    `INSERT INTO sessions (sid, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (sid) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at    = EXCLUDED.expires_at`,
    [sid, tokens.access_token, tokens.refresh_token || null, tokens.expires_at]
  );
}

async function deleteSession(sid) {
  if (!pool) { sessions.delete(sid); return; }
  await pool.query("DELETE FROM sessions WHERE sid = $1", [sid]);
}

// AI Taste Profile results are cached per session for 24h, since each
// generation costs real money (Groq API usage) — we don't want to
// regenerate on every page refresh. "Regenerate" on the frontend bypasses
// this deliberately.
// sessionId -> { text, generatedAt }
const aiProfileCache = new Map();

// Same caching idea for the Daily/Weekly Recap.
// sessionId -> { text, generatedAt }
const aiRecapCache = new Map();

// The chat feature needs a text summary of your stats to give the AI
// context on every message. Rebuilding that from Spotify on every single
// chat message would be slow and wasteful, so we cache the summary itself
// (not AI output — just formatted data) for an hour.
// sessionId -> { text, generatedAt }
const statsContextCache = new Map();
const ONE_HOUR_MS = 60 * 60 * 1000;

// Shared helper for calling Groq's chat completions API (OpenAI-compatible
// format), used by the taste profile, recap, and chat features alike.
// Model is overridable via GROQ_MODEL because Groq retires models
// periodically (llama-3.1-8b-instant was retired Aug 2026); gpt-oss-20b is
// its designated successor. gpt-oss models are "reasoning" models — low
// reasoning effort keeps responses fast and leaves the token budget for
// the actual prose.
async function callGroq(messages, { system, maxTokens = 400 } = {}) {
  const fullMessages = system ? [{ role: "system", content: system }, ...messages] : messages;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: GROQ_MODEL || "openai/gpt-oss-20b",
      reasoning_effort: "low",
      max_completion_tokens: maxTokens,
      messages: fullMessages,
    },
    {
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
    }
  );

  return (response.data.choices?.[0]?.message?.content || "").trim();
}

// Builds (or returns cached) a compact text summary of a session's stats —
// used as context for the chat feature so the AI can answer questions
// about the visitor's actual listening data.
async function getStatsContext(sessionId) {
  const cached = statsContextCache.get(sessionId);
  if (cached && Date.now() - cached.generatedAt < ONE_HOUR_MS) {
    return cached.text;
  }

  const token = await ensureFreshToken(sessionId);
  const headers = { Authorization: `Bearer ${token}` };

  const [artistsRes, tracksRes, recentRes] = await Promise.all([
    axios.get("https://api.spotify.com/v1/me/top/artists?limit=15&time_range=medium_term", {
      headers,
    }),
    axios.get("https://api.spotify.com/v1/me/top/tracks?limit=15&time_range=medium_term", {
      headers,
    }),
    axios.get("https://api.spotify.com/v1/me/player/recently-played?limit=30", { headers }),
  ]);

  const artistNames = (artistsRes.data.items || []).map((a) => a.name);
  const genres = [...new Set((artistsRes.data.items || []).flatMap((a) => a.genres || []))].slice(
    0,
    15
  );
  const trackNames = (tracksRes.data.items || []).map(
    (t) => `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`
  );
  const recentTrackNames = (recentRes.data.items || []).map(
    (entry) => `${entry.track.name} — ${entry.track.artists.map((a) => a.name).join(", ")}`
  );

  const text = `Top artists (last ~6 months): ${artistNames.join(", ") || "none yet"}
Genres represented: ${genres.join(", ") || "not much genre data available"}
Top tracks (last ~6 months): ${trackNames.join("; ") || "none yet"}
Recently played (most recent ~30 plays): ${recentTrackNames.join("; ") || "no recent plays"}`;

  statsContextCache.set(sessionId, { text, generatedAt: Date.now() });
  return text;
}

// Temporary storage for in-progress logins, so /callback can verify the
// request actually came from a /login we initiated (prevents a class of
// attack called CSRF). Entries are short-lived and cleaned up on use or
// after 10 minutes.
// state -> { sessionId, createdAt }
const pendingLogins = new Map();

function cleanupPendingLogins() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, entry] of pendingLogins) {
    if (entry.createdAt < tenMinutesAgo) pendingLogins.delete(state);
  }
}

function isSecureRequest(req) {
  return req.protocol === "https" || req.get("x-forwarded-proto") === "https";
}

// Reads the visitor's session cookie, creating a new one if they don't
// have one yet.
function getOrCreateSessionId(req, res) {
  let sessionId = req.cookies?.sid;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie("sid", sessionId, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
  return sessionId;
}

// --- Step 1: /login ------------------------------------------------------
// Visiting this route redirects your browser to Spotify's own login page.
// You log in there (on Spotify's site, not ours) and approve access.
app.get("/login", (req, res) => {
  cleanupPendingLogins();

  const sessionId = getOrCreateSessionId(req, res);
  const state = crypto.randomUUID();
  pendingLogins.set(state, { sessionId, createdAt: Date.now() });

  const scope = [
    "user-top-read",
    "user-read-recently-played",
    "user-read-currently-playing",
    "user-read-playback-state",
    "user-follow-read",
    "user-library-read",
    "playlist-read-private",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// --- Step 2: /callback ----------------------------------------------------
// Spotify sends the browser back here after login, with a temporary "code".
// We exchange that code for real access/refresh tokens, tied to whichever
// session started this login.
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  const pending = pendingLogins.get(state);
  if (!pending) {
    return res.status(403).send("Login session expired or invalid. Please try connecting again.");
  }
  pendingLogins.delete(state);

  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    await setSession(pending.sessionId, {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    });

    // Make sure the session cookie is set on this response too, in case
    // this is a fresh browser that only just got its sessionId above.
    res.cookie("sid", pending.sessionId, {
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect("/");
  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);
    res.status(500).send("Login failed. Check your server logs.");
  }
});

// --- Helper: make sure this session has a valid (non-expired) token ------
async function ensureFreshToken(sessionId) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("NOT_LOGGED_IN");
  }

  // Refresh a bit early (60s buffer) rather than waiting for exact expiry.
  if (Date.now() > session.expires_at - 60_000) {
    const refreshResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refresh_token,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
        },
      }
    );

    const newExpiresAt = Date.now() + refreshResponse.data.expires_in * 1000;
    await setSession(sessionId, {
      access_token: refreshResponse.data.access_token,
      refresh_token: session.refresh_token,
      expires_at: newExpiresAt,
    });

    return refreshResponse.data.access_token;
  }

  return session.access_token;
}

// Small wrapper so every /api route follows the same "am I logged in?" pattern.
function apiRoute(routePath, spotifyUrl) {
  app.get(routePath, async (req, res) => {
    try {
      const sessionId = req.cookies?.sid;
      const token = await ensureFreshToken(sessionId);
      const response = await axios.get(spotifyUrl(req), {
        headers: { Authorization: `Bearer ${token}` },
      });
      res.json(response.data || null);
    } catch (err) {
      if (err.message === "NOT_LOGGED_IN") {
        return res.status(401).json({ error: "not_logged_in" });
      }
      console.error(`Error on ${routePath}:`, err.response?.data || err.message);
      res.status(500).json({ error: "spotify_api_error" });
    }
  });
}

// --- Step 3: data routes the frontend will call ---------------------------
apiRoute(
  "/api/top-tracks",
  (req) =>
    `https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=${req.query.range || "medium_term"}`
);

apiRoute(
  "/api/top-artists",
  (req) =>
    `https://api.spotify.com/v1/me/top/artists?limit=10&time_range=${req.query.range || "medium_term"}`
);

apiRoute("/api/recent", () => "https://api.spotify.com/v1/me/player/recently-played?limit=50");

// /me/player returns everything /me/player/currently-playing did, plus
// device info, volume, shuffle state, and repeat state — used for the
// hero's progress bar and playback details.
apiRoute("/api/now-playing", () => "https://api.spotify.com/v1/me/player");

apiRoute("/api/playlists", () => "https://api.spotify.com/v1/me/playlists?limit=50");

// Used by "Most Played Playlists" to fetch a playlist's name/cover art/
// Spotify URL by ID (recently-played entries only tell us the playlist ID
// it was played from, not its name or image). Results are cached per
// playlist ID — names and covers change rarely, and this endpoint gets hit
// on every page load otherwise.
const playlistMetaCache = new Map();

app.get("/api/playlist-meta", async (req, res) => {
  const id = req.query.id;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "missing_id" });
  }

  const cached = playlistMetaCache.get(id);
  if (cached) {
    return res.json(cached);
  }

  try {
    const sessionId = req.cookies?.sid;
    const token = await ensureFreshToken(sessionId);
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}?fields=name,images,external_urls`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    playlistMetaCache.set(id, response.data);
    res.json(response.data);
  } catch (err) {
    if (err.message === "NOT_LOGGED_IN") {
      return res.status(401).json({ error: "not_logged_in" });
    }
    console.error("Error on /api/playlist-meta:", err.response?.data || err.message);
    res.status(500).json({ error: "spotify_api_error" });
  }
});

// Library snapshot: just counts, so we ask for 1 item per category and read
// the "total" field each paginated Spotify response includes. Cheaper than
// downloading every followed artist / saved track just to count them.
app.get("/api/library-snapshot", async (req, res) => {
  try {
    const sessionId = req.cookies?.sid;
    const token = await ensureFreshToken(sessionId);
    const headers = { Authorization: `Bearer ${token}` };

    const [followedArtists, savedTracks, savedAlbums, playlists] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me/following?type=artist&limit=1", { headers }),
      axios.get("https://api.spotify.com/v1/me/tracks?limit=1", { headers }),
      axios.get("https://api.spotify.com/v1/me/albums?limit=1", { headers }),
      axios.get("https://api.spotify.com/v1/me/playlists?limit=1", { headers }),
    ]);

    res.json({
      followedArtists: followedArtists.data.artists?.total ?? 0,
      savedTracks: savedTracks.data.total ?? 0,
      savedAlbums: savedAlbums.data.total ?? 0,
      playlists: playlists.data.total ?? 0,
    });
  } catch (err) {
    if (err.message === "NOT_LOGGED_IN") {
      return res.status(401).json({ error: "not_logged_in" });
    }
    console.error("Error on /api/library-snapshot:", err.response?.data || err.message);
    res.status(500).json({ error: "spotify_api_error" });
  }
});

// --- AI Taste Profile ------------------------------------------------------
// Sends your top artists/genres/tracks to an AI and asks for a short, fun
// written take on your music taste. Requires the site owner to have set
// GROQ_API_KEY — if they haven't, we tell the frontend clearly rather
// than erroring cryptically.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

app.get("/api/ai-taste-profile", async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(501).json({ error: "ai_not_configured" });
  }

  const sessionId = req.cookies?.sid;
  const forceRefresh = req.query.refresh === "1";

  try {
    // Serve from cache unless the visitor explicitly asked to regenerate,
    // or the cached take is more than a day old.
    if (!forceRefresh) {
      const cached = aiProfileCache.get(sessionId);
      if (cached && Date.now() - cached.generatedAt < ONE_DAY_MS) {
        return res.json({ profile: cached.text, cached: true });
      }
    }

    const token = await ensureFreshToken(sessionId);
    const headers = { Authorization: `Bearer ${token}` };

    const [artistsRes, tracksRes] = await Promise.all([
      axios.get(
        "https://api.spotify.com/v1/me/top/artists?limit=15&time_range=medium_term",
        { headers }
      ),
      axios.get(
        "https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=medium_term",
        { headers }
      ),
    ]);

    const artistNames = (artistsRes.data.items || []).map((a) => a.name);
    const genres = [
      ...new Set((artistsRes.data.items || []).flatMap((a) => a.genres || [])),
    ].slice(0, 12);
    const trackNames = (tracksRes.data.items || []).map(
      (t) => `${t.name} — ${t.artists.map((a) => a.name).join(", ")}`
    );

    if (artistNames.length === 0) {
      return res.json({
        profile:
          "Not enough listening history yet to build a taste profile — play a bit more on Spotify and try again.",
        cached: false,
      });
    }

    const prompt = `You're a witty, warm music critic writing a short personality
read on a listener's music taste — the kind of clever, specific take a
friend who really knows music would give, not a generic horoscope.

Top artists (last ~6 months): ${artistNames.join(", ")}
Genres represented: ${genres.join(", ") || "not much genre data available"}
Some of their top tracks: ${trackNames.join("; ")}

Write 3-4 sentences. Be specific and interpretive — reference actual
artists/genres by name rather than speaking in vague generalities. Playful
and a little cheeky is good; mean-spirited is not. Do not use headers,
bullet points, or markdown — plain prose only.`;

    const aiResponse = await callGroq([{ role: "user", content: prompt }], { maxTokens: 300 });

    aiProfileCache.set(sessionId, { text: aiResponse, generatedAt: Date.now() });
    res.json({ profile: aiResponse, cached: false });
  } catch (err) {
    if (err.message === "NOT_LOGGED_IN") {
      return res.status(401).json({ error: "not_logged_in" });
    }
    console.error("Error on /api/ai-taste-profile:", err.response?.data || err.message);
    res.status(500).json({ error: "ai_generation_failed" });
  }
});

// --- AI Daily/Weekly Recap -------------------------------------------------
// A short written recap of your recent listening, built from your last
// ~50 plays (the same data the Daily Top and Listening Clock charts use).
// Cached per session for 24h for the same cost reasons as the taste profile.
app.get("/api/ai-recap", async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(501).json({ error: "ai_not_configured" });
  }

  const sessionId = req.cookies?.sid;
  const forceRefresh = req.query.refresh === "1";

  try {
    if (!forceRefresh) {
      const cached = aiRecapCache.get(sessionId);
      if (cached && Date.now() - cached.generatedAt < ONE_DAY_MS) {
        return res.json({ recap: cached.text, cached: true });
      }
    }

    const token = await ensureFreshToken(sessionId);
    const headers = { Authorization: `Bearer ${token}` };
    const recentRes = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      { headers }
    );
    const items = recentRes.data.items || [];

    if (items.length === 0) {
      return res.json({
        recap: "Not enough recent plays yet to build a recap — play something on Spotify and check back.",
        cached: false,
      });
    }

    // Same day/artist/track counting the Daily Top chart does client-side,
    // done here server-side so we can hand the AI a compact summary
    // instead of 50 raw play records.
    const dayMap = {};
    const artistCounts = {};
    items.forEach((entry) => {
      const track = entry.track;
      const playedAt = new Date(entry.played_at);
      const dayKey = playedAt.toDateString();
      dayMap[dayKey] = true;

      const primaryArtist = track.artists[0]?.name;
      if (primaryArtist) {
        artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
      }
    });

    const dayCount = Object.keys(dayMap).length;
    const topArtistsInWindow = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} (${count} plays)`);

    const trackList = items
      .slice(0, 20)
      .map((entry) => `${entry.track.name} — ${entry.track.artists.map((a) => a.name).join(", ")}`);

    const prompt = `You're writing a short, warm "here's your recent listening" recap
for a Spotify stats dashboard — like a mini weekly wrap-up, not a formal report.

This covers their last ~${items.length} plays, spanning ${dayCount} day(s).
Most-played artists in this window: ${topArtistsInWindow.join(", ")}
Sample of tracks played: ${trackList.join("; ")}

Write 3-4 sentences summarizing the vibe of this listening window — call out
specific artists or patterns you notice (e.g. leaning on one artist heavily,
a genre mood, late-night vs daytime listening if it's inferable). Warm and
conversational, not clinical. No headers, bullet points, or markdown — plain
prose only.`;

    const aiResponse = await callGroq([{ role: "user", content: prompt }], { maxTokens: 300 });

    aiRecapCache.set(sessionId, { text: aiResponse, generatedAt: Date.now() });
    res.json({ recap: aiResponse, cached: false });
  } catch (err) {
    if (err.message === "NOT_LOGGED_IN") {
      return res.status(401).json({ error: "not_logged_in" });
    }
    console.error("Error on /api/ai-recap:", err.response?.data || err.message);
    res.status(500).json({ error: "ai_generation_failed" });
  }
});

// --- AI Chat: "Ask about your stats" ---------------------------------------
// A small conversational endpoint that answers questions about the
// visitor's own listening data. The browser sends the full conversation
// history each time (the AI has no memory between calls), and we attach a
// system prompt built from their real stats so answers are grounded in
// their actual data instead of generic guesses.
app.post("/api/ai-chat", async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(501).json({ error: "ai_not_configured" });
  }

  const sessionId = req.cookies?.sid;
  const { message, history } = req.body || {};

  // Basic input validation — keeps costs predictable and blocks obviously
  // malformed requests. Not meant to be exhaustive abuse protection, just
  // sane limits for a personal-use tool.
  if (typeof message !== "string" || message.trim().length === 0 || message.length > 500) {
    return res.status(400).json({ error: "invalid_message" });
  }
  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (turn) =>
            turn &&
            (turn.role === "user" || turn.role === "assistant") &&
            typeof turn.content === "string" &&
            turn.content.length <= 500
        )
        .slice(-10)
    : [];

  try {
    const statsContext = await getStatsContext(sessionId);

    const systemPrompt = `You are a friendly assistant embedded in SpotiStats, a personal
Spotify listening-stats dashboard. Answer the visitor's questions about
their own music taste and listening habits using ONLY the data below —
don't invent statistics that aren't supported by it, and say so plainly if
something isn't in the data rather than guessing.

${statsContext}

Keep answers conversational and fairly short (a few sentences unless they
ask for a list). No markdown headers — plain prose or simple lists only.`;

    const reply = await callGroq([...safeHistory, { role: "user", content: message }], {
      system: systemPrompt,
      maxTokens: 350,
    });

    res.json({ reply });
  } catch (err) {
    if (err.message === "NOT_LOGGED_IN") {
      return res.status(401).json({ error: "not_logged_in" });
    }
    console.error("Error on /api/ai-chat:", err.response?.data || err.message);
    res.status(500).json({ error: "ai_generation_failed" });
  }
});

// Lets the frontend check login status without triggering a redirect.
app.get("/api/status", async (req, res) => {
  const sessionId = req.cookies?.sid;
  const session = sessionId ? await getSession(sessionId) : undefined;
  res.json({ logged_in: !!session });
});

// Lets a visitor log out — clears their session server-side and their cookie.
app.get("/logout", async (req, res) => {
  const sessionId = req.cookies?.sid;
  if (sessionId) {
    await deleteSession(sessionId);
    aiProfileCache.delete(sessionId);
    aiRecapCache.delete(sessionId);
    statsContextCache.delete(sessionId);
  }
  res.clearCookie("sid");
  res.redirect("/");
});

// --- Serve the frontend ----------------------------------------------------
// Serves the built React client (client/dist) when it exists — the frontend
// was rebuilt with Vite + React + Kokonut UI. Falls back to the original
// static public/ folder so the app still runs before the client is built.
const clientDist = path.join(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
} else {
  app.use(express.static(path.join(__dirname, "../public")));
}

const port = PORT || 8888;

// Optional local HTTPS: if you generate a certificate (see README —
// "Running locally over HTTPS"), the server automatically uses it instead
// of plain HTTP. This matters for some browsers (Brave in particular) that
// treat http://127.0.0.1 redirect URIs more strictly than others, even
// though Spotify itself allows that combination. Running locally the same
// way your deployed Render site does (HTTPS) sidesteps that entirely.
const certPath = path.join(__dirname, "certs", "127.0.0.1.pem");
const keyPath = path.join(__dirname, "certs", "127.0.0.1-key.pem");
const hasLocalCert = fs.existsSync(certPath) && fs.existsSync(keyPath);

if (hasLocalCert) {
  const server = https.createServer(
    { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
    app
  );
  initDatabase()
    .then(() => {
      server.listen(port, () => {
        console.log(`Server running: https://127.0.0.1:${port}`);
        console.log(`Log in at:       https://127.0.0.1:${port}/login`);
      });
    })
    .catch((err) => {
      console.error("Database init failed — falling back to in-memory sessions:", err.message);
      server.listen(port, () => {
        console.log(`Server running: https://127.0.0.1:${port} (no database)`);
      });
    });
} else {
  initDatabase()
    .then(() => {
      http.createServer(app).listen(port, () => {
        console.log(`Server running: http://127.0.0.1:${port}`);
        console.log(`Log in at:       http://127.0.0.1:${port}/login`);
      });
    })
    .catch((err) => {
      console.error("Database init failed — falling back to in-memory sessions:", err.message);
      http.createServer(app).listen(port, () => {
        console.log(`Server running: http://127.0.0.1:${port} (no database)`);
      });
    });
}

// Graceful shutdown — close the database pool so Render can drain cleanly.
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down…");
  if (pool) await pool.end();
  process.exit(0);
});
