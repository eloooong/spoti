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
// browser. The server keeps a Map from session ID -> that person's Spotify
// tokens, so different visitors never see each other's data or overwrite
// each other's login. This still stores everything in memory (not a
// database), so: (a) it's fine for a handful of testers, and (b) all
// sessions are lost if the server restarts — including Render's free tier
// "spinning down" after inactivity. That's an acceptable tradeoff for a
// testing project; a production app would use a real database instead.

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

const app = express();

// Render (and most hosts) sit behind a proxy that terminates HTTPS and
// forwards plain HTTP internally. This tells Express to trust the
// "X-Forwarded-Proto" header from that proxy, so it correctly detects
// whether the original request was secure (needed for secure cookies).
app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  PORT,
} = process.env;

// --- Per-session token storage ------------------------------------------
// sessionId -> { access_token, refresh_token, expires_at }
const sessions = new Map();

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
    sessions.set(pending.sessionId, {
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
  const session = sessions.get(sessionId);
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

    session.access_token = refreshResponse.data.access_token;
    session.expires_at = Date.now() + refreshResponse.data.expires_in * 1000;
    sessions.set(sessionId, session);
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

// Used by "Top Playlists Listened" to fetch a playlist's name/cover art by
// ID (recently-played entries only tell us the playlist ID it was played
// from, not its name or image).
apiRoute(
  "/api/playlist-meta",
  (req) => `https://api.spotify.com/v1/playlists/${encodeURIComponent(req.query.id)}?fields=name,images`
);

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

// Lets the frontend check login status without triggering a redirect.
app.get("/api/status", (req, res) => {
  const sessionId = req.cookies?.sid;
  res.json({ logged_in: !!(sessionId && sessions.has(sessionId)) });
});

// Lets a visitor log out — clears their session server-side and their cookie.
app.get("/logout", (req, res) => {
  const sessionId = req.cookies?.sid;
  if (sessionId) sessions.delete(sessionId);
  res.clearCookie("sid");
  res.redirect("/");
});

// --- Serve the frontend ----------------------------------------------------
app.use(express.static(path.join(__dirname, "../public")));

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
  server.listen(port, () => {
    console.log(`Server running: https://127.0.0.1:${port}`);
    console.log(`Log in at:       https://127.0.0.1:${port}/login`);
  });
} else {
  http.createServer(app).listen(port, () => {
    console.log(`Server running: http://127.0.0.1:${port}`);
    console.log(`Log in at:       http://127.0.0.1:${port}/login`);
    console.log(
      `(Running over plain HTTP. If Spotify login fails in Brave, see the README section "Running locally over HTTPS".)`
    );
  });
}
